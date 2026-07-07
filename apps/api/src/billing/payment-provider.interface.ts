import type { User } from '@prisma/client';

/**
 * Har bir to'lov provayderi (Payme, Click, ...) shu interfeysni implement
 * qiladi. Simlar protokoli har xil (Payme — JSON-RPC, Click — Prepare/Complete
 * action), lekin platforma ularni bir xil tarzda ko'radi: "balansni to'ldirish
 * havolasi bering" va "sozlanganmi?". Balansni haqiqiy kreditlash mantig'i
 * (WalletCreditService) ikkalasida ham UMUMIY — shu yerda emas, chunki u
 * webhook wire-format'idan mustaqil.
 */

export interface TopupReceipt {
  provider: 'payme' | 'click';
  payUrl: string;
  amountSom: number;
  receiptId?: string;
}

export interface PaymentProviderService {
  readonly providerId: 'payme' | 'click';
  isConfigured(): boolean;
  createTopupReceipt(user: User, amountSom: number): Promise<TopupReceipt>;
}
