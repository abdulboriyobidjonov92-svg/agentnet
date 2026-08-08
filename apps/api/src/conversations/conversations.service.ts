import { Injectable, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TwinService } from '../twin/twin.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { paginate, type PageQuery } from '../common/pagination/paginate';
import type { Message, User } from '@prisma/client';
import type { AddMessageDto } from './dto/add-message.dto';

/**
 * A15: xabarlar endi `Message` jadvalida (Contract A12). Bu interfeys —
 * TASHQI API shakli (frontend/engine `conversationHistory` shu ko'rinishda
 * ishlaydi); jadval qatori `toApiMessage()` bilan shu shaklga o'giriladi,
 * ya'ni cutover mavjud mijozlar uchun ko'rinmas.
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  halalFlag?: string;
  demoMode?: boolean;
  timestamp: string;
}

/** Jadval qatori -> tashqi API shakli (legacy JSON bilan bir xil). */
export function toApiMessage(row: Message): ConversationMessage {
  return {
    role: row.role,
    content: row.content,
    ...(row.halalFlag !== null && { halalFlag: row.halalFlag }),
    ...(row.demoMode && { demoMode: true }),
    timestamp: row.createdAt.toISOString(),
  };
}

/**
 * A15 tartib shartnomasi: `(createdAt, id)` — id (cuid, jarayon ichida
 * monotonik) teng timestamp'da teng-buzuvchi. Backfill id'lari
 * (`<convId>_m000001`) ham massiv tartibida leksikografik o'suvchi.
 */
const MESSAGE_ORDER = [{ createdAt: 'asc' }, { id: 'asc' }] as const;

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly twin?: TwinService,
    @Optional() private readonly marketplace?: MarketplaceService,
  ) {}

  async create(user: User, agentId: string) {
    // Agent mavjudligini tekshirish
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent topilmadi');

    // A15: `messages` endi jadvalda — legacy Json ustuni (legacyMessages)
    // yangi suhbatlarda umuman to'ldirilmaydi (u muzlatilgan).
    return this.prisma.conversation.create({
      data: { userId: user.id, agentId },
      include: { agent: { select: { name: true, model: true } } },
    });
  }

  /** Phase 3: kursorli pagination shartnomasi (Konstitutsiya #24). */
  async findAll(user: User, agentId?: string, page: PageQuery = {}) {
    return paginate(
      this.prisma.conversation,
      {
        where: { userId: user.id, ...(agentId && { agentId }) },
        orderBy: { updatedAt: 'desc' },
        include: { agent: { select: { name: true } } },
      },
      page,
    );
  }

  /**
   * Egalik tekshiruvi (IDOR himoyasi) — xabarlarsiz, yengil so'rov.
   * Har xabar-amali shu darvozadan o'tadi.
   */
  private async assertOwned(id: string, user: User) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
      select: { id: true, userId: true, agentId: true },
    });
    if (!conv) throw new NotFoundException('Suhbat topilmadi');
    if (conv.userId !== user.id) throw new ForbiddenException();
    return conv;
  }

  /**
   * Suhbat + TO'LIQ xabarlar tarixi (legacy API shakli saqlangan: `messages`
   * massivi). Chat UI ochilishda to'liq tarixni ko'rsatadi — bu joriy UX.
   * Katta tarix uchun sahifalangan `messages()` endpointi ham bor.
   */
  async findOne(id: string, user: User) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        agent: { select: { name: true, model: true, systemPrompt: true } },
        messages: { orderBy: [...MESSAGE_ORDER] },
      },
    });
    if (!conv) throw new NotFoundException('Suhbat topilmadi');
    if (conv.userId !== user.id) throw new ForbiddenException();

    // `messages` — jadvaldan, eski JSON bilan bir xil shaklda.
    const { messages, ...rest } = conv;
    return { ...rest, messages: messages.map(toApiMessage) };
  }

  /**
   * A15: xabarlar sahifasi — eng yangilari birinchi, `?limit=<=100&cursor=<id>`.
   * Katta suhbatda to'liq tarixni xotiraga yuklamaslik uchun.
   */
  async messages(id: string, user: User, page: PageQuery = {}) {
    await this.assertOwned(id, user);

    // @upstream-scope: egalik yuqorida assertOwned() bilan tekshirilgan
    const result = await paginate(
      this.prisma.message,
      { where: { conversationId: id }, orderBy: { createdAt: 'desc' } },
      page,
    );
    return { ...result, items: result.items.map(toApiMessage) };
  }

  async addMessage(id: string, user: User, dto: AddMessageDto) {
    await this.assertOwned(id, user);
    const [row] = await this.appendRows(id, [dto]);
    return toApiMessage(row);
  }

  async addMessages(id: string, user: User, dtos: AddMessageDto[]) {
    const conv = await this.assertOwned(id, user);
    const rows = await this.appendRows(id, dtos);

    // Life Twin: foydalanuvchi xabarlaridan faktlar fon rejimida ajratiladi.
    // Fire-and-forget — suhbat oqimini hech qachon sekinlashtirmaydi.
    const userText = dtos
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join('\n');
    if (userText && this.twin) {
      void this.twin.extractAndStore(user, userText, 'conversation');
    }

    // S8: Marketplace usage-tracking — o'rnatilgan agent har ishlaganda manba
    // agent hisobiga haqiqiy foydalanish yoziladi (reyting + verified asosi).
    // Fire-and-forget — suhbatni sekinlashtirmaydi.
    if (this.marketplace) {
      void this.trackMarketplaceUsage(conv.agentId, dtos);
    }

    return rows.map(toApiMessage);
  }

  /**
   * Xabarlarni jadvalga qo'shadi + suhbat `updatedAt`ini yangilaydi (ro'yxat
   * "oxirgi faollik" bo'yicha tartiblanadi).
   *
   * KONKURENTLIK: JSON davridagi o'qi-o'zgartir-yoz sikli YO'QOLDI — har
   * xabar mustaqil INSERT, ya'ni parallel yozuvlar bir-birini o'chira
   * olmaydi va advisory lock KERAK EMAS. Bir partiya ichida tartib:
   * ketma-ket `create` (bir xil timestamp'da cuid teng-buzuvchi jarayon
   * ichida monotonik — kiritilgan tartib saqlanadi).
   */
  private async appendRows(conversationId: string, dtos: AddMessageDto[]): Promise<Message[]> {
    if (dtos.length === 0) return [];

    return this.prisma.$transaction(async (tx) => {
      const rows: Message[] = [];
      for (const dto of dtos) {
        rows.push(
          await tx.message.create({
            data: {
              conversationId,
              role: dto.role,
              content: dto.content,
              halalFlag: dto.halalFlag ?? null,
              demoMode: dto.demoMode ?? false,
              createdAt: dto.timestamp ? new Date(dto.timestamp) : new Date(),
            },
          }),
        );
      }
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      return rows;
    });
  }

  private async trackMarketplaceUsage(agentId: string, newMessages: AddMessageDto[]) {
    try {
      const agent = await this.prisma.agent.findUnique({
        where: { id: agentId },
        select: { sourceAgentId: true },
      });
      if (!agent?.sourceAgentId) return;
      const assistant = newMessages.filter((m) => m.role === 'assistant');
      if (!assistant.length) return;
      const success = assistant.some((m) => m.content?.trim() && m.halalFlag !== 'BLOCK');
      await this.marketplace!.recordUsage(agent.sourceAgentId, success);
    } catch {
      /* usage-tracking hech qachon suhbatni buzmasin */
    }
  }

  async clear(id: string, user: User) {
    await this.assertOwned(id, user);
    // Cascade emas, aniq deleteMany: suhbatning O'ZI qoladi, faqat tarix o'chadi.
    await this.prisma.message.deleteMany({ where: { conversationId: id } });
    return { cleared: true };
  }

  async remove(id: string, user: User) {
    await this.assertOwned(id, user);
    // Message qatorlari FK `onDelete: Cascade` bilan birga o'chadi.
    return this.prisma.conversation.delete({ where: { id } });
  }
}
