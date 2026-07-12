import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

/** Inventar: mahsulotlar ro'yxati va demo do'kon urug'lanishi. */
export class RetailInventory {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(user: User) {
    return this.prisma.retailProduct.findMany({ where: { userId: user.id }, orderBy: { name: 'asc' } });
  }

  async upsertProduct(
    user: User,
    dto: { sku: string; name: string; stock?: number; reorderLevel?: number; price?: number; shelfZone?: string },
  ) {
    return this.prisma.retailProduct.upsert({
      where: { userId_sku: { userId: user.id, sku: dto.sku } },
      create: {
        userId: user.id, sku: dto.sku, name: dto.name,
        stock: dto.stock ?? 0, reorderLevel: dto.reorderLevel ?? 5,
        price: dto.price ?? 0, shelfZone: dto.shelfZone ?? null,
      },
      update: {
        name: dto.name,
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.reorderLevel !== undefined && { reorderLevel: dto.reorderLevel }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.shelfZone !== undefined && { shelfZone: dto.shelfZone }),
      },
    });
  }

  /** Demo do'kon — tez boshlash va sinov uchun. */
  async seedDemo(user: User) {
    const demo = [
      { sku: 'COLA-1L', name: 'Coca-Cola 1L', stock: 24, reorderLevel: 6, price: 1_500_000, shelfZone: 'A1' },
      { sku: 'NON-PATIR', name: 'Patir non', stock: 8, reorderLevel: 10, price: 500_000, shelfZone: 'B2' },
      { sku: 'SUT-1L', name: "Sut 1L (Nestle)", stock: 2, reorderLevel: 5, price: 1_400_000, shelfZone: 'C1' },
      { sku: 'YOG-5L', name: "O'simlik yog'i 5L", stock: 12, reorderLevel: 4, price: 9_500_000, shelfZone: 'C3' },
    ];
    for (const p of demo) await this.upsertProduct(user, p);
    return this.listProducts(user);
  }
}
