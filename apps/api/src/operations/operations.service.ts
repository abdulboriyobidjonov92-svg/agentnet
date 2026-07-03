import { Injectable, Logger, NotFoundException, BadGatewayException, UnprocessableEntityException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { ConnectorsService } from '../connectors/connectors.service';
import type { User } from '@prisma/client';

/**
 * S5: Business Operations — AgentOS'ning "kompaniyani haqiqatan yuritish" qatlami.
 *   - Xodimlar, smena jadvali (tabiiy tildan LLM-first), ta'til/dam olish
 *   - Payroll-yaqin hisob: soat × stavka (deterministik; soliq YO'Q — bu ataylab)
 *   - Tashqi kommunikatsiya: qoralama (agent) → tasdiq (ega) → yuborish (Connector SDK)
 */
@Injectable()
export class OperationsService {
  private readonly logger = new Logger(OperationsService.name);
  private readonly engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditLogService,
    private readonly connectors: ConnectorsService,
  ) {}

  // ---- Xodimlar ----

  async listEmployees(user: User) {
    return this.prisma.employee.findMany({
      where: { userId: user.id, active: true },
      include: { timeOffs: { where: { status: 'approved' }, take: 5, orderBy: { createdAt: 'desc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async addEmployee(user: User, dto: { name: string; role?: string; phone?: string; email?: string; hourlyRate?: number; monthlyRate?: number }) {
    return this.prisma.employee.create({
      data: {
        userId: user.id, orgId: user.orgId ?? null,
        name: dto.name, role: dto.role ?? null, phone: dto.phone ?? null, email: dto.email ?? null,
        hourlyRate: dto.hourlyRate ?? null, monthlyRate: dto.monthlyRate ?? null,
      },
    });
  }

  async removeEmployee(user: User, id: string) {
    const emp = await this.prisma.employee.findFirst({ where: { id, userId: user.id } });
    if (!emp) throw new NotFoundException('Xodim topilmadi');
    return this.prisma.employee.update({ where: { id }, data: { active: false } });
  }

  // ---- Smena jadvali (tabiiy tildan) ----

  async generateSchedule(user: User, instructions: string, weekStart?: string) {
    const employees = await this.listEmployees(user);
    const empPayload = employees.map((e) => ({
      name: e.name, role: e.role,
      approved_time_off: e.timeOffs.map((t) => ({ from: t.startDate, to: t.endDate, kind: t.kind })),
    }));

    const plan = await this.callEngine('/ops/schedule', {
      instructions,
      employees: empPayload,
      week_start: weekStart ?? null,
      language: user.preferredLanguage ?? 'en',
    });

    // Rejani haqiqiy Shift yozuvlariga aylantirish (hafta qayta yaratiladi)
    const byName = new Map(employees.map((e) => [e.name, e]));
    const dates = (plan.shifts ?? []).map((s: any) => s.date);
    if (dates.length) {
      await this.prisma.shift.deleteMany({
        where: { userId: user.id, date: { in: dates }, status: 'scheduled' },
      });
    }
    let created = 0;
    for (const s of plan.shifts ?? []) {
      const emp = byName.get(s.employee);
      if (!emp) continue;
      await this.prisma.shift.create({
        data: {
          employeeId: emp.id, userId: user.id,
          date: s.date, startTime: s.start, endTime: s.end, note: s.note ?? null,
        },
      });
      created++;
    }

    await this.audit.record({
      actorId: user.id, action: 'ops.schedule_generate', resourceType: 'shift',
      metadata: { created, method: plan.method, week_start: plan.week_start },
    });
    return { ...plan, created };
  }

  async listShifts(user: User, from?: string, to?: string) {
    return this.prisma.shift.findMany({
      where: {
        userId: user.id,
        ...(from && to ? { date: { gte: from, lte: to } } : {}),
      },
      include: { employee: { select: { name: true, role: true } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      take: 100,
    });
  }

  async setShiftStatus(user: User, id: string, status: string) {
    const shift = await this.prisma.shift.findFirst({ where: { id, userId: user.id } });
    if (!shift) throw new NotFoundException('Smena topilmadi');
    const allowed = ['scheduled', 'completed', 'missed', 'cancelled'];
    return this.prisma.shift.update({
      where: { id },
      data: { status: allowed.includes(status) ? status : shift.status },
    });
  }

  // ---- Ta'til / dam olish ----

  async requestTimeOff(user: User, dto: { employeeId: string; startDate: string; endDate: string; kind?: string; reason?: string }) {
    const emp = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, userId: user.id } });
    if (!emp) throw new NotFoundException('Xodim topilmadi');
    return this.prisma.timeOff.create({
      data: {
        employeeId: emp.id, userId: user.id,
        startDate: dto.startDate, endDate: dto.endDate,
        kind: dto.kind ?? 'vacation', reason: dto.reason ?? null,
      },
    });
  }

  async decideTimeOff(user: User, id: string, decision: 'approved' | 'rejected') {
    const to = await this.prisma.timeOff.findFirst({ where: { id, userId: user.id } });
    if (!to) throw new NotFoundException("So'rov topilmadi");
    return this.prisma.timeOff.update({ where: { id }, data: { status: decision } });
  }

  async listTimeOff(user: User) {
    return this.prisma.timeOff.findMany({
      where: { userId: user.id },
      include: { employee: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ---- Payroll-yaqin hisob (soat × stavka; soliq YO'Q — halol chegara) ----

  async payroll(user: User, from: string, to: string) {
    const shifts = await this.prisma.shift.findMany({
      where: { userId: user.id, date: { gte: from, lte: to }, status: { in: ['scheduled', 'completed'] } },
      include: { employee: true },
    });

    const byEmp = new Map<string, { name: string; hours: number; hourlyRate: number | null; monthlyRate: number | null; shifts: number }>();
    for (const s of shifts) {
      const cur = byEmp.get(s.employeeId) ?? {
        name: s.employee.name, hours: 0,
        hourlyRate: s.employee.hourlyRate, monthlyRate: s.employee.monthlyRate, shifts: 0,
      };
      cur.hours += this.shiftHours(s.startTime, s.endTime);
      cur.shifts++;
      byEmp.set(s.employeeId, cur);
    }

    const rows = [...byEmp.entries()].map(([employeeId, r]) => {
      // Soatlik stavka bo'lsa: soat × stavka; oylik bo'lsa: proporsional (176 soat norma)
      const gross = r.hourlyRate
        ? Math.round(r.hours * r.hourlyRate)
        : r.monthlyRate
          ? Math.round((r.hours / 176) * r.monthlyRate)
          : 0;
      return {
        employeeId, name: r.name,
        hours: Math.round(r.hours * 10) / 10, shifts: r.shifts,
        rate_type: r.hourlyRate ? 'hourly' : r.monthlyRate ? 'monthly_prorated' : 'no_rate_set',
        gross_tiyin: gross,
        gross_uzs: Math.round(gross / 100),
      };
    });

    const totalHours = rows.reduce((s, r) => s + r.hours, 0);
    const totalGross = rows.reduce((s, r) => s + r.gross_tiyin, 0);

    return {
      period: { from, to },
      rows,
      totals: { hours: Math.round(totalHours * 10) / 10, gross_tiyin: totalGross, gross_uzs: Math.round(totalGross / 100) },
      note: 'Hours × rate calculation only. Taxes, social payments and filings are NOT included — not tax advice.',
    };
  }

  private shiftHours(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
    const minutes = eh * 60 + em - (sh * 60 + sm);
    return Math.max(0, minutes) / 60;
  }

  // ---- Tashqi kommunikatsiya (draft → approve → send) ----

  async draftOutbound(
    user: User,
    dto: { purpose: string; audience?: string; recipientName?: string; recipientContact: string; channel?: string; context?: string },
  ) {
    const org = user.orgId ? await this.prisma.org.findUnique({ where: { id: user.orgId } }) : null;
    const draft = await this.callEngine('/ops/outbound-draft', {
      purpose: dto.purpose,
      audience: dto.audience ?? 'client',
      recipient_name: dto.recipientName ?? '',
      channel: dto.channel ?? 'telegram',
      org_name: org?.name ?? '',
      context: dto.context ?? '',
      language: user.preferredLanguage ?? 'en',
    });

    const msg = await this.prisma.outboundMessage.create({
      data: {
        userId: user.id, orgId: user.orgId ?? null,
        audience: dto.audience ?? 'client',
        recipientName: dto.recipientName ?? null,
        recipientContact: dto.recipientContact,
        channel: dto.channel ?? 'telegram',
        subject: draft.subject || null,
        body: draft.body,
        meta: { purpose: dto.purpose, method: draft.method },
      },
    });
    return msg;
  }

  /** Yuborish — faqat egasi tasdiqlagandan keyin (approve → send bitta qadamda). */
  async approveAndSend(user: User, id: string) {
    const msg = await this.prisma.outboundMessage.findFirst({ where: { id, userId: user.id } });
    if (!msg) throw new NotFoundException('Xabar topilmadi');

    const res = await this.connectors.sendViaChannel(
      user, msg.channel, msg.recipientContact, msg.body, msg.subject ?? undefined,
    );

    const updated = await this.prisma.outboundMessage.update({
      where: { id },
      data: {
        status: res.ok ? 'sent' : 'failed',
        sentAt: res.ok ? new Date() : null,
        meta: { ...((msg.meta as object) ?? {}), deliveryResult: res.ok ? 'ok' : res.error },
      },
    });

    await this.audit.record({
      actorId: user.id, action: 'ops.outbound_send', resourceType: 'outbound_message', resourceId: id,
      metadata: { channel: msg.channel, ok: res.ok, needs: res.needs },
    });
    return { message: updated, delivery: res };
  }

  async updateOutbound(user: User, id: string, dto: { body?: string; subject?: string }) {
    const msg = await this.prisma.outboundMessage.findFirst({ where: { id, userId: user.id } });
    if (!msg) throw new NotFoundException('Xabar topilmadi');
    return this.prisma.outboundMessage.update({
      where: { id },
      data: { ...(dto.body && { body: dto.body }), ...(dto.subject !== undefined && { subject: dto.subject }) },
    });
  }

  async listOutbound(user: User) {
    return this.prisma.outboundMessage.findMany({
      where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50,
    });
  }

  // ---- Engine chaqiruv ----

  private async callEngine(path: string, body: unknown): Promise<any> {
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.engineUrl}${path}`, body, { timeout: 90_000 }),
      );
      return data;
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 422 && detail?.blocked) {
        throw new UnprocessableEntityException({ blocked: true, reason: detail.reason });
      }
      this.logger.error(`Engine xatosi (${path}): ${e.message}`);
      throw new BadGatewayException("Agent engine bilan aloqa yo'q");
    }
  }
}
