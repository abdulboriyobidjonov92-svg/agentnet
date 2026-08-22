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
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { Readable } from 'node:stream';
import { paginate, type PageQuery } from '../common/pagination/paginate';
import { somToTiyin, tiyinToSom } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { UsageService } from '../usage/usage.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { priceForAgent, usdUzsRate } from './agent-pricing';
import { AgentBillingService } from './agent-billing.service';
import { BillingService } from '../billing/billing.service';
import { ConnectorsService, CONNECTOR_TOOL_PREFIX } from '../connectors/connectors.service';
import { effectivePlanOf } from '../usage/usage.service';
import { EventActor, ExecutionEventType, Prisma, type AgentFrozenReason, type User } from '@prisma/client';
import { ExecutionEventBus } from '../events/execution-event-bus.service';
import { ExecutionRunService } from '../events/execution-run.service';
import { tapExecutionTrace } from '../events/execution-trace-tap';
import { MeteringService } from '../metering/metering.service';

// Agent-yaratish advisory-lock nommaydoni (foydalanuvchi bo'yicha kalit bilan
// birga ishlatiladi — bir foydalanuvchining parallel yaratishlari seriyalashadi).
// EXPORT: onboarding'ning installRecommendations() ham AYNAN shu lock bilan
// seriyalashadi — aks holda manual create + batch-install parallel ishlab
// agent-chegarasidan oshib ketishi mumkin edi.
export const AGENT_CREATE_LOCK_NS = 4772;
// A15: ilgari bu yerda CONVERSATION_APPEND_LOCK_NS (4779) advisory-lock
// nommaydoni bor edi — JSON massivga read-modify-write yozuvni seriyalash
// uchun. `Message` jadvaliga o'tilgach append = mustaqil INSERT, lock va
// nommaydon butunlay olib tashlandi (Rule #38: o'lik kod qoldirilmaydi).

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
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditLogService,
    private readonly usage: UsageService,
    private readonly agentBilling: AgentBillingService,
    private readonly billing: BillingService,
    private readonly connectors: ConnectorsService,
    /** P0-13 — ijro hodisalari shinasi (UI-4 chat qadamlari shundan keladi). */
    private readonly traceBus: ExecutionEventBus,
    /** P0-7 — run yozuvini ochadi/yopadi. */
    private readonly traceRuns: ExecutionRunService,
    /** P0-5 — har LLM chaqiruvi o'lchanadi (shadow rejim, ADR-023). */
    private readonly metering: MeteringService,
  ) {}

  /**
   * Agent taʼrifiga foydalanuvchining ULANGAN konnektorlarini qo'shadi.
   *
   * Nega kerak: `agentDefinition.tools` faqat `Agent.toolsConfig` (yaratishda
   * tanlangan tool_id'lar) dan keladi — ulangan konnektorlar u yerda umuman
   * uchramaydi, shuning uchun model ular haqida BILMAS edi. Endi ular har
   * so'rovda serverdan qo'shiladi (DB — yagona haqiqat manbai).
   *
   * Mijoz yuborgan `connector.*` yozuvlari OLIB TASHLANADI: bu ro'yxat
   * "agent qaysi konnektorga haqli" degan avtorizatsiya qarori va u faqat
   * serverda hal bo'ladi (aks holda mijoz o'zi biriktirmagan konnektorni
   * ro'yxatga qo'shib ko'rardi).
   */
  private async withConnectorTools(
    user: User,
    agentDefinition: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const agentId = typeof agentDefinition.agent_id === 'string' ? agentDefinition.agent_id : undefined;
    const declared = Array.isArray(agentDefinition.tools) ? agentDefinition.tools : [];
    const own = declared.filter(
      (t: any) => typeof t?.tool_id === 'string' && !t.tool_id.startsWith(CONNECTOR_TOOL_PREFIX),
    );
    const connectorTools = await this.connectors.toolSpecsForAgent(user, agentId);
    return { ...agentDefinition, tools: [...own, ...connectorTools] };
  }

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
    // A13: pul yo'li BOSHIDAN `bigint` — Prisma BigInt ustunga `number` ni ham
    // qabul qiladi, ya'ni bu yerda number qoldirilsa aralashuv KOMPILYATSIYADA
    // ko'rinmasdan o'tib ketardi.
    const creationPriceTiyin = somToTiyin(price.creationSom);
    const monthlyPriceTiyin = somToTiyin(price.monthlySom);

    let agent;
    // Tranzaksiya ICHIDA hisoblanadi (u yerda `isFirstAgent` ma'lum), lekin
    // auditga tashqarida kerak. `agent.creationPriceTiyin` dan o'qish
    // mumkin emas edi: `create` mock/select natijasida bu ustun bo'lmasligi
    // mumkin va audit jimgina yiqilardi.
    let chargedCreationTiyin = 0n;
    try {
      agent = await this.prisma.$transaction(async (tx) => {
        // Tarif chegarasi — "tekshir-keyin-yarat" ATOMIK bo'lishi shart. Aks holda
        // ikki parallel so'rov ikkalasi ham count'ni chegaradan past ko'rib, limit+1
        // agent yaratadi. Foydalanuvchi bo'yicha advisory lock — aynan shu
        // foydalanuvchining parallel yaratishlari seriyalashadi (boshqalar bloklanmaydi).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AGENT_CREATE_LOCK_NS}::int, hashtext(${user.id}))`;
        await this.usage.assertCanCreateAgent(user, tx);

        // Sinov — FAQAT foydalanuvchining ENG BIRINCHI agenti (lock ostida
        // hisoblangani uchun parallel so'rovlarda ham faqat bittasi "birinchi"
        // bo'lib chiqadi). 2-va-keyingi agentlar to'g'ridan-to'g'ri oddiy oylik
        // rejimga o'tadi (foydalanuvchi allaqachon qiymatni ko'rgan).
        //
        // ⚠️ HISOB PUL YECHISHDAN OLDIN: birinchi agentning YARATISH narxi ham
        // kechiriladi (pastga qarang), ya'ni "birinchimi?" savoliga javob
        // charge'dan oldin kerak.
        const existingCount = await tx.agent.count({ where: { userId: user.id } });
        const isFirstAgent = existingCount === 0;

        // ============================================================
        // UI-2 — BIRINCHI AGENTNING YARATISH NARXI KECHIRILADI.
        //
        // MUAMMO: yangi foydalanuvchining balansi 0 (`User.balanceTiyin`
        // default). Generik narxlash yaratishni allaqachon bepul qiladi
        // (`priceForAgent` → `creationUsd: 0`), LEKIN shablon o'rnatish
        // katalog narxini ANIQ uzatadi (`createUsd: 70`) — natijada
        // onboarding'ning shablon yo'li BIRINCHI qadamda 402 bilan
        // to'xtardi va foydalanuvchi hech qachon birinchi natijani
        // ko'rmasdi (PRICING §4: eng ko'p yo'qotiladigan qadam).
        //
        // Bu — mavjud NIYATNING davomi: platforma allaqachon birinchi
        // agentni sinov deb belgilaydi (`isTrialAgent`, 3 kun / 20 xabar).
        // Oylik to'lovni kechirib, yaratish uchun $70 talab qilish o'sha
        // niyatga zid edi. Sinov tugagach oddiy oylik rejim ishlaydi —
        // daromad YO'QOLMAYDI, kechikadi.
        //
        // Qaror: founder, 2026-08-17 (DECISION_LOG).
        // ============================================================
        const chargeableCreationTiyin = isFirstAgent ? 0n : creationPriceTiyin;
        chargedCreationTiyin = chargeableCreationTiyin;

        if (chargeableCreationTiyin > 0n) {
          const updated = await tx.user.updateMany({
            where: { id: user.id, balanceTiyin: { gte: chargeableCreationTiyin } },
            data: { balanceTiyin: { decrement: chargeableCreationTiyin } },
          });
          if (updated.count === 0) throw new InsufficientBalanceError(price.creationSom);
        }

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
            // HAQIQATAN yechilgan summa yoziladi (kechirilgan bo'lsa 0) —
            // aks holda agent yozuvi ledger bilan zid bo'lardi.
            creationPriceTiyin: chargeableCreationTiyin,
            monthlyPriceTiyin,
            isTrialAgent: isFirstAgent && monthlyPriceTiyin > 0n,
            trialStartedAt: isFirstAgent && monthlyPriceTiyin > 0n ? now : null,
            nextChargeAt:
              monthlyPriceTiyin > 0n
                ? isFirstAgent
                  ? addDays(now, trialDays())
                  : addMonths(now, 1)
                : null,
          },
        });

        // Ledger HAQIQATAN yechilgan summani yozadi. `creationPriceTiyin`
        // (katalog narxi) yozilsa, birinchi agentda jurnal "−70" deb
        // ko'rsatib, balans o'zgarmagan bo'lardi — jurnal balans bilan zid
        // (Konstitutsiya #17/#18). Kechirilgani `meta` da OCHIQ qoladi.
        if (chargeableCreationTiyin > 0n || dto.idempotencyKey) {
          const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { balanceTiyin: true } });
          await tx.creditLedger.create({
            data: {
              userId: user.id,
              kind: 'agent_creation',
              amount: -chargeableCreationTiyin,
              balanceAfter: fresh.balanceTiyin,
              meta: {
                agentId: created.id,
                creationPriceSom: price.creationSom,
                monthlyPriceSom: price.monthlySom,
                ...(isFirstAgent && creationPriceTiyin > 0n
                  ? { waivedCreationSom: price.creationSom, waivedReason: 'first_agent_trial' }
                  : {}),
              },
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
      metadata: {
        // Katalog narxi (nima turishi kerak edi) va HAQIQATAN yechilgani —
        // ikkalasi ham yoziladi, aks holda kechirilgan holat auditda
        // "narx 0 edi" bo'lib ko'rinardi va sababi yo'qolardi.
        creationPriceTiyin: creationPriceTiyin.toString(),
        chargedCreationTiyin: chargedCreationTiyin.toString(),
        monthlyPriceTiyin: monthlyPriceTiyin.toString(),
        ...(creationPriceTiyin > 0n && chargedCreationTiyin === 0n
          ? { waivedReason: 'first_agent_trial' }
          : {}),
      },
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

  /** Phase 3: kursorli pagination shartnomasi (Konstitutsiya #24). */
  async findAll(user: User, page: PageQuery = {}) {
    return paginate(
      this.prisma.agent,
      {
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      },
      page,
    );
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
    // @upstream-scope: egalik BIR QATOR YUQORIDA allaqachon tekshirilgan —
    // findOne() `agent.userId !== user.id` bo'lsa ForbiddenException tashlaydi.
    // Quyidagi so'rov `id`ga (allaqachon tasdiqlangan agent) tayanadi, `userId`
    // maydonining o'ziga emas.
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
  private frozenErrorPayload(agent: { name: string; monthlyPriceTiyin: bigint; frozenReason: AgentFrozenReason | null }) {
    if (agent.frozenReason === 'trial_expired') {
      return {
        message: `"${agent.name}" agentining sinov muddati tugadi (${trialDays()} kun yoki ${trialMessageLimit()} xabar). Davom etish uchun oylik to'lovni amalga oshiring (${tiyinToSom(agent.monthlyPriceTiyin).toLocaleString('ru-RU')} so'm/oy).`,
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
          message: `Balansingiz hali ham yetarli emas. Oylik narx: ${tiyinToSom(fresh.monthlyPriceTiyin).toLocaleString('ru-RU')} so'm. Hisobingizni to'ldiring.`,
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

    // PUL HIMOYASI — LLM chaqiruvidan OLDIN balansdan yechamiz (BFF stream
    // yo'li bilan bir xil prepaid model). Ilgari bu yo'l (`POST /agents/:id/run`
    // + Telegram bot) faqat consumeChat'ni chaqirar, chargeForMessage'ni EMAS —
    // ya'ni har qanday tokenli foydalanuvchi bepul LLM olishi mumkin edi
    // (billing butunlay chetlab o'tilardi). Balans yetmasa 402 tashlanadi va
    // engine'ga so'rov umuman ketmaydi. Xizmat bajarilmasa — pul qaytariladi.
    //
    // TARTIB (M6): avval PUL, keyin RATE-LIMIT. Ilgari consumeChat birinchi
    // edi — charge 402 bo'lsa kunlik/global hisoblagich oshirilganicha qolardi
    // (balanssiz foydalanuvchi kvota/global limitni bekorga yeb bitirardi).
    await this.billing.chargeForMessage(user, { agentId: agent.id, via: 'run' });

    // Endi kunlik/global limit. Pul allaqachon yechilgani uchun, 429 bo'lsa
    // yechilgan pulni qaytaramiz (foydalanuvchi xizmat olmay pul yo'qotmasin).
    try {
      await this.usage.consumeChat(user);
    } catch (e) {
      await this.billing.refund(user, 'rate_limited').catch(() => undefined);
      throw e;
    }
    const engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

    // Stream yo'li bilan bir xil: ulangan konnektorlar tool sifatida qo'shiladi.
    const agentDefinition = await this.withConnectorTools(user, {
      agent_id: agent.id,
      name: agent.name,
      system_prompt: agent.systemPrompt,
      model: agent.model,
      tools: agent.toolsConfig,
      halal_filter_enabled: agent.halalFilterEnabled,
      memory_enabled: agent.memoryEnabled,
    });

    let data: any;
    try {
      ({ data } = await firstValueFrom(
        this.http.post(`${engineUrl}/agents/run`, {
          agent_definition: agentDefinition,
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

    // Conversation ga yozish — IDOR himoyasi. Mijoz yuborgan conversationId
    // FAQAT shu foydalanuvchiga tegishli bo'lsa ishlatiladi (begona/mavjud-emas
    // bo'lsa jimgina yangi suhbat ochiladi — boshqa foydalanuvchi suhbatiga
    // yozib bo'lmaydi, mavjud-emas id 500 bermaydi).
    //
    // A15: JSON davridagi o'qi-o'zgartir-yoz sikli va u talab qilgan advisory
    // lock YO'QOLDI — har xabar mustaqil INSERT (`Message` jadvali), parallel
    // yozuvlar bir-birini o'chira olmaydi. Juftlik tartibi: ketma-ket create,
    // teng timestamp'da cuid (jarayon ichida monotonik) teng-buzuvchi.
    const assistantContent = data.messages?.at(-1)?.content ?? '';
    const convId = await this.prisma.$transaction(async (tx) => {
      let id = conversationId;
      if (id) {
        const owned = await tx.conversation.findUnique({ where: { id }, select: { userId: true } });
        if (!owned || owned.userId !== user.id) id = undefined;
      }
      if (!id) {
        id = (await tx.conversation.create({ data: { userId: user.id, agentId: agent.id } })).id;
      }
      await tx.message.create({
        data: { conversationId: id, role: 'user', content: message },
      });
      await tx.message.create({
        data: { conversationId: id, role: 'assistant', content: assistantContent, halalFlag: data.halal_flag ?? null },
      });
      // Suhbat ro'yxati "oxirgi faollik" bo'yicha tartiblanadi.
      await tx.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
      return id;
    });

    return { ...data, conversationId: convId };
  }

  /**
   * SEC-10 — chat SSE oqimini engine'dan OCHADI (proxy uchun).
   *
   * NEGA API orqali: engine endi Render'da **private service** (ADR-004), ya'ni
   * Render xususiy tarmog'idan tashqarida ko'rinmaydi. Frontend esa Vercel'da
   * turadi (ADR-021) — u engine'ga TO'G'RIDAN-TO'G'RI yeta olmaydi. Shuning
   * uchun oqim endi: brauzer -> Vercel BFF -> Render API -> Render engine.
   *
   * Bu metod ATAYLAB "yupqa": pul va kvota mantiqi (charge -> consume ->
   * refund zanjiri) BFF'da qoladi va bir zarrada ham o'zgarmaydi — u
   * allaqachon ishlab turgan, testlangan va SEC-10 doirasidan tashqari.
   * Bu yerda faqat tarmoq-hop qo'shiladi.
   *
   * Xatolik (engine o'lik / 5xx / halal-blok) — istisno sifatida yuqoriga
   * chiqadi; controller uni 5xx'ga aylantiradi, BFF esa `!upstream.ok`
   * ko'rib pulni QAYTARADI (mavjud `engine_error` yo'li).
   */
  async openChatStream(
    user: User,
    dto: {
      agentDefinition: Record<string, unknown>;
      message: string;
      conversationId?: string;
      conversationHistory?: Array<Record<string, unknown>>;
      profession?: string;
      /** UI-4: qaysi agent (iz uchun). BFF uzatadi, egalik shu yerda tekshiriladi. */
      agentId?: string;
    },
  ): Promise<{ stream: Readable; runId: string | null }> {
    const engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

    // Ulangan konnektorlar tool sifatida shu yerda qo'shiladi — mijoz emas,
    // server hal qiladi (withConnectorTools izohiga qarang).
    const agentDefinition = await this.withConnectorTools(user, dto.agentDefinition);

    // `x-internal-token` avtomatik qo'shiladi (installEngineAuthInterceptor —
    // yagona axios interceptor barcha engine chaqiruvlarini qamrab oladi).
    const res = await firstValueFrom(
      this.http.post(
        `${engineUrl}/agents/stream`,
        {
          agent_definition: agentDefinition,
          // MUHIM: `user_id` body'dan EMAS, autentifikatsiyalangan
          // foydalanuvchidan olinadi. Ilgari BFF uni o'zi uzatardi; endi
          // uni umuman so'ramaymiz — "boshqa foydalanuvchi nomidan engine'ga
          // borish" yuzasi butunlay yopiladi.
          user_id: user.id,
          message: dto.message,
          conversation_id: dto.conversationId ?? null,
          conversation_history: dto.conversationHistory ?? null,
          profession: dto.profession ?? '',
          // Qaysi model zanjiri: free -> OpenRouter bepul modellari,
          // pullik -> Anthropic. Qaror SERVERDA, foydalanuvchi tarifidan
          // olinadi — mijoz uni yubormaydi va o'zgartira olmaydi.
          tier: effectivePlanOf(user) === 'free' ? 'free' : 'paid',
        },
        { responseType: 'stream' },
      ),
    );

    const upstream = res.data as Readable;

    // ============================================================
    // P0-7/P0-13 — IJRO IZI.
    //
    // Oqim "eshitiladi" va kanonik hodisalarga o'giriladi; baytlar
    // O'ZGARMASDAN o'tadi (`tapExecutionTrace`). Chat oqimi — pul va
    // halal-filter yo'li, shuning uchun iz uni HECH QACHON to'xtatmaydi:
    // har xato yutiladi va oqim davom etadi (fail-open).
    //
    // `runId` chaqiruvchiga QAYTARILADI (sarlavha emas, hodisa sifatida
    // kontroller yozadi) — BFF oqimni qayta o'raydi va sarlavhalarni
    // tanlab uzatadi, hodisa esa o'zgarishsiz o'tadi.
    // ============================================================
    // ⚠️ MANBA — `dto.agentId` (BFF uzatadi), `agentDefinition` EMAS.
    //
    // `agentDefinition` mijoz quradigan obyekt: undagi `agent_id` ga ishonib
    // iz yozilsa, foydalanuvchi BEGONA agent nomiga hodisa yozdira olardi.
    // `dto.agentId` esa quyida egalik bilan tekshiriladi (IDOR himoyasi).
    const agentId = dto.agentId ?? null;
    if (!agentId) return { stream: upstream, runId: null };

    let run: { id: string };
    try {
      // Egalik: begona agentga iz yozib bo'lmaydi.
      const owned = await this.prisma.agent.findFirst({
        where: { id: agentId, userId: user.id },
        select: { id: true },
      });
      if (!owned) return { stream: upstream, runId: null };

      run = await this.traceRuns.createRun({
        userId: user.id,
        agentId,
        conversationId: dto.conversationId ?? null,
      });
    } catch (e: any) {
      // Iz ochilmadi — chat baribir ishlaydi, faqat qadamlar ko'rinmaydi.
      this.logger.warn(`Ijro izi ochilmadi: ${e?.message}`);
      return { stream: upstream, runId: null };
    }

    void this.traceBus.emit({
      runId: run.id,
      agentId,
      tenantId: user.id,
      type: ExecutionEventType.RUN_STARTED,
      actor: EventActor.user,
      payload: { conversationId: dto.conversationId ?? null },
    });

    return {
      stream: tapExecutionTrace({
        source: upstream,
        bus: this.traceBus,
        runs: this.traceRuns,
        runId: run.id,
        agentId,
        tenantId: user.id,
        conversationId: dto.conversationId ?? null,
        metering: this.metering,
      }),
      runId: run.id,
    };
  }
}
