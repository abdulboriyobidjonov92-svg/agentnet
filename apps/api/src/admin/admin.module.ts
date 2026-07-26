import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';
import { AdminGuard } from './admin.guard';
import { AdminCategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { AdminProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { AdminAgentsController } from './agents-admin.controller';
import { AgentsAdminService } from './agents-admin.service';
import { AdminStatsController } from './stats.controller';
import { AdminStatsService } from './stats.service';

/**
 * Super-admin paneli (User.role === "OWNER"): kategoriyalar, tovar kataloghi,
 * istalgan foydalanuvchining agentini moderatsiya qilish, va bosh sahifa
 * uchun grafik ko'rsatkichlar. Barcha controller'lar ClerkGuard + AdminGuard
 * bilan himoyalangan (autentifikatsiya, keyin super-admin tekshiruvi).
 */
@Module({
  imports: [AuthModule],
  controllers: [
    AdminCategoriesController,
    AdminProductsController,
    AdminAgentsController,
    AdminStatsController,
  ],
  providers: [ClerkGuard, AdminGuard, CategoriesService, ProductsService, AgentsAdminService, AdminStatsService],
})
export class AdminModule {}
