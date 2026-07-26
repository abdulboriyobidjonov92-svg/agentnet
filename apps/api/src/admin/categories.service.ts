import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 100) || 'category';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(type?: string) {
    return this.prisma.category.findMany({
      where: type ? { type } : undefined,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { agents: true, products: true } } },
    });
  }

  async create(dto: CreateCategoryDto) {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    const clash = await this.prisma.category.findUnique({ where: { slug } });
    if (clash) throw new ConflictException('Bu slug allaqachon band');
    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        type: dto.type ?? 'product',
        icon: dto.icon,
        description: dto.description,
        order: dto.order ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.assertExists(id);
    if (dto.slug) {
      const slug = slugify(dto.slug);
      const clash = await this.prisma.category.findFirst({ where: { slug, NOT: { id } } });
      if (clash) throw new ConflictException('Bu slug allaqachon band');
      dto = { ...dto, slug };
    }
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.assertExists(id);
    // Bog'liq agent/product'lar o'chirilmaydi — faqat kategoriyasi bo'shatiladi
    // (onDelete: SetNull), shu sabab qattiq o'chirish xavfsiz.
    await this.prisma.category.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Kategoriya topilmadi');
  }
}
