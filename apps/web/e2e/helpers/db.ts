import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// Web'da alohida DB konfiguratsiyasi yo'q — API'ning DATABASE_URL'ini o'qiymiz.
dotenv.config({ path: path.resolve(__dirname, '../../../api/.env') });

let prisma: PrismaClient | undefined;

function client(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

/**
 * Yangi dev-login foydalanuvchisi balansi 0'dan boshlanadi, agent yaratish esa
 * HAQIQIY pul yechadi (Y4 narxlash). E2E to'lov shlyuzini (Payme/Click) simulyatsiya
 * qilmaydi, shuning uchun balansni to'g'ridan-to'g'ri DB orqali to'ldiramiz —
 * bu faqat to'lovni chetlab o'tadi, agent-yaratish narxlash mantig'ining o'zi
 * (create() ichidagi atomik yechish) baribir haqiqiy yo'l bilan ishlaydi.
 */
export async function topUpBalance(userId: string, tiyin: number): Promise<void> {
  await client().user.update({
    where: { id: userId },
    data: { balanceTiyin: { increment: tiyin } },
  });
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
}
