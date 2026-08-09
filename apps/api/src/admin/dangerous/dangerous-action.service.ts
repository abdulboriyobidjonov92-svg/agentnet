import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DangerousActionKind,
  DangerousActionStatus,
  Prisma,
  UserRole,
  type DangerousAction,
  type User,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService, TwoFactorService } from '../../auth/auth.service';
import { outranks } from '../../auth/role-rank';
import { WalletCreditService } from '../../billing/wallet-credit.service';
import { AdminAlertService } from './admin-alert.service';
import {
  ADMIN_DAILY_CREDIT_CAP_TIYIN,
  APPROVAL_WINDOW_MS,
  CREDIT_CAP_WINDOW_MS,
  DANGEROUS_ACTIONS,
  MAX_SINGLE_CREDIT_TIYIN,
  expectedConfirmation,
} from './dangerous-action.registry';
import type {
  ConfirmDangerousActionDto,
  CreateDangerousActionDto,
} from './dto/dangerous-action.dto';

/**
 * Qo'lda kredit kunlik chegarasini seriyalash uchun advisory-lock nommaydoni.
 * Band bo'lganlar: 4771 audit, 4772 agent yaratish, 4773 oylik, 4774
 * marketplace, 4775 trial.
 */
const CREDIT_CAP_LOCK_NS = 4776;

/**
 * SEC-11 §6.5 — xavfli amallar frameworki.
 *
 * BARCHA xavfli amallar SHU servisdan o'tadi. Har oqim bosqichi shu yerda
 * bir marta yozilgan, ya'ni yangi amal qo'shganda uni "unutib qoldirib"
 * bo'lmaydi (registrga qo'shish yetarli).
 *
 * IKKI BOSQICH:
 *   1. `request()` — sabab + TOTP + yozib tasdiqlash tekshiriladi,
 *      `pending` yozuv yaratiladi, `intent` audit yoziladi, OWNER'ga signal.
 *   2. `execute()` — TOTP QAYTA tekshiriladi, amal bajariladi,
 *      `result` audit yoziladi, yozuv `executed` bo'ladi.
 * Yoki `cancel()` — `pending` yozuv `cancelled` bo'ladi.
 *
 * HOLAT MASHINASI (server tomonda majburlanadi):
 *   pending --execute--> executed
 *   pending --cancel----> cancelled
 *   pending --(vaqt)----> expired
 * Boshqa har qanday o'tish rad etiladi.
 */
@Injectable()
export class DangerousActionService {
  private readonly logger = new Logger(DangerousActionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twoFactor: TwoFactorService,
    private readonly audit: AuditLogService,
    private readonly alerts: AdminAlertService,
    // SEC-12: pul yo'li MAVJUD atomik servisdan o'tadi (yangi balans
    // mutatsiyasi yozilmaydi — Contract §11).
    private readonly wallet: WalletCreditService,
  ) {}

  // ----------------------------------------------------------------
  // 1-BOSQICH — so'rov
  // ----------------------------------------------------------------

  async request(actor: User, dto: CreateDangerousActionDto): Promise<DangerousAction> {
    const spec = DANGEROUS_ACTIONS[dto.kind];

    // §6.1 — amal-darajasidagi avtorizatsiya (controller `@Roles` dan keyingi
    // IKKINCHI darvoza: `role_assign` faqat OWNER'da qoladi).
    if (!spec.allowedRoles.includes(actor.role)) {
      throw new ForbiddenException({
        message: "Bu xavfli amalni bajarish huquqingiz yo'q",
        reason: 'dangerous_action_forbidden',
      });
    }

    // §6.5(2) — TOTP. QAT'IY: 2FA yoqilgan bo'lishi SHART.
    await this.assertTotp(actor, dto.totp);

    // §6.5(3) — yozib tasdiqlash. Kutilgan satrni SERVER hisoblaydi.
    const expected = expectedConfirmation(dto.kind, dto.targetUserId);
    if (dto.confirmation.trim() !== expected) {
      throw new BadRequestException({
        message: `Tasdiqlash satri mos emas. Kutilgan: "${expected}"`,
        reason: 'confirmation_mismatch',
      });
    }

    const target = await this.prisma.user.findUnique({
      where: { id: dto.targetUserId },
      select: {
        id: true,
        email: true,
        role: true,
        twoFactorEnabled: true,
        blockedAt: true,
      },
    });
    if (!target) throw new NotFoundException('Nishon foydalanuvchi topilmadi');

    // Amalga xos oldindan-tekshiruvlar (o'zini ko'tarish, oxirgi OWNER, ...).
    const payload = await this.validateKind(dto, actor, target);

    const now = new Date();
    const action = await this.prisma.dangerousAction.create({
      data: {
        kind: dto.kind,
        actorId: actor.id,
        targetUserId: target.id,
        reason: dto.reason,
        payload: payload as Prisma.InputJsonValue,
        executableAfter: new Date(now.getTime() + spec.executionDelayMs),
        expiresAt: new Date(now.getTime() + APPROVAL_WINDOW_MS),
      },
    });

    // §6.5(4) — BIRINCHI audit yozuvi (`intent`), amaldan OLDIN.
    await this.audit.record({
      actorId: actor.id,
      action: `dangerous.${dto.kind}.intent`,
      resourceType: 'user',
      resourceId: target.id,
      metadata: {
        dangerousActionId: action.id,
        reason: dto.reason,
        ...payload,
      },
    });

    // §6.5(6) — OWNER kanaliga darhol signal.
    await this.alerts.dangerousActionRequested({
      kind: dto.kind,
      actorEmail: actor.email,
      targetEmail: target.email,
      reason: dto.reason,
      actionId: action.id,
    });

    return action;
  }

  // ----------------------------------------------------------------
  // 2-BOSQICH — bajarish
  // ----------------------------------------------------------------

  async execute(actor: User, actionId: string, dto: ConfirmDangerousActionDto) {
    // §6.5(2) — bajarish bosqichida TOTP QAYTA so'raladi (tasdiq 24 soat
    // yashagani uchun o'g'irlangan sessiya uni kodsiz ijro eta olmasin).
    await this.assertTotp(actor, dto.totp);

    const action = await this.loadForTransition(actor, actionId);

    // SEC-12 — BAJARISH SO'RAGAN ODAMGA BOG'LANADI.
    //
    // Ilgari (SEC-11) tasdiqni bir OWNER so'rab, boshqasi bajarishi mumkin
    // edi. Pul yo'li qo'shilgach bu ikki muammo beradi: (a) ADMIN kunlik
    // kredit chegarasi bajaruvchiga yozilib, ikki operator birgalikda uni
    // chetlab o'ta oladi; (b) sabab va TOTP bergan odam bilan ijro etgan
    // odam ajralib, "kim javobgar" savoli auditda ikkiga bo'linadi.
    //
    // BEKOR QILISH ATAYLAB OCHIQ QOLADI (`cancel()` da bu tekshiruv YO'Q):
    // §6.5(5) bekor qilish oynasini nazorat vositasi sifatida beradi —
    // OWNER boshqa operatorning kutilayotgan amalini to'xtata olishi SHART.
    if (action.actorId !== actor.id) {
      throw new ForbiddenException({
        message: "Amalni faqat uni so'ragan operator bajara oladi",
        reason: 'not_action_owner',
      });
    }

    if (action.executableAfter > new Date()) {
      throw new BadRequestException({
        message: 'Kutish muddati hali tugamagan',
        reason: 'execution_delay_active',
      });
    }

    // ATOMIK O'TISH: `pending -> executed` shartli UPDATE bilan. Ikki
    // parallel `execute` da faqat BITTASI `count: 1` oladi — ikkinchisi
    // 0 olib rad etiladi. Ya'ni takroriy/poyga bajarilish MUMKIN EMAS
    // (in-memory lock ishlatilmaydi — Contract A19).
    const claimed = await this.prisma.dangerousAction.updateMany({
      where: { id: action.id, status: DangerousActionStatus.pending },
      data: { status: DangerousActionStatus.executed, executedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new BadRequestException({
        message: "Amal allaqachon bajarilgan yoki bekor qilingan",
        reason: 'action_not_pending',
      });
    }

    let result: Record<string, unknown>;
    try {
      result = await this.perform(action, actor);
    } catch (e) {
      // Bajarish yiqildi — holatni `pending` ga QAYTARAMIZ, aks holda amal
      // "bajarilgan" ko'rinib qolardi, aslida esa hech narsa o'zgarmagan.
      await this.prisma.dangerousAction.updateMany({
        where: { id: action.id, status: DangerousActionStatus.executed },
        data: { status: DangerousActionStatus.pending, executedAt: null },
      });
      throw e;
    }

    // §6.5(4) — IKKINCHI audit yozuvi (`result`), amaldan KEYIN.
    await this.audit.record({
      actorId: actor.id,
      action: `dangerous.${action.kind}.result`,
      resourceType: 'user',
      resourceId: action.targetUserId,
      metadata: { dangerousActionId: action.id, reason: action.reason, ...result },
    });

    return { id: action.id, status: DangerousActionStatus.executed, ...result };
  }

  // ----------------------------------------------------------------
  // Bekor qilish
  // ----------------------------------------------------------------

  async cancel(actor: User, actionId: string) {
    const action = await this.loadForTransition(actor, actionId);

    // Atomik: `pending -> cancelled`. Bajarilgan/bekor qilingan amalni
    // bekor qilib bo'lmaydi (poygada ham).
    const cancelled = await this.prisma.dangerousAction.updateMany({
      where: { id: action.id, status: DangerousActionStatus.pending },
      data: {
        status: DangerousActionStatus.cancelled,
        cancelledAt: new Date(),
        cancelledById: actor.id,
      },
    });
    if (cancelled.count === 0) {
      throw new BadRequestException({
        message: "Amal allaqachon bajarilgan yoki bekor qilingan",
        reason: 'action_not_pending',
      });
    }

    await this.audit.record({
      actorId: actor.id,
      action: `dangerous.${action.kind}.cancelled`,
      resourceType: 'user',
      resourceId: action.targetUserId,
      metadata: { dangerousActionId: action.id, reason: action.reason },
    });

    return { id: action.id, status: DangerousActionStatus.cancelled };
  }

  // ----------------------------------------------------------------
  // Yordamchi qismlar
  // ----------------------------------------------------------------

  /**
   * §6.5(2) QAT'IY TOTP tekshiruvi.
   *
   * MUHIM: `TwoFactorService.verifyLogin()` 2FA YOQILMAGAN bo'lsa `true`
   * qaytaradi — bu LOGIN semantikasi (2FA ixtiyoriy). Xavfli amal uchun bu
   * XAVFLI bo'lardi, shuning uchun bu yerda 2FA yoqilganligi ALOHIDA
   * tekshiriladi. Ikkinchi auth mexanizmi yaratilmaydi — mavjud servis
   * ishlatiladi.
   */
  private async assertTotp(actor: User, totp: string): Promise<void> {
    if (!actor.twoFactorEnabled) {
      throw new ForbiddenException({
        message: "Xavfli amal uchun 2FA yoqilgan bo'lishi SHART",
        reason: 'two_factor_required',
      });
    }
    const valid = await this.twoFactor.verifyLogin(actor.id, totp);
    if (!valid) {
      throw new UnauthorizedException({
        message: "TOTP kodi noto'g'ri",
        reason: 'invalid_totp',
      });
    }
  }

  /** Amalni yuklaydi, egaligini va muddatini tekshiradi. */
  private async loadForTransition(actor: User, actionId: string): Promise<DangerousAction> {
    const action = await this.prisma.dangerousAction.findUnique({ where: { id: actionId } });
    if (!action) throw new NotFoundException('Xavfli amal topilmadi');

    // Amal-darajasidagi avtorizatsiya bajarish/bekor qilishda ham qo'llanadi.
    if (!DANGEROUS_ACTIONS[action.kind].allowedRoles.includes(actor.role)) {
      throw new ForbiddenException({
        message: "Bu xavfli amalni boshqarish huquqingiz yo'q",
        reason: 'dangerous_action_forbidden',
      });
    }

    if (action.status !== DangerousActionStatus.pending) {
      throw new BadRequestException({
        message: `Amal holati "${action.status}" — o'zgartirib bo'lmaydi`,
        reason: 'action_not_pending',
      });
    }

    // Muddati o'tgan tasdiq: holatni `expired` ga o'tkazamiz va rad etamiz.
    // Ya'ni "eskirgan" amal na bajariladi, na bekor qilinadi.
    if (action.expiresAt <= new Date()) {
      await this.prisma.dangerousAction.updateMany({
        where: { id: action.id, status: DangerousActionStatus.pending },
        data: { status: DangerousActionStatus.expired },
      });
      throw new BadRequestException({
        message: 'Tasdiq muddati tugagan (24 soat)',
        reason: 'action_expired',
      });
    }

    return action;
  }

  /** Amalga xos oldindan-tekshiruvlar; `payload`ni qaytaradi. */
  private async validateKind(
    dto: CreateDangerousActionDto,
    actor: User,
    target: TargetSnapshot,
  ): Promise<Record<string, unknown>> {
    if (dto.kind === DangerousActionKind.session_revoke) {
      return {};
    }

    if (dto.kind === DangerousActionKind.credit_manual) {
      return this.validateCredit(dto, actor, target);
    }

    if (
      dto.kind === DangerousActionKind.user_block ||
      dto.kind === DangerousActionKind.user_unblock
    ) {
      return this.validateBlock(dto, actor, target);
    }

    // --- role_assign ---
    if (!dto.newRole) {
      throw new BadRequestException({
        message: "Rol tayinlash uchun `newRole` majburiy",
        reason: 'new_role_required',
      });
    }

    // O'ZINI KO'TARISH/TUSHIRISH taqiqlanadi: aks holda OWNER o'zini
    // qulflab qo'yishi yoki nazoratsiz o'zgartirishi mumkin edi.
    if (target.id === actor.id) {
      throw new ForbiddenException({
        message: "O'z rolingizni o'zgartira olmaysiz",
        reason: 'self_role_change_forbidden',
      });
    }

    if (target.role === dto.newRole) {
      throw new BadRequestException({
        message: 'Foydalanuvchi allaqachon shu rolda',
        reason: 'role_unchanged',
      });
    }

    // Konstitutsiya #10: "OWNER/ADMIN roli 2FA'siz BERILMAYDI".
    const elevated: UserRole[] = [UserRole.OWNER, UserRole.ADMIN];
    if (elevated.includes(dto.newRole) && !target.twoFactorEnabled) {
      throw new BadRequestException({
        message: "Imtiyozli rol 2FA yoqilmagan foydalanuvchiga berilmaydi",
        reason: 'target_two_factor_required',
      });
    }

    // §6.7 bus-factor: oxirgi OWNER'ni tushirib bo'lmaydi — aks holda
    // platformada rol tayinlay oladigan hech kim qolmaydi.
    if (target.role === UserRole.OWNER && dto.newRole !== UserRole.OWNER) {
      const owners = await this.prisma.user.count({ where: { role: UserRole.OWNER } });
      if (owners <= 1) {
        throw new BadRequestException({
          message: "Oxirgi OWNER rolini o'zgartirib bo'lmaydi (bus factor)",
          reason: 'last_owner_protected',
        });
      }
    }

    return { previousRole: target.role, newRole: dto.newRole };
  }

  // ----------------------------------------------------------------
  // SEC-12 — qo'lda kredit
  // ----------------------------------------------------------------

  /**
   * §23 — qo'lda kreditning oldindan-tekshiruvlari.
   *
   * `execute()` bosqichida BULAR QAYTA tekshiriladi (kunlik chegara
   * `perform()` ichida, lock ostida) — tasdiq 24 soat yashagani uchun
   * so'rov paytidagi holat eskirgan bo'lishi mumkin.
   */
  private async validateCredit(
    dto: CreateDangerousActionDto,
    actor: User,
    target: TargetSnapshot,
  ): Promise<Record<string, unknown>> {
    if (!dto.amountTiyin) {
      throw new BadRequestException({
        message: "Kredit uchun `amountTiyin` majburiy",
        reason: 'amount_required',
      });
    }

    // DTO regexi manfiy/kasr/nolni allaqachon rad etadi; bu — ikkinchi
    // to'siq (DTO o'zgarsa ham pul yo'li himoyalangan qoladi).
    const amount = BigInt(dto.amountTiyin);
    if (amount <= 0n) {
      throw new BadRequestException({
        message: 'Summa musbat bo\'lishi shart',
        reason: 'amount_invalid',
      });
    }
    if (amount > MAX_SINGLE_CREDIT_TIYIN) {
      throw new BadRequestException({
        message: `Bitta amaldagi eng katta summa: ${MAX_SINGLE_CREDIT_TIYIN} tiyin`,
        reason: 'amount_above_single_cap',
      });
    }

    // O'ZIGA kredit yozish TAQIQLANADI — bu o'g'irlikning eng to'g'ri
    // yo'li bo'lardi (admin o'z hamyoniga pul yozadi).
    if (target.id === actor.id) {
      throw new ForbiddenException({
        message: "O'zingizga kredit yoza olmaysiz",
        reason: 'self_credit_forbidden',
      });
    }

    await this.assertDailyCreditCap(actor, amount, this.prisma);

    return { amountTiyin: amount.toString() };
  }

  /**
   * §6.1 — ADMIN uchun kunlik 500k so'm chegarasi. OWNER cheklanmagan.
   *
   * `client` parametri: `execute()` yo'lida shu tekshiruv TRANZAKSIYA
   * ICHIDA, advisory-lock ostida qayta bajariladi — ya'ni ikki parallel
   * bajarish chegaradan birgalikda oshib keta olmaydi (§25).
   */
  private async assertDailyCreditCap(
    actor: User,
    amount: bigint,
    client: Prisma.TransactionClient | PrismaService,
    excludeActionId?: string,
  ): Promise<void> {
    if (actor.role !== UserRole.ADMIN) return;

    const since = new Date(Date.now() - CREDIT_CAP_WINDOW_MS);
    // @admin-scope: aktorning o'z amallari bo'yicha yig'indi (`actorId`
    // filtri bor, lekin bu tenant emas — nazorat hisobi).
    const recent = await client.dangerousAction.findMany({
      where: {
        actorId: actor.id,
        kind: DangerousActionKind.credit_manual,
        status: DangerousActionStatus.executed,
        executedAt: { gte: since },
        ...(excludeActionId ? { id: { not: excludeActionId } } : {}),
      },
      select: { payload: true },
    });

    const used = recent.reduce((sum, row) => {
      const raw = (row.payload as { amountTiyin?: string } | null)?.amountTiyin;
      return sum + (raw ? BigInt(raw) : 0n);
    }, 0n);

    if (used + amount > ADMIN_DAILY_CREDIT_CAP_TIYIN) {
      throw new ForbiddenException({
        message:
          `Kunlik chegara oshdi (ADMIN uchun ${ADMIN_DAILY_CREDIT_CAP_TIYIN} tiyin/24 soat). ` +
          `Ishlatilgan: ${used}. Kattaroq summa uchun OWNER bajarishi kerak.`,
        reason: 'daily_credit_cap_exceeded',
      });
    }
  }

  // ----------------------------------------------------------------
  // SEC-12 — blok / blokdan chiqarish
  // ----------------------------------------------------------------

  /** §24 — blok/blokdan chiqarishning oldindan-tekshiruvlari. */
  private async validateBlock(
    dto: CreateDangerousActionDto,
    actor: User,
    target: TargetSnapshot,
  ): Promise<Record<string, unknown>> {
    // O'ZINI bloklash — operatorni platformadan chiqarib yuboradi
    // (§24 "unauthorized self-lockout").
    if (target.id === actor.id) {
      throw new ForbiddenException({
        message: "O'zingizni bloklay olmaysiz",
        reason: 'self_block_forbidden',
      });
    }

    // §24 "protect OWNER/system accounts" — imtiyozli hisoblar himoyasi
    // impersonation bilan AYNAN bir xil qoidadan kelib chiqadi: nishon
    // roli aktordan QAT'IY past bo'lishi shart. Ya'ni OWNER hech kim
    // tomonidan bloklanmaydi va ADMIN boshqa ADMIN'ni bloklay olmaydi.
    if (!outranks(actor.role, target.role)) {
      throw new ForbiddenException({
        message: 'Bu hisobni bloklab bo\'lmaydi (imtiyozli hisob)',
        reason: 'target_role_protected',
      });
    }

    const isBlocking = dto.kind === DangerousActionKind.user_block;
    if (isBlocking && target.blockedAt) {
      throw new BadRequestException({
        message: 'Foydalanuvchi allaqachon bloklangan',
        reason: 'already_blocked',
      });
    }
    if (!isBlocking && !target.blockedAt) {
      throw new BadRequestException({
        message: 'Foydalanuvchi bloklanmagan',
        reason: 'not_blocked',
      });
    }

    return { previouslyBlocked: target.blockedAt !== null };
  }

  /** Amalning O'ZINI bajaradi. */
  private async perform(action: DangerousAction, actor: User): Promise<Record<string, unknown>> {
    if (action.kind === DangerousActionKind.credit_manual) {
      return this.performCredit(action, actor);
    }

    if (
      action.kind === DangerousActionKind.user_block ||
      action.kind === DangerousActionKind.user_unblock
    ) {
      return this.performBlock(action, actor);
    }

    if (action.kind === DangerousActionKind.session_revoke) {
      // Mavjud mexanizm (SEC-03): `tokenVersion` oshsa, `AuthGuard`
      // payload'dagi `tv` bilan mos kelmaydi va BARCHA mavjud tokenlar
      // darhol 401 bo'ladi. Parallel session-bekor mexanizmi yaratilmaydi.
      const updated = await this.prisma.user.update({
        where: { id: action.targetUserId },
        data: { tokenVersion: { increment: 1 } },
        select: { tokenVersion: true },
      });
      return { tokenVersion: updated.tokenVersion, sessionsRevoked: true };
    }

    // --- role_assign ---
    const payload = (action.payload ?? {}) as { previousRole?: UserRole; newRole?: UserRole };
    const newRole = payload.newRole;
    if (!newRole) {
      throw new BadRequestException({ message: 'Yaroqsiz amal yuki', reason: 'invalid_payload' });
    }

    // ATOMIK: rol FAQAT hali ham kutilgan qiymatda bo'lsa o'zgaradi.
    // Tasdiq berilgandan keyin rol boshqa yo'l bilan o'zgargan bo'lsa
    // (poyga), eskirgan qaror qo'llanmaydi.
    const changed = await this.prisma.user.updateMany({
      where: { id: action.targetUserId, role: payload.previousRole },
      data: {
        role: newRole,
        // Rol o'zgarishi — avtorizatsiya o'zgarishi. Mavjud tokenlarda eski
        // rol keshlanmagan bo'lsa ham, sessiyani bekor qilish eng xavfsiz
        // xulq (imtiyoz pasaytirilganda darhol kuchga kiradi).
        tokenVersion: { increment: 1 },
      },
    });
    if (changed.count === 0) {
      throw new BadRequestException({
        message: "Foydalanuvchi roli bu orada o'zgargan — amal bekor qilindi",
        reason: 'role_changed_meanwhile',
      });
    }

    return { previousRole: payload.previousRole, newRole };
  }

  /**
   * §23 — qo'lda kredit BAJARILISHI.
   *
   * ATOMIKLIK IKKI QATLAMDA:
   *   1. `pg_advisory_xact_lock(ns, hashtext(actorId))` — bitta operatorning
   *      parallel kreditlari SERIYALASHADI. Usiz ikkala bajarish ham
   *      kunlik chegarani "hali oshmagan" deb ko'rib, birgalikda oshib
   *      ketardi (TOCTOU).
   *   2. Chegara lock ICHIDA qayta hisoblanadi (`excludeActionId` — joriy
   *      amal allaqachon `executed` deb belgilangani uchun o'zini ikki
   *      marta sanamaslik kerak).
   * Balans o'zgarishi esa mavjud `WalletCreditService.credit()` orqali —
   * `user.update` + `CreditLedger` bitta tranzaksiyada, ya'ni "naive
   * balance = balance + amount" YO'Q va daftarsiz pul harakati YO'Q.
   *
   * TAKROR BAJARISHDAN himoya: `execute()` dagi `pending -> executed`
   * shartli o'tishi (count===1) — bu yerga bitta bajarish yetib keladi.
   */
  private async performCredit(
    action: DangerousAction,
    actor: User,
  ): Promise<Record<string, unknown>> {
    const payload = (action.payload ?? {}) as { amountTiyin?: string };
    if (!payload.amountTiyin) {
      throw new BadRequestException({ message: 'Yaroqsiz amal yuki', reason: 'invalid_payload' });
    }
    const amount = BigInt(payload.amountTiyin);
    if (amount <= 0n || amount > MAX_SINGLE_CREDIT_TIYIN) {
      throw new BadRequestException({ message: 'Yaroqsiz summa', reason: 'amount_invalid' });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CREDIT_CAP_LOCK_NS}::int, hashtext(${actor.id}))`;

      // Chegara lock ostida QAYTA hisoblanadi — tasdiq 24 soat yashagani
      // uchun so'rov paytidagi hisob eskirgan bo'lishi mumkin.
      await this.assertDailyCreditCap(actor, amount, tx, action.id);

      const ledger = await this.wallet.credit(
        action.targetUserId,
        amount,
        {
          source: 'admin_manual_credit',
          dangerousActionId: action.id,
          actorId: actor.id,
          reason: action.reason,
        },
        tx,
        'admin_credit',
      );
      return ledger;
    });

    return {
      amountTiyin: amount.toString(),
      balanceAfterTiyin: result.balanceAfter.toString(),
      ledgerId: result.id,
    };
  }

  /**
   * §24 — blok / blokdan chiqarish BAJARILISHI.
   *
   * ATOMIK SHARTLI O'TISH: `updateMany` + kutilgan blok holati sharti.
   * Ikki parallel bloklashda faqat BITTASI `count: 1` oladi; tasdiq
   * berilgandan keyin holat boshqa yo'l bilan o'zgargan bo'lsa (masalan
   * boshqa admin blokdan chiqargan), eskirgan qaror QO'LLANMAYDI.
   *
   * SESSIYA BEKOR QILISH: bloklashda `tokenVersion++` — mavjud SEC-03
   * mexanizmi (parallel yo'l yaratilmaydi), ya'ni bloklangan
   * foydalanuvchining barcha tokenlari darhol 401 bo'ladi. Blokdan
   * chiqarishda OSHIRILMAYDI: eski tokenlar allaqachon o'lik, yana
   * oshirish faqat boshqa qurilmalarni keraksiz chiqarib yuborardi.
   */
  private async performBlock(
    action: DangerousAction,
    actor: User,
  ): Promise<Record<string, unknown>> {
    const isBlocking = action.kind === DangerousActionKind.user_block;

    const changed = await this.prisma.user.updateMany({
      where: isBlocking
        ? { id: action.targetUserId, blockedAt: null }
        : { id: action.targetUserId, blockedAt: { not: null } },
      data: isBlocking
        ? {
            blockedAt: new Date(),
            blockedReason: action.reason,
            blockedById: actor.id,
            tokenVersion: { increment: 1 },
          }
        : { blockedAt: null, blockedReason: null, blockedById: null },
    });

    if (changed.count === 0) {
      throw new BadRequestException({
        message: "Foydalanuvchi holati bu orada o'zgargan — amal bekor qilindi",
        reason: 'block_state_changed_meanwhile',
      });
    }

    return { blocked: isBlocking };
  }
}

/** `validateKind` ga beriladigan nishon suratini (snapshot) tavsiflaydi. */
interface TargetSnapshot {
  id: string;
  role: UserRole;
  twoFactorEnabled: boolean;
  blockedAt: Date | null;
}
