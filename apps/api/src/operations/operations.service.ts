import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { ConnectorsService } from '../connectors/connectors.service';
import { OperationsEngineClient } from './engine-client';
import { OperationsStaffing } from './operations-staffing';
import { OperationsOutbound } from './operations-outbound';
import type { User } from '@prisma/client';

/**
 * S5: Business Operations — AgentOS'ning "kompaniyani haqiqatan yuritish" qatlami.
 *   - Xodimlar, smena jadvali (tabiiy tildan LLM-first), ta'til/dam olish
 *   - Payroll-yaqin hisob: soat × stavka (deterministik; soliq YO'Q — bu ataylab)
 *   - Tashqi kommunikatsiya: qoralama (agent) → tasdiq (ega) → yuborish (Connector SDK)
 *
 * Ushbu klass yupqa fasad: haqiqiy mantiq operations-staffing.ts (xodim/smena/
 * payroll) va operations-outbound.ts (qoralama/yuborish) fayllarida.
 */
@Injectable()
export class OperationsService {
  private readonly staffing: OperationsStaffing;
  private readonly outbound: OperationsOutbound;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditLogService,
    private readonly connectors: ConnectorsService,
  ) {
    const engine = new OperationsEngineClient(this.http, new Logger(OperationsService.name));
    this.staffing = new OperationsStaffing(this.prisma, this.audit, engine);
    this.outbound = new OperationsOutbound(this.prisma, this.audit, this.connectors, engine);
  }

  // ---- Xodimlar / smena / ta'til / payroll ----

  listEmployees(user: User) {
    return this.staffing.listEmployees(user);
  }

  addEmployee(user: User, dto: { name: string; role?: string; phone?: string; email?: string; hourlyRate?: number; monthlyRate?: number }) {
    return this.staffing.addEmployee(user, dto);
  }

  removeEmployee(user: User, id: string) {
    return this.staffing.removeEmployee(user, id);
  }

  generateSchedule(user: User, instructions: string, weekStart?: string) {
    return this.staffing.generateSchedule(user, instructions, weekStart);
  }

  listShifts(user: User, from?: string, to?: string) {
    return this.staffing.listShifts(user, from, to);
  }

  setShiftStatus(user: User, id: string, status: string) {
    return this.staffing.setShiftStatus(user, id, status);
  }

  requestTimeOff(user: User, dto: { employeeId: string; startDate: string; endDate: string; kind?: string; reason?: string }) {
    return this.staffing.requestTimeOff(user, dto);
  }

  decideTimeOff(user: User, id: string, decision: 'approved' | 'rejected') {
    return this.staffing.decideTimeOff(user, id, decision);
  }

  listTimeOff(user: User) {
    return this.staffing.listTimeOff(user);
  }

  payroll(user: User, from: string, to: string) {
    return this.staffing.payroll(user, from, to);
  }

  // ---- Tashqi kommunikatsiya ----

  draftOutbound(
    user: User,
    dto: { purpose: string; audience?: string; recipientName?: string; recipientContact: string; channel?: string; context?: string },
  ) {
    return this.outbound.draftOutbound(user, dto);
  }

  approveAndSend(user: User, id: string) {
    return this.outbound.approveAndSend(user, id);
  }

  updateOutbound(user: User, id: string, dto: { body?: string; subject?: string }) {
    return this.outbound.updateOutbound(user, id, dto);
  }

  listOutbound(user: User) {
    return this.outbound.listOutbound(user);
  }
}
