import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ServiceUnavailableException,
  BadGatewayException,
  UnprocessableEntityException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { UsageService } from '../usage/usage.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { priceForAgent, usdUzsRate } from './agent-pricing';
import { AgentBillingService } from './agent-billing.service';
import { BillingService } from '../billing/billing.service';
import { Prisma, type User } from '@prisma/client';

// Agent-yaratish advisory-lock nommaydoni (foydalanuvchi bo'yicha kalit bilan
// birga ishlatiladi — bir foydalanuvchining parallel yaratishlari seriyalashadi).
const AGENT_CREATE_LOCK_NS = 4772;
// Suhbatga xabar qo'shishni bir suhbat bo'yicha seriyalash uchun (parallel
// xabarlar JSON massivda bir-birini o'chirib yubormasligi uchun).
const CONVERSATION_APPEND_LOCK_NS = 4779;

// Sinov shartlari (FAQAT foydalanuvchining birinchi agenti): 3 kun YOKI 20
// xabar — qaysi biri oldin tugasa. Kod o'zgartirilmasdan sozlash uchun env.
export function trialDays(): number {
  const v = Number(process.env.TRIAL_DAYS);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 3;
}
export function trialMessageLimit(): number {
  const v = Number(process.env.TRIAL_MESSAGE_LIMIT);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 20;
}

/** $transaction ichidan tashqariga balans yetmasligini signal qilish uchun. */
class InsufficientBalanceError extends Error {
  constructor(public readonly creationPriceSom: number) {
    super('insufficient_balance');
  }
}

/** Oy qo'shish — kalendar oyi asosida (28/30/31 kunlik farqlarni to'g'ri hisoblaydi). */
export function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditLogService,
    private readonly usage: UsageService,
    private readonly agentBilling: AgentBillingService,
    private readonly billing: BillingService,
  ) {}

  /**
   * `priceOverride` — FAQAT ichki, ishonchli chaqiruvchilar uchun (masalan
   * TemplatesService.install() — kuratorlik qilingan shablon katalogi narxi
   * bilan). HTTP orqali (CreateAgentDto) hech qachon kelmaydi — shu bilan
   * foydalanuvchi o'z narxini pastlatib qo'ya olmaydi.
   */
  async create(
    user: User,
    dto: CreateAgentDto,
    priceOverride?: { creationUsd: number; monthlyUsd: number },
  ) {
    // Pul bilan ishlaydigan amal — bir xil so'rov ikki marta yuborilsa
    // (masalan ikki marta bosilsa) IKKINCHI marta yechilmasligi shart.
    // Idempotency-kalit orqali oldindan tekshiramiz: agar shu kalit bilan
    // avval muvaffaqiyatli yaratilgan agent bo'lsa — o'shani qaytaramiz.
    if (dto.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(dto.idempotencyKey);
      if (existing) return existing;
    }

    // Narx SERVERDA qayta hisoblanadi (mijozdan kelgan summaga ishonilmaydi).
    const fxRate = usdUzsRate();
    const price = priceOverride
      ? {
          creationSom: Math.round(priceOverride.creationUsd * fxRate),
          monthlySom: Math.round(priceOverride.monthlyUsd * fxRate),
        }
      : (() => {
          const p = priceForAgent(dto.complexity ?? 1, (dto.toolsConfig ?? []).length, fxRate);
          return { creationSom: p.creationSom, monthlySom: p.monthlySom };
        })();
    const creationPriceTiyin = price.creationSom * 100;
    const monthlyPriceTiyin = price.monthlySom * 100;

    let agent;
    try {
      agent = await this.prisma.$transaction(async (tx) => {
        // Tarif chegarasi — "tekshir-keyin-yarat" ATOMIK bo'lishi shart. Aks holda
        // ikki parallel so'rov ikkalasi ham count'ni chegaradan past ko'rib, limit+1
        // agent yaratadi. Foydalanuvchi bo'yicha advisory lock — aynan shu
        // foydalanuvchining parallel yaratishlari seriyalashadi (boshqalar bloklanmaydi).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AGENT_CREATE_LOCK_NS}::int, hashtext(${user.id}))`;
        await this.usage.assertCanCreateAgent(user, tx);

        if (creationPriceTiyin > 0) {
          const updated = await tx.user.updateMany({
            where: { id: user.id, balanceTiyin: { gte: creationPriceTiyin } },
            data: { balanceTiyin: { decrement: creationPriceTiyin } },
          });
          if (updated.count === 0) throw new InsufficientBalanceError(price.creationSom);
        }

        // Sinov — FAQAT foydalanuvchining ENG BIRINCHI agenti (lock ostida
        // hisoblangani uchun parallel so'rovlarda ham faqat bittasi "birinchi"
        // bo'lib chiqadi). 2-va-keyingi agentlar to'g'ridan-to'g'ri oddiy oylik
        // rejimga o'tadi (foydalanuvchi allaqachon qiymatni ko'rgan).
        const existingCount = await tx.agent.count({ where: { userId: user.id } });
        const isFirstAgent = existingCount === 0;

        const now = new Date();
        const created = await tx.agent.create({
          data: {
            name: dto.name,
            systemPrompt: dto.systemPrompt,
            model: dto.model ?? 'claude-sonnet-5',
            halalFilterEnabled: dto.halalFilterEnabled ?? true,
            memoryEnabled: dto.memoryEnabled ?? true,
            toolsConfig: (dto.toolsConfig ?? []) as object,
            vertical: dto.vertical ?? null,
            description: dto.description ?? null,
            templateId: dto.templateId ?? null,
            userId: user.id,
            creationPriceTiyin,
            monthlyPriceTiyin,
            isTrialAgent: isFirstAgent && monthlyPriceTiyin > 0,
            trialStartedAt: isFirstAgent && monthlyPriceTiyin > 0 ? now : null,
            nextChargeAt:
              monthlyPriceTiyin > 0
                ? isFirstAgent
                  ? addDays(now, trialDays())
                  : addMonths(now, 1)
                : null,
          },
        });

        if (creationPriceTiyin > 0 || dto.idempotencyKey) {
          const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { balanceTiyin: true } });
          await tx.creditLedger.create({
            data: {
              userId: user.id,
              kind: 'agent_creation',
              amount: -creationPriceTiyin,
              balanceAfter: fresh.balanceTiyin,
              meta: { agentId: created.id, creationPriceSom: price.creationSom, monthlyPriceSom: price.monthlySom },
              idempotencyKey: dto.idempotencyKey ?? undefined,
            },
          });
        }

        return created;
      });
    } catch (e: any) {
      if (e instanceof InsufficientBalanceError) {
        throw new HttpException(
          {
            message: `Balansingiz yetarli emas. Agent yaratish narxi: ${e.creationPriceSom.toLocaleString('ru-RU')} so'm. Hisobingizni to'ldiring.`,
            reason: 'insufficient_balance',
            creationPriceSom: e.creationPriceSom,
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      // Parallel so'rov bir xil idempotency-kalit bilan g'olib keldi — o'sha natijani qaytaramiz
      if (dto.idempotencyKey && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const winner = await this.findByIdempotencyKey(dto.idempotencyKey);
        if (winner) return winner;
      }
      throw e;
    }

    await this.audit.record({
      actorId: user.id,
      action: 'agent.create',
      resourceType: 'agent',
      resourceId: agent.id,
      metadata: { creationPriceTiyin, monthlyPriceTiyin },
    });
    return agent;
  }

  private async findByIdempotencyKey(idempotencyKey: string) {
    const ledger = await this.prisma.creditLedger.findUnique({ where: { idempotencyKey } });
    const agentId = (ledger?.meta as any)?.agentId;
    if (!agentId) return null;
    return this.prisma.agent.findUnique({ where: { id: agentId } });
  }

  /**
   * Y9: bir-klik agent — tabiiy til tavsifidan bitta tayyor agent TAKLIFI
   * (nom, system-prompt, tool'lar) + narx. Agent YARATILMAYDI; foydalanuvchi
   * ko'rib, tasdiqlagach mavjud create() orqali yaratiladi. Texnik sozlash yo'q.
   */
  async compose(user: User, description: string, language?: string) {
    const engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';
    const lang = language ?? user.preferredLanguage ?? 'en';

    let data: any;
    try {
      const res = await firstValueFrom(
        this.http.post(`${engineUrl}/agents/compose`, {
          description,
          language: lang,
          profession: user.professionTitle ?? '',
        }),
      );
      data = res.data;
    } catch (e: any) {
      // Halal Filter bloki engine'da 422 qaytaradi — tushunarli xato beramiz
      if (e?.response?.status === 422) {
        throw new BadRequestException(
          e.response.data?.detail ?? { message: "So'rovni qayta ifodalab ko'ring." },
        );
      }
      throw new ServiceUnavailableException({
        message: "Agent kompozitori hozir mavjud emas. Birozdan keyin qayta urinib ko'ring.",
        reason: 'engine_unavailable',
      });
    }

    const tools: Array<{ tool_id: string; config: Record<string, unknown> }> = data.tools ?? [];
    const price = priceForAgent(data.complexity ?? 3, tools.length, usdUzsRate());

    // POST /api/agents (CreateAgentDto) bilan mos "taklif" — tasdiqlangach shu yuboriladi.
    const proposal = {
      name: data.name,
      systemPrompt: data.system_prompt,
      model: data.model ?? 'claude-sonnet-5',
      toolsConfig: tools,
      ...(data.vertical ? { vertical: data.vertical } : {}),
      ...(data.reasoning ? { description: String(data.reasoning).slice(0, 300) } : {}),
      halalFilterEnabled: true,
      memoryEnabled: true,
    };

    return {
      proposal,
      meta: {
        domain: data.domain,
        vertical: data.vertical ?? null,
        complexity: price.complexity,
        reasoning: data.reasoning ?? '',
        method: data.method, // "llm" | "heuristic"
        matched: data.matched ?? null, // "custom_llm" | "domain_template" | null
        toolIds: tools.map((t) => t.tool_id),
        language: lang,
      },
      price,
    };
  }

  async findAll(user: User) {
    return this.prisma.agent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: User) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException('Agent topilmadi');
    if (agent.userId !== user.id) throw new ForbiddenException();
    return agent;
  }

  /**
   * Ishonch-jurnali — shu agent bo'yicha AuditLog'dagi barcha yozuvlar.
   * Faqat egasi ko'ra oladi (findOne bilan bir xil tekshiruv). Xom xash-zanjir
   * ko'rsatilmaydi — faqat foydalanuvchiga tegishli harakat+kontekst.
   */
  async trustLog(id: string, user: User) {
    await this.findOne(id, user);
    const entries = await this.prisma.auditLog.findMany({
      where: { resourceType: 'agent', resourceId: id },
      orderBy: { createdAt: 'asc' },
      select: { action: true, metadata: true, createdAt: true },
    });
    return entries;
  }

  async update(id: string, user: User, dto: UpdateAgentDto) {
    await this.findOne(id, user);
    return this.prisma.agent.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.systemPrompt && { systemPrompt: dto.systemPrompt }),
        ...(dto.model && { model: dto.model }),
        ...(dto.halalFilterEnabled !== undefined && { halalFilterEnabled: dto.halalFilterEnabled }),
        ...(dto.memoryEnabled !== undefined && { memoryEnabled: dto.memoryEnabled }),
        ...(dto.toolsConfig && { toolsConfig: dto.toolsConfig as object }),
        ...(dto.vertical !== undefined && { vertical: dto.vertical }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isPublished !== undefined && { isPublished: dto.isPublished }),
        ...(dto.marketplacePrice !== undefined && { marketplacePrice: dto.marketplacePrice }),
      },
    });
  }

  async remove(id: string, user: User) {
    await this.findOne(id, user);
    await this.prisma.agent.delete({ where: { id } });
    await this.audit.record({ actorId: user.id, action: 'agent.delete', resourceType: 'agent', resourceId: id });
  }

  /**
   * Balans to'ldirilgandan keyin — muzlatilgan agentni qayta faollashtirish.
   * Darhol qarzdor oylik siklni yechishga urinadi; muvaffaqiyatli bo'lsa
   * frozen=false bo'ladi, aks holda aniq 402 xato (hali ham yetarli emas).
   */
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

  async reactivate(id: string, user: User) {
    const agent = await this.findOne(id, user);
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
    let agent = await this.findOne(id, user);
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

    // PUL HIMOYASI — LLM chaqiruvidan OLDIN balansdan yechamiz (BFF stream
    // yo'li bilan bir xil prepaid model). Ilgari bu yo'l (`POST /agents/:id/run`
    // + Telegram bot) faqat consumeChat'ni chaqirar, chargeForMessage'ni EMAS —
    // ya'ni har qanday tokenli foydalanuvchi bepul LLM olishi mumkin edi
    // (billing butunlay chetlab o'tilardi). Balans yetmasa 402 tashlanadi va
    // engine'ga so'rov umuman ketmaydi. Xizmat bajarilmasa — pul qaytariladi.
    await this.billing.chargeForMessage(user, { agentId: agent.id, via: 'run' });
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
      // Javob berilmadi (halal-blok yoki engine xatosi) — yechilgan pulni qaytaramiz.
      await this.billing.refund(user, 'agent_run_failed').catch(() => undefined);
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
