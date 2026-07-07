/**
 * POS-integratsiya interfeysi. Hozircha faqat "manual" (foydalanuvchi o'zi
 * kiritadigan) implementatsiya bor — RetailProduct/RetailSale jadvallari
 * ustidan. Haqiqiy POS (Chek.uz, iiko, r_keeper, 1C va h.k.) ulanganda shu
 * interfeysni implement qiluvchi yangi adapter yoziladi, RetailService
 * o'zgarmaydi (Dependency Inversion — biznes mantiq POS turi bilan bog'liq
 * bo'lmasin).
 */

export interface PosProductSnapshot {
  sku: string;
  name: string;
  stock: number;
  reorderLevel: number;
  price: number; // UZS tiyin
}

export interface PosSaleRecord {
  sku: string;
  qty: number;
  total: number; // UZS tiyin
  at: Date;
}

export interface PosAdapter {
  /** Do'kondagi joriy inventar holati. */
  listProducts(userId: string): Promise<PosProductSnapshot[]>;

  /** Berilgan oyna ichidagi savdolar (bashorat hisob-kitobi uchun). */
  listSales(userId: string, sinceDate: Date): Promise<PosSaleRecord[]>;

  /** Yangi savdo yozuvi + inventar kamayishi (atomik). */
  recordSale(
    userId: string,
    dto: { sku: string; qty: number; total?: number },
  ): Promise<{ sku: string; qty: number; total: number; stock: number }>;
}

export const POS_ADAPTER = Symbol('POS_ADAPTER');
