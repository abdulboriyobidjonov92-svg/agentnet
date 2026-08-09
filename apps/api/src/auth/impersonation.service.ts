import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import {
  ImpersonationMode,
  ImpersonationStatus,
  type ImpersonationSession,
  type User,
  type UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from './auth.service';
import {
  IMPERSONATION_ACTOR_ROLES,
  IMPERSONATION_MAX_DURATION_MS,
} from './impersonation.policy';
import type { ImpersonationContext } from './impersonation.types';
import {
  IMPERSONATION_READ_ONLY,
  IMPERSONATION_TYP,
  signToken,
  type TokenPayload,
} from './token.util';

/** Sessiya tugash sabablari — auditda ANIQ farqlanadi (§13). */
export type ImpersonationEndReason = 'manual' | 'expired' | 'revoked';

/**
 * SEC-12 §6.6 — impersonation sessiyasining SERVER TOMONIDAGI hayoti.
 *
 * NEGA `AuthModule` da (admin modulida emas): `AuthGuard` global
 * `APP_GUARD` va u har so'rovda sessiyani tekshirishi kerak. Guard'ning
 * o'zida Prisma chaqirish CLAUDE.md Rule #22 ni buzardi ("Prisma faqat
 * `*.service.ts` ichida"), shuning uchun tekshiruv shu servisga olingan.
 *
 * MAS'ULIYAT CHEGARASI:
 *   • bu servis — TOKEN + SESSIYA HOLATI (yaratish, tekshirish, tugatish,
 *     har so'rovni auditlash);
 *   • KIM kimni impersonation qila oladi, TOTP, sabab, bildirishnoma —
 *     `admin/impersonation/` (operator yuzasi) zimmasida.
 * Ikkalasini birlashtirsak, `AuthModule` -> `ConnectorsModule` ->
 * `AuthModule` aylanma bog'liqligi paydo bo'lardi.
 */
@Injectable()
export class ImpersonationService {
  private readonly logger = new Logger(ImpersonationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // ----------------------------------------------------------------
  // Yaratish
  // ----------------------------------------------------------------

  /**
   * Sessiya qatorini yaratadi va unga BOG'LANGAN tokenni imzolaydi.
   *
   * Token `sub` = NISHON (qolgan butun kod-baza "men kimman" savoliga
   * shundan javob oladi), `act` = HAQIQIY operator, `tv` = nishonning
   * `tokenVersion`i (ya'ni nishon sessiyalari bekor qilinsa, `AuthGuard`
   * ning mavjud SEC-03 tekshiruvi bu tokenni ham o'ldiradi — parallel
   * bekor qilish mexanizmi yozilmaydi).
   */
  async create(params: {
    actor: Pick<User, 'id' | 'tokenVersion'>;
    target: Pick<User, 'id' | 'email' | 'tokenVersion'>;
    reason: string;
  }): Promise<{ session: ImpersonationSession; token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + IMPERSONATION_MAX_DURATION_MS);

    const session = await this.prisma.impersonationSession.create({
      data: {
        actorId: params.actor.id,
        targetUserId: params.target.id,
        reason: params.reason,
        actorTokenVersion: params.actor.tokenVersion,
        mode: ImpersonationMode.READ_ONLY,
        expiresAt,
      },
    });

    const token = signToken(
      {
        sub: params.target.id,
        email: params.target.email,
        tv: params.target.tokenVersion,
        typ: IMPERSONATION_TYP,
        act: params.actor.id,
        imp: session.id,
        mode: IMPERSONATION_READ_ONLY,
      },
      Math.floor(IMPERSONATION_MAX_DURATION_MS / 1000),
    );

    return { session, token, expiresAt };
  }

  // ----------------------------------------------------------------
  // Har so'rovdagi tekshiruv
  // ----------------------------------------------------------------

  /**
   * Impersonation tokenini SERVER HOLATI bilan tasdiqlaydi.
   *
   * Fail-closed: har qanday nomuvofiqlikda 401/403. Tekshiriladi:
   *   1. sessiya bor;
   *   2. token da'volari qator bilan AYNAN mos (nishon, aktor, rejim) —
   *      boshqa sessiyaning id'sini yopishtirib bo'lmaydi;
   *   3. holat `active`;
   *   4. muddat o'tmagan (o'tgan bo'lsa — SHU YERDA `expired` ga o'tkaziladi
   *      va tugash auditi yoziladi, ya'ni "osilib qolgan active" bo'lmaydi);
   *   5. aktor mavjud, bloklanmagan, roli hali ham impersonation qila oladi;
   *   6. aktorning `tokenVersion`i o'zgarmagan — operator sessiyalari bekor
   *      qilinsa (SEC-03), impersonation ham darhol o'ladi.
   */
  async resolve(payload: TokenPayload): Promise<{ context: ImpersonationContext; target: User }> {
    if (payload.typ !== IMPERSONATION_TYP || !payload.imp || !payload.act) {
      throw new UnauthorizedException('Impersonation tokeni yaroqsiz');
    }

    const session = await this.prisma.impersonationSession.findUnique({
      where: { id: payload.imp },
    });
    if (!session) {
      throw new UnauthorizedException('Impersonation sessiyasi topilmadi');
    }

    // Da'volar qator bilan mos kelmasa — token boshqa sessiyaga tegishli
    // yoki qayta ishlatilmoqda.
    if (
      session.targetUserId !== payload.sub ||
      session.actorId !== payload.act ||
      session.mode !== payload.mode
    ) {
      throw new UnauthorizedException('Impersonation tokeni sessiyaga mos emas');
    }

    if (session.status !== ImpersonationStatus.active) {
      throw new UnauthorizedException({
        message: 'Impersonation sessiyasi tugagan',
        reason: 'impersonation_ended',
      });
    }

    if (session.expiresAt <= new Date()) {
      await this.end(session, 'expired');
      throw new UnauthorizedException({
        message: 'Impersonation muddati tugagan (30 daqiqa)',
        reason: 'impersonation_expired',
      });
    }

    const actor = await this.prisma.user.findUnique({ where: { id: session.actorId } });
    if (!actor) {
      await this.end(session, 'revoked');
      throw new UnauthorizedException('Impersonation aktori topilmadi');
    }

    // Operator sessiyalari bekor qilingan / roli tushirilgan / bloklangan —
    // uchala holatda ham impersonation DARHOL o'ladi (§16).
    if (
      actor.tokenVersion !== session.actorTokenVersion ||
      actor.blockedAt !== null ||
      !IMPERSONATION_ACTOR_ROLES.includes(actor.role)
    ) {
      await this.end(session, 'revoked');
      throw new UnauthorizedException({
        message: 'Impersonation bekor qilingan (operator sessiyasi yaroqsiz)',
        reason: 'impersonation_revoked',
      });
    }

    const target = await this.prisma.user.findUnique({ where: { id: session.targetUserId } });
    if (!target) {
      await this.end(session, 'revoked');
      throw new UnauthorizedException('Impersonation nishoni topilmadi');
    }

    return {
      context: {
        impersonationId: session.id,
        realActorId: actor.id,
        realActorRole: actor.role,
        realActorEmail: actor.email,
        targetUserId: target.id,
        mode: IMPERSONATION_READ_ONLY,
        issuedAt: session.createdAt,
        expiresAt: session.expiresAt,
      },
      target,
    };
  }

  // ----------------------------------------------------------------
  // Tugatish
  // ----------------------------------------------------------------

  /**
   * Sessiyani ATOMIK yopadi va tugash auditini yozadi.
   *
   * `updateMany` + `status: active` sharti: ikki parallel to'xtatishda
   * (masalan operator "To'xtatish"ni bosdi va ayni paytda muddat o'tdi)
   * faqat BITTASI `count: 1` oladi — ya'ni tugash auditi HAM bir marta
   * yoziladi. Qaytadi: yopgan chaqiruv uchun sessiya, aks holda `null`.
   */
  async end(
    session: Pick<ImpersonationSession, 'id' | 'actorId' | 'targetUserId' | 'reason' | 'createdAt'>,
    reason: ImpersonationEndReason,
  ): Promise<ImpersonationSession | null> {
    const endedAt = new Date();
    const closed = await this.prisma.impersonationSession.updateMany({
      where: { id: session.id, status: ImpersonationStatus.active },
      data: {
        status:
          reason === 'expired' ? ImpersonationStatus.expired : ImpersonationStatus.ended,
        endedAt,
        endedReason: reason,
      },
    });
    if (closed.count === 0) return null;

    const fresh = await this.prisma.impersonationSession.findUnique({
      where: { id: session.id },
    });

    await this.audit.record({
      actorId: session.actorId,
      action: 'impersonation.end',
      resourceType: 'user',
      resourceId: session.targetUserId,
      impersonatedUserId: session.targetUserId,
      metadata: {
        impersonationId: session.id,
        endReason: reason,
        reason: session.reason,
        startedAt: session.createdAt.toISOString(),
        endedAt: endedAt.toISOString(),
        requestCount: fresh?.requestCount ?? 0,
      },
    });

    return fresh;
  }

  /**
   * Muddati o'tgan, lekin hali `active` turgan sessiyalarni yopadi.
   *
   * NEGA KERAK: `resolve()` faqat SO'ROV KELGANDA muddatni ko'radi.
   * Operator brauzerni yopib ketsa, qator muddatdan keyin ham `active`
   * bo'lib qolardi — §13 "noaniq faol sessiya qoldirilmaydi" buni
   * taqiqlaydi. Chaqiruvchi: `admin/impersonation` cron'i (u yerda —
   * chunki tugash bildirishnomasi ham o'sha qatlamda).
   */
  async expireDue(limit = 100): Promise<ImpersonationSession[]> {
    // @system-scope: muddati o'tgan sessiyalar bo'yicha global tozalash —
    // foydalanuvchi so'roviga bog'liq emas.
    const due = await this.prisma.impersonationSession.findMany({
      where: { status: ImpersonationStatus.active, expiresAt: { lte: new Date() } },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    });

    const ended: ImpersonationSession[] = [];
    for (const session of due) {
      const closed = await this.end(session, 'expired');
      if (closed) ended.push(closed);
    }
    return ended;
  }

  // ----------------------------------------------------------------
  // Har so'rov auditi (§6.6, §11)
  // ----------------------------------------------------------------

  /**
   * Impersonation orqali kelgan HAR BIR so'rovni jurnalga yozadi.
   *
   * `actorId` — HAQIQIY operator (zanjir shu aktorda o'sadi),
   * `impersonatedUserId` — nishon. Ya'ni jurnalda "foydalanuvchi o'zi
   * qildi" va "admin uning nomidan qildi" hech qachon chalkashmaydi.
   *
   * Audit hech qachon so'rovni bloklamaydi (`AuditLogService.record`
   * o'zi ham xatoni yutadi) — `requestCount` esa best-effort hisoblagich.
   */
  async recordRequest(params: {
    context: ImpersonationContext;
    method: string;
    route: string;
    outcome: 'allowed' | 'denied';
    statusCode?: number;
    denyReason?: string;
  }): Promise<void> {
    const { context } = params;

    await this.audit.record({
      actorId: context.realActorId,
      action:
        params.outcome === 'denied' ? 'impersonation.request.denied' : 'impersonation.request',
      resourceType: 'http',
      resourceId: params.route,
      impersonatedUserId: context.targetUserId,
      metadata: {
        impersonationId: context.impersonationId,
        method: params.method,
        route: params.route,
        outcome: params.outcome,
        ...(params.statusCode !== undefined ? { statusCode: params.statusCode } : {}),
        ...(params.denyReason ? { denyReason: params.denyReason } : {}),
      },
    });

    try {
      await this.prisma.impersonationSession.update({
        where: { id: context.impersonationId },
        data: { requestCount: { increment: 1 } },
      });
    } catch (e) {
      this.logger.warn(`Impersonation so'rov hisoblagichi yangilanmadi: ${(e as Error).message}`);
    }
  }

  /** Nishon rolini impersonation qila oladigan rollar ro'yxati (yuza uchun). */
  static actorRoles(): readonly UserRole[] {
    return IMPERSONATION_ACTOR_ROLES;
  }

  /** Aniq bir sessiyani id bo'yicha oladi (to'xtatish yuzasi uchun). */
  findById(id: string): Promise<ImpersonationSession | null> {
    return this.prisma.impersonationSession.findUnique({ where: { id } });
  }

  /** Operatorning ochiq sessiyasi bormi (bir vaqtda bittadan ortiq bo'lmasin). */
  async findActiveByActor(actorId: string): Promise<ImpersonationSession | null> {
    return this.prisma.impersonationSession.findFirst({
      where: { actorId, status: ImpersonationStatus.active, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Rad etilgan/muvaffaqiyatsiz BOSHLASH urinishini auditlaydi (§13). */
  async recordStartDenied(params: {
    actorId: string;
    targetUserId: string;
    reason: string;
    denyReason: string;
  }): Promise<void> {
    await this.audit.record({
      actorId: params.actorId,
      action: 'impersonation.start.denied',
      resourceType: 'user',
      resourceId: params.targetUserId,
      metadata: { denyReason: params.denyReason, reason: params.reason },
    });
  }

  /** Boshlanish auditi (§12) — sabab, muddat, rejim, sessiya id'si bilan. */
  async recordStart(params: {
    session: ImpersonationSession;
    actorId: string;
    targetUserId: string;
  }): Promise<void> {
    await this.audit.record({
      actorId: params.actorId,
      action: 'impersonation.start',
      resourceType: 'user',
      resourceId: params.targetUserId,
      impersonatedUserId: params.targetUserId,
      metadata: {
        impersonationId: params.session.id,
        reason: params.session.reason,
        mode: params.session.mode,
        startedAt: params.session.createdAt.toISOString(),
        expiresAt: params.session.expiresAt.toISOString(),
      },
    });
  }

  /** Nishonga bildirishnoma yuborilganini belgilaydi (takrorlanmasin). */
  async markNotified(sessionId: string): Promise<void> {
    await this.prisma.impersonationSession.update({
      where: { id: sessionId },
      data: { notifiedAt: new Date() },
    });
  }

  /** §15 — nishon rolini/holatini olish (avtorizatsiya qarori uchun). */
  async loadTarget(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Aktorning ruxsat etilgan rollardan biriga egaligini tekshiradi. */
  assertActorRoleAllowed(role: UserRole): void {
    if (!IMPERSONATION_ACTOR_ROLES.includes(role)) {
      throw new ForbiddenException({
        message: "Sizning rolingiz impersonation qila olmaydi",
        reason: 'impersonation_role_forbidden',
      });
    }
  }
}
