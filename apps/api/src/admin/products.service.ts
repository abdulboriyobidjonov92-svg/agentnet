import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  list(params: { categoryId?: string; search?: string; limit?: number }) {
    return this.prisma.product.findMany({
      where: {
        categoryId: params.categoryId,
        name: params.search ? { contains: params.search, mode: 'insensitive' } : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(params.limit ?? 100, 1), 500),
      include: { category: { select: { id: true, name: true, icon: true } } },
    });
  }

  async create(dto: CreateProductDto) {
    const clash = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
    if (clash) throw new ConflictException('Bu SKU allaqachon band');
    return this.prisma.product.create({
      data: {
        name: dto.name.trim(),
        sku: dto.sku.trim(),
        description: dto.description,
        priceTiyin: dto.priceTiyin ?? 0,
        stock: dto.stock ?? 0,
        imageUrl: dto.imageUrl,
        isActive: dto.isActive ?? true,
        categoryId: dto.categoryId,
      },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.assertExists(id);
    if (dto.sku) {
      const clash = await this.prisma.product.findFirst({ where: { sku: dto.sku, NOT: { id } } });
      if (clash) throw new ConflictException('Bu SKU allaqachon band');
    }
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.product.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Tovar topilmadi');
  }
}
