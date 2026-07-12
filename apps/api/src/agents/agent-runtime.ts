import { BadGatewayException, HttpException, HttpStatus, UnprocessableEntityException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { UsageService } from '../usage/usage.service';
import { AgentBillingService } from './agent-billing.service';
import { trialDays, trialMessageLimit } from './agent-creation';
import type { AgentCrud } from './agent-crud';
import type { User } from '@prisma/client';

// Suhbatga xabar qo'shishni bir suhbat bo'yicha seriyalash uchun (parallel
// xabarlar JSON massivda bir-birini o'chirib yubormasligi uchun).
const CONVERSATION_APPEND_LOCK_NS = 4779;

/** Agent ijrosi: sinov/muzlash holati, LLM chaqiruvi, suhbat yozuvi va qayta faollashtirish. */
export class AgentRuntime {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly usage: UsageService,
    private readonly agentBilling: AgentBillingService,
    private readonly crud: AgentCrud,
  ) {}

  /** Muzlatilgan agent uchun sabab-mos aniq xabar (sinov tugashi vs oylik to'lov muvaffaqiyatsizligi). */
  private frozenErrorPayload(agent: { name: string; monthlyPriceTiyin: number; frozenReason: string | null }) {
    if (agent.frozenReason === 'trial_expired') {
      return {
        message: `"${agent.name}" agentining sinov muddati tugadi (${trialDays()} kun yoki ${trialMessageLimit()} xabar). Davom etish uchun oylik to'lovni amalga oshiring (${Math.round(agent.monthlyPriceTiyin / 100).toLocaleString('ru-RU')} so'm/oy).`,
        reason: 'trial_expired',
      };
    }
    return {
      message: `"${agent.name}" agenti muzlatilgan — oylik to'lov o'tmadi. Hisobingizni to'ldirib, agentni qayta faollashtiring.`,
      reason: 'agent_frozen',
    };
  }

  /**
   * Balans to'ldirilgandan keyin — muzlatilgan agentni qayta faollashtirish.
   * Darhol qarzdor oylik siklni yechishga urinadi; muvaffaqiyatli bo'lsa
   * frozen=false bo'ladi, aks holda aniq 402 xato (hali ham yetarli emas).
   */
  async reactivate(id: string, user: User) {
    const agent = await this.crud.findOne(id, user);
    if (!agent.frozen) return agent;

    await this.agentBilling.chargeOne({ ...agent, user });
    const fresh = await this.prisma.agent.findUniqueOrThrow({ where: { id } });
    if (fresh.frozen) {
      throw new HttpException(
        {
          message: `Balansingiz hali ham yetarli emas. Oylik narx: ${Math.round(fresh.monthlyPriceTiyin / 100).toLocaleString('ru-RU')} so'm. Hisobingizni to'ldiring.`,
          reason: 'insufficient_balance',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return fresh;
  }

  async run(id: string, user: User, message: string, conversationId?: string) {
    let agent = await this.crud.findOne(id, user);
    if (agent.frozen) {
      throw new HttpException(this.frozenErrorPayload(agent), HttpStatus.PAYMENT_REQUIRED);
    }

    // Sinov (faqat birinchi agent): 20-xabar chegarasi bu yerda, 3-kunlik
    // chegara esa agent-billing.service.ts'dagi kunlik cron orqali (nextChargeAt
    // sinov boshida +3kunga o'rnatilgan) — ikkalasi HAM resolveTrialEnd()ga
    // tushadi, shu bilan qaysi biri oldin tugasa o'sha ishlaydi.
    if (agent.isTrialAgent) {
      const limit = trialMessageLimit();
      // Atomik: faqat limitdan PAST bo'lsa oshiramiz. count===0 → limit to'ldi
      // (parallel xabarlar ham aynan bittasini "oxirgi" qiladi, chegara oshib
      // ketmaydi). count>0 → sinov davom etadi, shu xabar o'tadi.
      const bumped = await this.prisma.agent.updateMany({
        where: { id: agent.id, isTrialAgent: true, trialMessageCount: { lt: limit } },
        data: { trialMessageCount: { increment: 1 } },
      });
      if (bumped.count === 0) {
        agent = await this.agentBilling.resolveTrialEnd(agent, user);
        if (agent.frozen) {
          throw new HttpException(this.frozenErrorPayload(agent), HttpStatus.PAYMENT_REQUIRED);
        }
        // Muvaffaqiyatli to'landi (oddiy oylik rejimga o'tdi) — shu xabar davom etadi.
      }
    }

    // LLM chaqiruvidan oldin kunlik/global limitni tekshiramiz
    await this.usage.consumeChat(user);
    const engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

    let data: any;
    try {
      ({ data } = await firstValueFrom(
        this.http.post(`${engineUrl}/agents/run`, {
          agent_definition: {
            agent_id: agent.id,
            name: agent.name,
            system_prompt: agent.systemPrompt,
            model: agent.model,
            tools: agent.toolsConfig,
            halal_filter_enabled: agent.halalFilterEnabled,
            memory_enabled: agent.memoryEnabled,
          },
          user_id: user.id,
          message,
        }),
      ));
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 422 && detail?.blocked) {
        throw new UnprocessableEntityException({ blocked: true, reason: detail.reason });
      }
      throw new BadGatewayException({ message: "Agent engine bilan aloqa yo'q", reason: 'engine_unavailable' });
    }

    // Conversation ga yozish — IDOR himoyasi + parallel-yozuv seriyalash.
    // Mijoz yuborgan conversationId FAQAT shu foydalanuvchiga tegishli bo'lsa
    // ishlatiladi (begona/mavjud-emas bo'lsa jimgina yangi suhbat ochiladi —
    // boshqa foydalanuvchi suhbatiga yozib bo'lmaydi, mavjud-emas id 500 bermaydi).
    const assistantContent = data.messages?.at(-1)?.content ?? '';
    const convId = await this.prisma.$transaction(async (tx) => {
      let id = conversationId;
      if (id) {
        const owned = await tx.conversation.findUnique({ where: { id }, select: { userId: true } });
        if (!owned || owned.userId !== user.id) id = undefined;
      }
      if (!id) {
        id = (await tx.conversation.create({ data: { userId: user.id, agentId: agent.id, messages: [] } })).id;
      }
      // Bir suhbat bo'yicha advisory lock — parallel xabarlar read-modify-write'da
      // bir-birini o'chirmasligi uchun.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CONVERSATION_APPEND_LOCK_NS}::int, hashtext(${id}))`;
      const existing = await tx.conversation.findUnique({ where: { id }, select: { messages: true } });
      const messages = (existing?.messages as any[]) ?? [];
      messages.push(
        { role: 'user', content: message, timestamp: new Date().toISOString() },
        { role: 'assistant', content: assistantContent, halalFlag: data.halal_flag, timestamp: new Date().toISOString() },
      );
      await tx.conversation.update({ where: { id }, data: { messages } });
      return id;
    });

    return { ...data, conversationId: convId };
  }
}
