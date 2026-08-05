// @ts-check
'use strict';

const { ESLintUtils } = require('@typescript-eslint/utils');

/**
 * SEC-05 AC #6 — "@Roles bo'lmagan admin/* endpoint — xato."
 *
 * Har bir `@Controller('admin' | 'admin/...')` klassidagi HTTP-metod
 * dekoratorli (`@Get/@Post/@Patch/@Put/@Delete`) endpoint `@Roles(...)`ga
 * ega bo'lishi SHART — metod darajasida, YOKI butun klassni qamrab
 * oladigan klass-darajasidagi `@Roles(...)` orqali.
 *
 * Bu qoida bugun repo'da 0 ta haqiqiy `admin/*` controller borligi uchun
 * VAQINCHA hech narsani qizartirmaydi (Phase 4, Admin Panel, hali
 * boshlanmagan) — u kelajakdagi admin endpointlarni himoya qiladigan
 * oldindan-qo'yilgan darvoza.
 */

const HTTP_METHOD_DECORATORS = new Set(['Get', 'Post', 'Patch', 'Put', 'Delete']);

/** Dekoratorning chaqiruvchi ismini oladi (masalan `@Roles(...)` -> "Roles"). */
function decoratorCalleeName(decorator) {
  const expr = decorator.expression;
  if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier') {
    return expr.callee.name;
  }
  if (expr.type === 'Identifier') return expr.name;
  return null;
}

function hasDecorator(decorators, name) {
  return (decorators ?? []).some((d) => decoratorCalleeName(d) === name);
}

function httpMethodDecorator(decorators) {
  return (decorators ?? []).find((d) => HTTP_METHOD_DECORATORS.has(decoratorCalleeName(d) ?? ''));
}

/** `@Controller('admin')` yoki `@Controller('admin/...')` ekanini tekshiradi. */
function isAdminController(decorators) {
  const controllerDecorator = (decorators ?? []).find((d) => decoratorCalleeName(d) === 'Controller');
  if (!controllerDecorator) return false;

  const expr = controllerDecorator.expression;
  if (expr.type !== 'CallExpression' || expr.arguments.length === 0) return false;

  const arg = expr.arguments[0];
  if (arg.type !== 'Literal' || typeof arg.value !== 'string') return false;

  const path = arg.value.replace(/^\/+/, '');
  return path === 'admin' || path.startsWith('admin/');
}

const createRule = ESLintUtils.RuleCreator(
  () => 'https://github.com/agentnet/agentnet/blob/master/docs/ENGINEERING_CONTRACT.md#sec-05',
);

module.exports = createRule({
  name: 'require-roles-on-admin',
  meta: {
    type: 'problem',
    docs: {
      description: "SEC-05 AC #6: har bir admin/* endpoint @Roles(...) talab qiladi.",
    },
    schema: [],
    messages: {
      missingRoles:
        "SEC-05 AC #6: admin/* endpoint '{{method}}' uchun @Roles(...) yo'q. " +
        'Metod ustiga (yoki butun klass ustiga) @Roles(UserRole....) qo\'shing.',
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      ClassDeclaration(node) {
        if (!isAdminController(node.decorators)) return;
        // Butun klassni qamrab oluvchi @Roles(...) bo'lsa — bu klassdagi
        // BARCHA endpointlar uchun yetarli, alohida tekshiruv shart emas.
        if (hasDecorator(node.decorators, 'Roles')) return;

        for (const member of node.body.body) {
          if (member.type !== 'MethodDefinition') continue;
          const httpDecorator = httpMethodDecorator(member.decorators);
          if (!httpDecorator) continue; // @Roles talabi faqat HTTP-endpoint metodlariga tegishli
          if (hasDecorator(member.decorators, 'Roles')) continue;

          context.report({
            node: member.key,
            messageId: 'missingRoles',
            data: {
              method: member.key.type === 'Identifier' ? member.key.name : '<method>',
            },
          });
        }
      },
    };
  },
});
