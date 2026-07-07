import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { PosAdapter, PosProductSnapshot, PosSaleRecord } from './pos-adapter';

/**
 * "Manual" POS adapter — foydalanuvchi o'zi mahsulot/savdo kiritadigan
 * hozirgi rejim (real kassa integratsiyasi bo'lmagan do'konlar uchun).
 */
@Injectable()
export class ManualPosAdapter implements PosAdapter {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(userId: string): Promise<PosProductSnapshot[]> {
    const products = await this.prisma.retailProduct.findMany({ where: { userId } });
    return products.map((p) => ({
      sku: p.sku,
      name: p.name,
      stock: p.stock,
      reorderLevel: p.reorderLevel,
      price: p.price,
    }));
  }

  async listSales(userId: string, sinceDate: Date): Promise<PosSaleRecord[]> {
    const sales = await this.prisma.retailSale.findMany({
      where: { userId, createdAt: { gte: sinceDate } },
      select: { sku: true, qty: true, total: true, createdAt: true },
    });
    return sales.map((s) => ({ sku: s.sku, qty: s.qty, total: s.total, at: s.createdAt }));
  }

  async recordSale(userId: string, dto: { sku: string; qty: number; total?: number }) {
    const product = await this.prisma.retailProduct.findUnique({
      where: { userId_sku: { userId, sku: dto.sku } },
    });
    if (!product) throw new NotFoundException(`Mahsulot topilmadi: ${dto.sku}`);

    const total = dto.total ?? product.price * dto.qty;
    await this.prisma.retailSale.create({
      data: { userId, sku: dto.sku, qty: dto.qty, total },
    });
    const updated = await this.prisma.retailProduct.update({
      where: { id: product.id },
      data: { stock: Math.max(0, product.stock - dto.qty) },
    });
    return { sku: dto.sku, qty: dto.qty, total, stock: updated.stock };
  }
}
