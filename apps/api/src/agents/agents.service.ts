import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { UsageService } from '../usage/usage.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { AgentBillingService } from './agent-billing.service';
import { AgentCreation } from './agent-creation';
import { AgentCompose } from './agent-compose';
import { AgentCrud } from './agent-crud';
import { AgentRuntime } from './agent-runtime';
import type { User } from '@prisma/client';

// trialDays/trialMessageLimit/addMonths/addDays haqiqiy joyi agent-creation.ts —
// bu yerda faqat mavjud import yo'llarini (agent-billing.service.ts,
// marketplace.service.ts) buzmaslik uchun qayta eksport qilinadi.
export { trialDays, trialMessageLimit, addMonths, addDays } from './agent-creation';

/**
 * Ushbu klass yupqa fasad: haqiqiy mantiq domen bo'yicha alohida
 * fayllarga bo'lingan — agent-creation.ts (narxlash+yaratish),
 * agent-compose.ts (bir-klik taklif), agent-crud.ts (CRUD),
 * agent-runtime.ts (ijro+sinov+muzlash). Kontroller va testlar uchun
 * ommaviy metod imzolari o'zgarmagan.
 */
@Injectable()
export class AgentsService {
  private readonly creation: AgentCreation;
  private readonly composer: AgentCompose;
  private readonly crud: AgentCrud;
  private readonly runtime: AgentRuntime;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditLogService,
    private readonly usage: UsageService,
    private readonly agentBilling: AgentBillingService,
  ) {
    this.creation = new AgentCreation(this.prisma, this.audit, this.usage);
    this.composer = new AgentCompose(this.http);
    this.crud = new AgentCrud(this.prisma, this.audit);
    this.runtime = new AgentRuntime(this.prisma, this.http, this.usage, this.agentBilling, this.crud);
  }

  create(user: User, dto: CreateAgentDto, priceOverride?: { creationUsd: number; monthlyUsd: number }) {
    return this.creation.create(user, dto, priceOverride);
  }

  compose(user: User, description: string, language?: string) {
    return this.composer.compose(user, description, language);
  }

  findAll(user: User) {
    return this.crud.findAll(user);
  }

  findOne(id: string, user: User) {
    return this.crud.findOne(id, user);
  }

  trustLog(id: string, user: User) {
    return this.crud.trustLog(id, user);
  }

  update(id: string, user: User, dto: UpdateAgentDto) {
    return this.crud.update(id, user, dto);
  }

  remove(id: string, user: User) {
    return this.crud.remove(id, user);
  }

  reactivate(id: string, user: User) {
    return this.runtime.reactivate(id, user);
  }

  run(id: string, user: User, message: string, conversationId?: string) {
    return this.runtime.run(id, user, message, conversationId);
  }
}
