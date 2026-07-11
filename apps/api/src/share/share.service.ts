import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, type User } from '@prisma/client';

const ALLOWED_KINDS = ['retail_forecast', 'twin', 'goal', 'generic'] as const;

export interface Metric {
  label: string;
  value: string;
  hint?: string;
}

export interface CreateShareDto {
  kind?: string;
  title: string;
  subtitle?: string;
  metrics?: Metric[];
  body?: string;
  locale?: string;
}

/**
 * Ulashilgan natija — foydalanuvchi natijasining ommaviy suratkashi (PLG).
 * Snapshot saqlanadi; /s/<token>'da watermark bilan ochiladi. Kirish kodi emas —
 * token faqat "havolani bilgan ko'radi" (maxfiy ma'lumot bu yerga QO'YILMASLIGI kerak,
 * frontend faqat foydalanuvchi tanlagan raqamlarni yuboradi).
 */
@Injectable()
export class ShareService {
  constructor(private readonly prisma: PrismaService) {}

  private token(): string {
    return randomBytes(9).toString('base64url'); // ~12 belgi, URL-xavfsiz
  }

  private sanitizeMetrics(metrics?: Metric[]): Metric[] {
    if (!Array.isArray(metrics)) return [];
    return metrics.slice(0, 6).map((m) => ({
      label: String(m?.label ?? '').slice(0, 40),
      value: String(m?.value ?? '').slice(0, 40),
      ...(m?.hint ? { hint: String(m.hint).slice(0, 80) } : {}),
    }));
  }

  async create(user: User, dto: CreateShareDto) {
    const kind = (ALLOWED_KINDS as readonly string[]).includes(dto.kind ?? '') ? dto.kind! : 'generic';
    const created = await this.prisma.sharedResult.create({
      data: {
        token: this.token(),
        ownerId: user.id,
        kind,
        title: String(dto.title).slice(0, 120),
        subtitle: dto.subtitle ? String(dto.subtitle).slice(0, 160) : null,
        metrics: this.sanitizeMetrics(dto.metrics) as unknown as Prisma.InputJsonValue,
        body: dto.body ? String(dto.body).slice(0, 1000) : null,
        locale: ['uz', 'ru', 'en'].includes(dto.locale ?? '') ? dto.locale! : 'uz',
      },
      select: { token: true },
    });
    return { token: created.token };
  }

  /** Public — kirishsiz. Ko'rishlar sonini oshiradi va watermark uchun egasining ismini beradi. */
  async getPublic(token: string) {
    const row = await this.prisma.sharedResult.findUnique({
      where: { token },
      include: { owner: { select: { name: true } } },
    });
    if (!row) throw new NotFoundException('Ulashilgan natija topilmadi');
    // Best-effort ko'rish hisoblagichi (natijani bloklamaydi)
    this.prisma.sharedResult
      .update({ where: { token }, data: { views: { increment: 1 } } })
      .catch(() => undefined);
    return {
      kind: row.kind,
      title: row.title,
      subtitle: row.subtitle,
      metrics: (row.metrics as Metric[] | null) ?? [],
      body: row.body,
      locale: row.locale,
      createdAt: row.createdAt,
      views: row.views + 1,
      authorName: row.owner?.name ?? null,
    };
  }
}
