'use strict';

const { RuleTester } = require('eslint');
const tseslint = require('typescript-eslint');
const rule = require('./require-roles-on-admin');

/**
 * SEC-05 AC #6 — bu qoidaning o'zini sinaydi. Repo'da hozir 0 ta haqiqiy
 * `admin/*` controller bor (Phase 4 hali boshlanmagan), shuning uchun bu —
 * qoida to'g'ri ishlashini isbotlaydigan YAGONA amaliy tekshiruv.
 */
const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    sourceType: 'module',
  },
});

ruleTester.run('require-roles-on-admin', rule, {
  valid: [
    // 2) admin endpoint @Roles bilan (metod darajasida) -> o'tadi
    {
      code: `
        @Controller('admin/users')
        class AdminUsersController {
          @Get()
          @Roles(UserRole.OWNER, UserRole.ADMIN)
          list() {}
        }
      `,
    },
    // klass-darajasidagi @Roles butun controller'ni qamraydi -> o'tadi
    {
      code: `
        @Roles(UserRole.OWNER)
        @Controller('admin')
        class AdminDashboardController {
          @Get()
          dashboard() {}

          @Post('refresh')
          refresh() {}
        }
      `,
    },
    // 3) admin BO'LMAGAN controller, @Roles yo'q -> o'tadi
    {
      code: `
        @Controller('feedback')
        class FeedbackController {
          @Get()
          list() {}
        }
      `,
    },
    // HTTP-metod dekoratorisiz metodlar (konstruktor, xususiy helper) e'tiborga olinmaydi
    {
      code: `
        @Controller('admin')
        class AdminController {
          constructor(private readonly svc: Svc) {}

          @Get()
          @Roles(UserRole.OWNER)
          list() {}

          private helper() {}
        }
      `,
    },
    // "admin" bilan boshlanadigan-lekin-admin-BO'LMAGAN yo'l (masalan "administration")
    // — faqat aniq "admin" yoki "admin/..." segmenti mos keladi.
    {
      code: `
        @Controller('administration-notes')
        class AdministrationNotesController {
          @Get()
          list() {}
        }
      `,
    },
  ],
  invalid: [
    // 1) admin endpoint @Roles'siz -> lint xato
    {
      code: `
        @Controller('admin/users')
        class AdminUsersController {
          @Get()
          list() {}
        }
      `,
      errors: [{ messageId: 'missingRoles' }],
    },
    // faqat @Controller('admin') (kichik prefiks, ichki segmentsiz)
    {
      code: `
        @Controller('admin')
        class AdminController {
          @Post('refresh')
          refresh() {}
        }
      `,
      errors: [{ messageId: 'missingRoles' }],
    },
    // ko'p metodli controller — @Roles'ga ega BO'LMAGAN har bir metod uchun
    // ALOHIDA xato (2tasi @Roles'siz, 1tasi bor)
    {
      code: `
        @Controller('admin/billing')
        class AdminBillingController {
          @Get()
          list() {}

          @Get(':id')
          @Roles(UserRole.OWNER)
          detail() {}

          @Post(':id/close')
          close() {}
        }
      `,
      errors: [{ messageId: 'missingRoles' }, { messageId: 'missingRoles' }],
    },
  ],
});

// eslint-disable-next-line no-console
console.log('require-roles-on-admin: barcha RuleTester holatlari o\'tdi.');
