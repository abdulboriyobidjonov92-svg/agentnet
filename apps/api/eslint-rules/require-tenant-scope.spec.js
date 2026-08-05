'use strict';

const { RuleTester } = require('eslint');
const tseslint = require('typescript-eslint');
const rule = require('./require-tenant-scope');

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    sourceType: 'module',
  },
});

ruleTester.run('require-tenant-scope', rule, {
  valid: [
    // Ekzakt kanonik kalit
    { code: `this.prisma.agent.findMany({ where: { userId: user.id } });` },
    { code: `this.prisma.creatorLedger.findMany({ where: { creatorId: user.id } });` },
    { code: `this.prisma.auditLog.findFirst({ where: { actorId: user.id } });` },
    { code: `this.prisma.org.findMany({ where: { ownerId: user.id } });` },
    // Qaror #2: prefiksli/suffiks-mos kalitlar ham o'tadi
    { code: `this.prisma.payout.findMany({ where: { originalCreatorId: user.id } });` },
    { code: `this.prisma.asset.findMany({ where: { previousOwnerId: user.id } });` },
    // Har oltita istisno-izoh — birma-bir
    {
      code: `
        // @admin-scope: faqat OWNER roli chaqiradi, controller darajasida himoyalangan.
        this.prisma.feedback.findMany({ orderBy: { createdAt: 'desc' } });
      `,
    },
    {
      code: `
        // @system-scope: kunlik cron, so'rov-bog'liq foydalanuvchi yo'q.
        const due = await this.prisma.agent.findMany({ where: { frozen: false } });
      `,
    },
    {
      code: `
        // @public-scope: marketplace ommaviy katalogi, ko'ruvchi-tenant yo'q.
        const agents = await this.prisma.agent.findMany({ where: { isPublished: true } });
      `,
    },
    {
      code: `
        // @preauth-scope: identifikator bo'yicha OTP qidiruvi, foydalanuvchi hali aniqlanmagan.
        const recent = await this.prisma.otpCode.findFirst({ where: { identifier } });
      `,
    },
    {
      code: `
        // @upstream-scope: egalik findOne() ichida allaqachon tekshirilgan.
        const tasks = await this.prisma.goalTask.findMany({ where: { goalId: goal.id } });
      `,
    },
    {
      code: `
        // @org-scope: tashkilot darajasida scope, foydalanuvchi emas.
        return this.prisma.orgCommand.findMany({ where: { orgId: user.orgId } });
      `,
    },
    // Ichki `include.X.where` alohida tekshirilmaydi — tashqi where'ning o'zi scoped bo'lsa yetarli
    {
      code: `
        this.prisma.employee.findMany({
          where: { userId: user.id },
          include: { timeOffs: { where: { status: 'approved' } } },
        });
      `,
    },
    // findMany/findFirst BO'LMAGAN chaqiruvlar (masalan findUnique) qoidaga umuman kirmaydi
    { code: `this.prisma.agent.findUnique({ where: { id } });` },
    // Prisma accessor BO'LMAGAN .findMany/.findFirst — masalan AdminQueryService'ning
    // o'z pass-through wrapper metodi, yoki uni chaqiruvchi test — qoidaga kirmaydi
    // (AC matni "prisma.*.findMany" deydi, umuman ".findMany" emas).
    { code: `delegate.findMany(args);` },
    { code: `svc.findFirst(delegate, args);` },
    { code: `this.adminQuery.findMany(this.prisma.user, { where: { plan: 'pro' } });` },
    // tx.<model> ($transaction callback) — Prisma accessor, scoped bo'lsa o'tadi
    { code: `tx.agent.findFirst({ where: { userId: user.id } });` },
  ],
  invalid: [
    {
      code: `this.prisma.agent.findMany({ where: { frozen: false } });`,
      errors: [{ messageId: 'missingScope' }],
    },
    {
      code: `this.prisma.auditLog.findFirst({ orderBy: { seq: 'desc' } });`,
      errors: [{ messageId: 'missingScope' }],
    },
    // where umuman yo'q
    {
      code: `this.prisma.feedback.findMany({ orderBy: { createdAt: 'desc' } });`,
      errors: [{ messageId: 'missingScope' }],
    },
    // Noto'g'ri/tan olinmagan izoh (masalan eskirgan yagona @admin-scope o'rniga
    // umuman boshqa matn) — hali ham xato
    {
      code: `
        // TODO: keyinroq ko'rib chiqamiz
        this.prisma.agent.findMany({ where: { frozen: false } });
      `,
      errors: [{ messageId: 'missingScope' }],
    },
    // tx.<model> ham xuddi this.prisma.<model> kabi tekshiriladi
    {
      code: `tx.agent.findFirst({ where: { frozen: false } });`,
      errors: [{ messageId: 'missingScope' }],
    },
  ],
});

// eslint-disable-next-line no-console
console.log('require-tenant-scope: barcha RuleTester holatlari o\'tdi.');
