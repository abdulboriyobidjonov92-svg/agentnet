/**
 * S2: Connector SDK — yagona interfeys.
 *
 * Har bir integratsiya UCHTA narsani bir xil shaklda e'lon qiladi:
 *   1. AUTH SCHEMA   — qanday hisob ma'lumotlari kerak (fields)
 *   2. ACTION SCHEMA — qanday amallar bor va parametrlari (params)
 *   3. DATA SCHEMA   — amal nima qaytaradi (returns tavsifi)
 *
 * Shu bir xillik tufayli yangi connector qo'shish = bitta fayl yozish.
 * Lindy 5000+ integratsiyaga shu naqsh bilan yetgan. To'liq qo'llanma:
 * docs/CONNECTOR_SDK.md
 */

export type AuthType = 'api_key' | 'token' | 'basic' | 'webhook_url' | 'none';

export interface ConfigField {
  key: string;
  label: string;
  required: boolean;
  secret?: boolean; // UI'da yashiriladi
  placeholder?: string;
  help?: string;
}

export interface ParamSpec {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  required: boolean;
  example?: string;
}

export interface ConnectorAction {
  id: string; // masalan: "send_message"
  label: string;
  description: string;
  params: ParamSpec[];
  returns: string; // data schema tavsifi
}

export interface ConnectorResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  /** Hisob ma'lumotlari yetishmasa yoki rasmiy shartnoma kerak bo'lsa — halol belgi */
  needs?: 'credentials' | 'agreement';
  note?: string;
}

export interface ExecuteContext {
  /** ConnectorConfig.config — foydalanuvchining saqlangan sozlamalari */
  config: Record<string, any>;
  userId: string;
}

export interface ConnectorDefinition {
  id: string; // registry slug: "telegram-bot"
  name: string;
  category: 'messaging' | 'crm' | 'ecommerce' | 'payments' | 'accounting' | 'logistics' | 'government' | 'data';
  description: string;
  region?: string; // "UZ/CIS" | "global"
  docsUrl?: string;
  auth: { type: AuthType; fields: ConfigField[] };
  actions: ConnectorAction[];
  /**
   * live — hisob ma'lumotlari bilan darhol ishlaydi;
   * agreement_required — rasmiy kelishuv/API ruxsati shart (halol stub)
   */
  availability: 'live' | 'agreement_required';
  execute(actionId: string, params: Record<string, any>, ctx: ExecuteContext): Promise<ConnectorResult>;
}

/** Majburiy config maydonlari to'liqligini tekshiradi. */
export function missingFields(def: ConnectorDefinition, config: Record<string, any>): string[] {
  return def.auth.fields.filter((f) => f.required && !config?.[f.key]).map((f) => f.key);
}

/** Har bir connector ishlatadigan standart natija yasagichlar. */
export const ok = (data: unknown, note?: string): ConnectorResult => ({ ok: true, data, note });
export const fail = (error: string): ConnectorResult => ({ ok: false, error });
export const needsCredentials = (fields: string[]): ConnectorResult => ({
  ok: false,
  needs: 'credentials',
  error: `Missing credentials: ${fields.join(', ')}. Configure this connector first.`,
});
export const needsAgreement = (note: string): ConnectorResult => ({
  ok: false,
  needs: 'agreement',
  error: 'Official access agreement required',
  note,
});
