// @ts-check
'use strict';

const { ESLintUtils } = require('@typescript-eslint/utils');

/**
 * SEC-06 AC — "prisma.*.findMany/findFirst where ichida
 * userId|ownerId|creatorId|actorId YOKI izohli istisno bo'lishi shart."
 *
 * ALTIta aniq istisno-izoh tan olinadi (bittagina @admin-scope EMAS —
 * SEC-06 tasdiqlangan qaror #1): har biri so'rov nima uchun ATAYLAB
 * tenant-scope qilinmaganini ANIQ aytadi, uzoq muddatli audit uchun.
 *
 *   @admin-scope    — @Roles(...) bilan himoyalangan admin yo'lidan
 *                      chaqiriladigan chinakam cross-tenant o'qish.
 *   @system-scope   — tizimning o'zi (cron/scheduled job) yoki global
 *                      ichki holat (masalan audit-zanjirning oxirgi
 *                      yozuvi) — so'rov hech qanday foydalanuvchi
 *                      so'roviga bog'liq emas.
 *   @public-scope   — ataylab OMMAVIY ma'lumot (masalan marketplace
 *                      katalogi) — ko'ruvchi-tenant tushunchasi umuman
 *                      qo'llanmaydi.
 *   @preauth-scope  — foydalanuvchi hali ANIQLANMAGAN so'rov (OTP kod
 *                      identifikator bo'yicha, companion token bo'yicha)
 *                      — identifikatsiyani o'rnatish so'rovning o'zi.
 *   @upstream-scope — egalik shu METOD ichida OLDINROQ (findUnique +
 *                      `if (x.userId !== user.id) throw ForbiddenException`)
 *                      allaqachon tekshirilgan; bu so'rov shu tekshirilgan
 *                      obyektning ID'siga (masalan companionId, goalId)
 *                      tayanadi, userId'ning o'ziga emas.
 *   @org-scope      — foydalanuvchi emas, TASHKILOT (`orgId`) darajasida
 *                      scope qilingan — ko'p-foydalanuvchili tenant chegarasi.
 *
 * Ownership kaliti SUFFIKS bo'yicha aniqlanadi (SEC-06 qaror #2):
 * `originalCreatorId`/`previousOwnerId` kabi prefiksli maydonlar ham
 * to'g'ri hisoblanadi — faqat AYNAN "userId" kabi emas.
 */

const OWNERSHIP_SUFFIXES = ['userid', 'ownerid', 'creatorid', 'actorid'];

const ESCAPE_TAGS = [
  'admin-scope',
  'system-scope',
  'public-scope',
  'preauth-scope',
  'upstream-scope',
  'org-scope',
];
const ESCAPE_COMMENT_RE = new RegExp(`@(${ESCAPE_TAGS.join('|')})\\b`);

const TARGET_METHODS = new Set(['findMany', 'findFirst']);

// Statement-darajasidagi qatorni topish uchun — izoh shu qatordan OLDIN qidiriladi.
const STATEMENT_TYPES = new Set(['VariableDeclaration', 'ExpressionStatement', 'ReturnStatement']);

/**
 * Chaqiruv obyekti haqiqatan Prisma accessor'ligini tekshiradi:
 * `this.prisma.<model>.findMany(...)` yoki `tx.<model>.findFirst(...)`
 * (tranzaksiya klienti — butun repo shu konvensiyani ishlatadi).
 *
 * Bu ataylab TOR: shunchaki nomi "findMany"/"findFirst" bo'lgan ISTALGAN
 * metod (masalan `AdminQueryService.findMany(delegate, args)` — o'zining
 * ustidan o'tkazuvchi wrapper, Prisma emas) mos kelmasligi kerak. AC matni
 * ham aynan "prisma.*.findMany/findFirst" deydi, umuman ".findMany" emas.
 */
function isPrismaModelAccessor(objectNode) {
  if (objectNode.type !== 'MemberExpression') return false; // masalan `delegate`/`svc` — bitta identifikator, Prisma emas
  const inner = objectNode.object;
  if (inner.type === 'MemberExpression') {
    // this.prisma.<model>  yoki  someThing.prisma.<model>
    return inner.property.type === 'Identifier' && inner.property.name === 'prisma';
  }
  if (inner.type === 'Identifier') {
    // prisma.<model> (destrukturlangan) yoki tx.<model> ($transaction callback)
    return inner.name === 'prisma' || inner.name === 'tx';
  }
  return false;
}

function isPrismaCall(node) {
  // `<...>.findMany(...)` yoki `<...>.findFirst(...)` shaklidagi chaqiruv.
  return (
    node.callee.type === 'MemberExpression' &&
    node.callee.property.type === 'Identifier' &&
    TARGET_METHODS.has(node.callee.property.name) &&
    isPrismaModelAccessor(node.callee.object)
  );
}

function propertyKeyName(prop) {
  if (prop.type !== 'Property') return null;
  if (prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') return prop.key.value;
  return null;
}

/** `where` obyektining FAQAT o'z (top-level) xususiyatlarini tekshiradi —
 * ichki `include.X.where` alohida so'rov-qarori emas, tekshirilmaydi. */
function hasOwnershipKey(whereObjectExpression) {
  if (!whereObjectExpression || whereObjectExpression.type !== 'ObjectExpression') return false;
  return whereObjectExpression.properties.some((prop) => {
    const name = propertyKeyName(prop);
    if (!name) return false;
    const lower = name.toLowerCase();
    return OWNERSHIP_SUFFIXES.some((suffix) => lower.endsWith(suffix));
  });
}

function findWhereArgument(callNode) {
  const arg = callNode.arguments[0];
  if (!arg || arg.type !== 'ObjectExpression') return null;
  const whereProp = arg.properties.find((p) => propertyKeyName(p) === 'where');
  if (!whereProp || whereProp.type !== 'Property') return null;
  return whereProp.value;
}

function findEnclosingStatement(node) {
  let current = node;
  while (current.parent && !STATEMENT_TYPES.has(current.type)) {
    current = current.parent;
  }
  return current;
}

function hasEscapeComment(sourceCode, callNode) {
  const statement = findEnclosingStatement(callNode);
  const comments = sourceCode.getCommentsBefore(statement);
  return comments.some((c) => ESCAPE_COMMENT_RE.test(c.value));
}

const createRule = ESLintUtils.RuleCreator(
  () => 'https://github.com/agentnet/agentnet/blob/master/docs/ENGINEERING_CONTRACT.md#sec-06',
);

module.exports = createRule({
  name: 'require-tenant-scope',
  meta: {
    type: 'problem',
    docs: {
      description:
        'SEC-06: har bir findMany/findFirst tenant-scoped (userId/ownerId/creatorId/actorId, ' +
        "suffiks bo'yicha) bo'lishi yoki oltita tan olingan istisno-izohlaridan biri bilan " +
        "belgilanishi shart.",
    },
    schema: [],
    messages: {
      missingScope:
        "SEC-06: '{{method}}' chaqiruvi tenant-scoped emas (where'da userId/ownerId/creatorId/" +
        "actorId — yoki ularning prefiksli varianti — yo'q) va oltita tan olingan istisno-" +
        'izohlarining birortasi ham yo\'q (@admin-scope, @system-scope, @public-scope, ' +
        '@preauth-scope, @upstream-scope, @org-scope). So\'rovni scope qiling yoki sababini ' +
        "izoh bilan aniq ko'rsating.",
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    return {
      CallExpression(node) {
        if (!isPrismaCall(node)) return;

        const where = findWhereArgument(node);
        if (hasOwnershipKey(where)) return;
        if (hasEscapeComment(sourceCode, node)) return;

        context.report({
          node,
          messageId: 'missingScope',
          data: { method: node.callee.property.name },
        });
      },
    };
  },
});
