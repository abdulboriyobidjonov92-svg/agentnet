import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { OperationsEngineClient } from './engine-client';
import type { User } from '@prisma/client';

/** Xodimlar, smena jadvali (tabiiy tildan LLM-first), ta'til va payroll-yaqin hisob. */
export class OperationsStaffing {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly engine: OperationsEngineClient,
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

    const plan = await this.engine.call('/ops/schedule', {
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
}
