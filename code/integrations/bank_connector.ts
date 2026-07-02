/**
 * AgentNet — Bank/To'lov Integratsiya Adapteri
 * ------------------------------------------------------------
 * Bitta umumiy BankConnector interfeysi orqali turli to'lov
 * provayderlarini (Payme, Click — O'zbekiston; Plaid — xalqaro)
 * birlashtiradi. Har bir tranzaksiya halal-moliya agenti uchun
 * riba/foiz belgisi bilan teglanadi.
 *
 * Talab qilinadigan paketlar:
 *   npm i axios
 */

import axios, { AxiosInstance } from 'axios';

// ----------------------------------------------------------------
// Umumiy turlar
// ----------------------------------------------------------------

export interface NormalizedTransaction {
  id: string;
  provider: 'payme' | 'click' | 'uzum' | 'plaid';
  amount: number; // tiyin/cent birligida (butun son, float xatolaridan saqlanish uchun)
  currency: string; // "UZS" | "USD" ...
  description: string;
  occurredAt: string; // ISO 8601
  /** Halal-moliya agenti uchun: tranzaksiya tasvirida riba/foiz belgisi bormi */
  interestFlag: boolean;
  rawCategory?: string;
}

export interface BalanceResult {
  accountId: string;
  available: number;
  currency: string;
}

/** Har bir bank/to'lov provayderi shu interfeysni amalga oshiradi */
export interface BankConnector {
  readonly providerName: string;
  getBalance(accountId: string): Promise<BalanceResult>;
  getTransactions(accountId: string, since: Date): Promise<NormalizedTransaction[]>;
}

// ----------------------------------------------------------------
// Riba/foiz aniqlash — oddiy lug'at-asoslangan heuristika
// (Halal Filter'ning moliya-maxsus moduli bilan kelajakda chuqurlashtiriladi)
// ----------------------------------------------------------------

const INTEREST_KEYWORDS = [
  /foiz/i,
  /kredit\s+stavkasi/i,
  /interest/i,
  /late\s+fee/i,
  /penya/i,
];

function detectInterestFlag(description: string): boolean {
  return INTEREST_KEYWORDS.some((re) => re.test(description));
}

// ----------------------------------------------------------------
// Payme adapter
// ----------------------------------------------------------------

export class PaymeAdapter implements BankConnector {
  readonly providerName = 'payme' as const;
  private client: AxiosInstance;

  constructor(merchantId: string, secretKey: string) {
    this.client = axios.create({
      baseURL: 'https://checkout.paycom.uz/api',
      headers: {
        'X-Auth': `${merchantId}:${secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async getBalance(accountId: string): Promise<BalanceResult> {
    // Payme Business API — haqiqiy endpoint nomi hamkorlik shartnomasiga ko'ra farqlanadi
    const { data } = await this.client.post('/merchant/balance', { account: accountId });
    return { accountId, available: data.balance, currency: 'UZS' };
  }

  async getTransactions(accountId: string, since: Date): Promise<NormalizedTransaction[]> {
    const { data } = await this.client.post('/merchant/transactions', {
      account: accountId,
      from: since.toISOString(),
    });

    return (data.transactions ?? []).map((tx: any) => ({
      id: tx.id,
      provider: 'payme' as const,
      amount: tx.amount,
      currency: 'UZS',
      description: tx.description ?? '',
      occurredAt: tx.create_time,
      interestFlag: detectInterestFlag(tx.description ?? ''),
      rawCategory: tx.category,
    }));
  }
}

// ----------------------------------------------------------------
// Click adapter (Merchant API)
// ----------------------------------------------------------------

export class ClickAdapter implements BankConnector {
  readonly providerName = 'click' as const;
  private client: AxiosInstance;

  constructor(merchantId: string, serviceId: string, secretKey: string) {
    this.client = axios.create({
      baseURL: 'https://api.click.uz/v2/merchant',
      headers: { 'Content-Type': 'application/json' },
    });
    // Click HMAC-asoslangan auth talab qiladi — har so'rovda imzo generatsiyasi kerak bo'ladi.
    this.client.interceptors.request.use((config) => {
      config.headers['Auth'] = this._buildAuthHeader(merchantId, serviceId, secretKey);
      return config;
    });
  }

  private _buildAuthHeader(merchantId: string, serviceId: string, secretKey: string): string {
    const crypto = require('crypto');
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = crypto
      .createHash('sha1')
      .update(`${timestamp}${secretKey}`)
      .digest('hex');
    return `${merchantId}:${digest}:${timestamp}`;
  }

  async getBalance(accountId: string): Promise<BalanceResult> {
    const { data } = await this.client.get(`/accounts/${accountId}/balance`);
    return { accountId, available: data.balance, currency: 'UZS' };
  }

  async getTransactions(accountId: string, since: Date): Promise<NormalizedTransaction[]> {
    const { data } = await this.client.get(`/accounts/${accountId}/payments`, {
      params: { from: since.toISOString() },
    });

    return (data.payments ?? []).map((tx: any) => ({
      id: String(tx.payment_id),
      provider: 'click' as const,
      amount: tx.amount,
      currency: 'UZS',
      description: tx.note ?? '',
      occurredAt: tx.create_time,
      interestFlag: detectInterestFlag(tx.note ?? ''),
    }));
  }
}

// ----------------------------------------------------------------
// Plaid adapter — xalqaro kengayish uchun (Open Banking)
// ----------------------------------------------------------------

export class PlaidAdapter implements BankConnector {
  readonly providerName = 'plaid' as const;
  private client: AxiosInstance;

  constructor(clientId: string, secret: string, env: 'sandbox' | 'production' = 'sandbox') {
    this.client = axios.create({
      baseURL: `https://${env}.plaid.com`,
      headers: { 'Content-Type': 'application/json' },
    });
    this.client.defaults.data = { client_id: clientId, secret };
  }

  async getBalance(accountId: string): Promise<BalanceResult> {
    const { data } = await this.client.post('/accounts/balance/get', { account_id: accountId });
    const account = data.accounts.find((a: any) => a.account_id === accountId);
    return {
      accountId,
      available: account?.balances?.available ?? 0,
      currency: account?.balances?.iso_currency_code ?? 'USD',
    };
  }

  async getTransactions(accountId: string, since: Date): Promise<NormalizedTransaction[]> {
    const { data } = await this.client.post('/transactions/get', {
      start_date: since.toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      options: { account_ids: [accountId] },
    });

    return (data.transactions ?? []).map((tx: any) => ({
      id: tx.transaction_id,
      provider: 'plaid' as const,
      amount: Math.round(tx.amount * 100),
      currency: tx.iso_currency_code ?? 'USD',
      description: tx.name ?? '',
      occurredAt: tx.date,
      interestFlag: detectInterestFlag(tx.name ?? ''),
      rawCategory: tx.category?.[0],
    }));
  }
}

// ----------------------------------------------------------------
// Factory — moliya agenti shu orqali to'g'ri adapterni oladi
// ----------------------------------------------------------------

export type BankProviderConfig =
  | { provider: 'payme'; merchantId: string; secretKey: string }
  | { provider: 'click'; merchantId: string; serviceId: string; secretKey: string }
  | { provider: 'plaid'; clientId: string; secret: string; env?: 'sandbox' | 'production' };

export function createBankConnector(config: BankProviderConfig): BankConnector {
  switch (config.provider) {
    case 'payme':
      return new PaymeAdapter(config.merchantId, config.secretKey);
    case 'click':
      return new ClickAdapter(config.merchantId, config.serviceId, config.secretKey);
    case 'plaid':
      return new PlaidAdapter(config.clientId, config.secret, config.env);
    default:
      throw new Error(`Noma'lum bank provayderi: ${(config as any).provider}`);
  }
}
