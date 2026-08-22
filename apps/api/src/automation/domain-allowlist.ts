/**
 * SEC-07 — BRAUZER DOMEN ALLOWLIST'I (V3-P0 / P0-3).
 *
 * Blueprint: `docs/blueprints/P0_BLUEPRINT.md` §2.1 T1/T2, P0-3.
 * Spetsifikatsiya: `docs/strategy/SAFETY_POLICY_LAYER.md` §7, Contract SEC-07.
 *
 * MUAMMO. Agent o'qigan sahifaga yashirin ko'rsatma joylash (prompt injection)
 * orqali uni boshqa domenga olib ketish mumkin. U yerda agent foydalanuvchining
 * LOGIN sessiyasi bilan ishlaydi — ya'ni hujumchi foydalanuvchi nomidan amal
 * bajaradi. Bu — "lethal trifecta" ning eng aniq yo'li.
 *
 * IKKI HIMOYA, IKKALASI HAM SHART:
 *   1. NAVIGATSIYA — ruxsat etilmagan hostga o'tish bloklanadi (redirect ham).
 *   2. SESSIYA — kontekstga FAQAT allowlist domenlarining cookie'lari
 *      in'ektsiya qilinadi (`filterStorageState`). Busiz birinchi himoya
 *      yetarli emas: ruxsat etilgan domendagi injection foydalanuvchining
 *      BOSHQA saytdagi cookie'sini o'g'irlashi mumkin edi.
 *
 * FAIL-CLOSED. Allowlist bo'sh bo'lsa — HECH QAYERGA navigatsiya yo'q.
 * Bu ataylab: "sozlanmagan" holat "hamma narsaga ruxsat" degani BO'LMASLIGI
 * kerak (Konstitutsiya #2 ning ayni mantiqi: dekoratorsiz endpoint = MEMBER).
 *
 * SSRF USTUN. Bu qatlam `common/ssrf.ts` ni ALMASHTIRMAYDI va bekor QILMAYDI:
 * allowlist'ga `localhost` yozilsa ham SSRF filtri uni baribir bloklaydi.
 * Ikki filtr KETMA-KET ishlaydi (ikkalasidan o'tish shart).
 *
 * MODELDAN KELMAYDI. Allowlist agent EGASIDAN (konfiguratsiya) va deploy
 * env'idan keladi. Model uni o'zgartira olmaydi — aks holda injection uchun
 * eng qisqa chetlab o'tish yo'li ochilardi.
 */

import type { StorageState } from './browser-bridge';

/** Contract SEC-07 AC: har run uchun maksimal ruxsat etilgan domen soni. */
export const MAX_ALLOWED_DOMAINS = 5;

/**
 * Navigatsiya HISOBLANMAYDIGAN sxemalar — allowlist ularga qo'llanmaydi.
 * `about:blank` Playwright'ning boshlang'ich sahifasi (har `newPage()`),
 * `data:`/`blob:` esa tashqi tarmoqqa chiqmaydi.
 */
const NON_NAVIGATIONAL_SCHEMES = ['about:', 'data:', 'blob:'];

export function isNonNavigationalUrl(rawUrl: string): boolean {
  const s = String(rawUrl ?? '').trim().toLowerCase();
  return NON_NAVIGATIONAL_SCHEMES.some((scheme) => s.startsWith(scheme));
}

/**
 * Domen yozuvini kanonik shaklga keltiradi yoki `null` (yaroqsiz) qaytaradi.
 *
 * Qamraydigan holatlar (har biri testda):
 *   `https://Example.COM/path?q=1` → `example.com`   (sxema/yo'l/query tashlanadi)
 *   `*.example.com`                → `example.com`   (subdomain baribir qamraladi)
 *   `example.com:8443`             → `example.com`   (PORT hisobga olinmaydi)
 *   `  example.com. `              → `example.com`   (bo'shliq + root nuqta)
 *   `сайт.рф`                      → `xn--80aswg.xn--p1ai`  (IDN → punycode)
 *
 * NEGA PUNYCODE MAJBURIY: `new URL()` IDN'ni punycode'ga o'giradi. Agar biz
 * o'girmasak, allowlist'da `сайт.рф` yozilib, brauzer esa `xn--80aswg.xn--p1ai`
 * bilan kelardi — moslik topilmay, himoya JIMGINA hammasini bloklardi (yoki
 * teskarisi — homograf domen bilan chetlab o'tilardi).
 */
export function normalizeDomain(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let value = raw.trim().toLowerCase();
  if (!value) return null;

  // `*.example.com` — subdomain baribir qamralgani uchun yulduzcha shunchaki
  // olib tashlanadi (alohida wildcard semantikasi ATAYLAB yo'q: bitta qoida
  // ikki xil talqin qilinmasin).
  if (value.startsWith('*.')) value = value.slice(2);

  // Sxema bo'lmasa qo'shamiz — `new URL()` sxemasiz host'ni ajrata olmaydi.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(value) ? value : `https://${value}`;

  let host: string;
  try {
    host = new URL(withScheme).hostname; // IDN → punycode shu yerda bo'ladi
  } catch {
    return null;
  }

  // Root nuqta (`example.com.`) va IPv6 qavslari.
  host = host.replace(/\.$/, '').replace(/^\[|\]$/g, '');
  if (!host) return null;

  // Host shakli: harf/raqam/defis/nuqta. Bo'sh label (`a..b`) rad etiladi.
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  if (host.includes('..') || host.startsWith('.') || host.startsWith('-')) return null;

  return host;
}

/**
 * Xom ro'yxatni (env satri yoki massiv) kanonik domenlar to'plamiga aylantiradi.
 * Yaroqsiz yozuvlar JIMGINA tashlanmaydi — chaqiruvchi `invalid` ni ko'radi.
 */
export function parseDomainList(raw: unknown): { domains: string[]; invalid: string[] } {
  const items: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : [];

  const domains: string[] = [];
  const invalid: string[] = [];
  for (const item of items) {
    const text = typeof item === 'string' ? item.trim() : item;
    if (text === '' || text === undefined || text === null) continue;
    const normalized = normalizeDomain(text);
    if (normalized) {
      if (!domains.includes(normalized)) domains.push(normalized);
    } else {
      invalid.push(String(text).slice(0, 100));
    }
  }
  return { domains, invalid };
}

export interface AllowlistSources {
  /** Deploy darajasidagi global ro'yxat (`AGENT_DOMAIN_ALLOWLIST`). */
  env?: unknown;
  /** Agent egasining konfiguratsiyasi (`Agent.toolsConfig.browser.allowedDomains`). */
  agent?: unknown;
}

/**
 * Yakuniy allowlist: env ∪ agent, kanonik, dedupe qilingan va
 * `MAX_ALLOWED_DOMAINS` bilan CHEGARALANGAN (Contract SEC-07 AC).
 *
 * Chegaradan oshgani xato TASHLAMAYDI, kesiladi va `truncated` bilan
 * qaytariladi — chaqiruvchi buni `warn` bilan yozadi. Sabab: ijro paytida
 * konfiguratsiya xatosi butun run'ni yiqitmasligi kerak; kesish esa
 * xavfsiz tomonga (kamroq ruxsat) qaratilgan.
 */
export function resolveAllowlist(sources: AllowlistSources): {
  domains: string[];
  invalid: string[];
  truncated: boolean;
} {
  const fromEnv = parseDomainList(sources.env);
  const fromAgent = parseDomainList(sources.agent);

  const merged: string[] = [];
  for (const d of [...fromEnv.domains, ...fromAgent.domains]) {
    if (!merged.includes(d)) merged.push(d);
  }

  return {
    domains: merged.slice(0, MAX_ALLOWED_DOMAINS),
    invalid: [...fromEnv.invalid, ...fromAgent.invalid],
    truncated: merged.length > MAX_ALLOWED_DOMAINS,
  };
}

/**
 * Host allowlist'gami — aniq moslik YOKI subdomain.
 *
 * `example.com` → `example.com` ✅ · `a.example.com` ✅ · `notexample.com` ❌
 *
 * Oxirgi holat muhim: oddiy `endsWith('example.com')` `notexample.com` ni ham
 * o'tkazib yuborardi. Shuning uchun subdomain tekshiruvi NUQTA bilan.
 */
export function isAllowedHost(host: unknown, allowlist: readonly string[]): boolean {
  const normalized = normalizeDomain(host);
  if (!normalized) return false;
  return allowlist.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}

/**
 * URL navigatsiya uchun ruxsat etilganmi.
 * Bo'sh allowlist → HAR DOIM `false` (fail-closed).
 */
export function isAllowedUrl(rawUrl: unknown, allowlist: readonly string[]): boolean {
  if (typeof rawUrl !== 'string' || !rawUrl) return false;
  if (!allowlist.length) return false;
  let host: string;
  try {
    host = new URL(rawUrl).hostname;
  } catch {
    return false;
  }
  return isAllowedHost(host, allowlist);
}

/** Bloklash sababi (log/trace uchun) yoki `null` — ruxsat. */
export function domainBlockedReason(rawUrl: unknown, allowlist: readonly string[]): string | null {
  if (!allowlist.length) {
    return 'domain allowlist is empty — no navigation is permitted (SEC-07 fail-closed)';
  }
  if (isAllowedUrl(rawUrl, allowlist)) return null;
  return `domain not in allowlist (allowed: ${allowlist.join(', ')})`;
}

/**
 * Cookie domenini kanonik hostga aylantiradi. Cookie `domain` maydoni
 * `.example.com` shaklida bo'lishi mumkin (RFC 6265 subdomain belgisi).
 */
function cookieHost(domain: unknown): string | null {
  if (typeof domain !== 'string') return null;
  return normalizeDomain(domain.startsWith('.') ? domain.slice(1) : domain);
}

/**
 * SESSIYA FILTRI — SEC-07 AC ning eng ko'p unutiladigan bandi.
 *
 * `mergeStorageStates` foydalanuvchining BARCHA sessiyalarini bitta kontekstga
 * qo'shadi (universal login va'dasi). Allowlist'siz bu shuni anglatadi:
 * ruxsat etilgan domendagi injection foydalanuvchining Gmail/bank cookie'siga
 * yeta oladi. Bu funksiya kontekstga faqat allowlist domenlarini kiritadi.
 *
 * Natija bo'sh bo'lsa `undefined` qaytariladi — run TO'XTAMAYDI, shunchaki
 * login'siz davom etadi (foydalanuvchi buni trace'da ko'radi).
 */
export function filterStorageState(
  state: StorageState | undefined,
  allowlist: readonly string[],
): StorageState | undefined {
  if (!state) return undefined;

  const cookies = (state.cookies ?? []).filter((c) => {
    const host = cookieHost((c as { domain?: unknown })?.domain);
    return host !== null && isAllowedHost(host, allowlist);
  });

  const origins = (state.origins ?? []).filter((o) => {
    if (typeof o?.origin !== 'string') return false;
    let host: string;
    try {
      host = new URL(o.origin).hostname;
    } catch {
      return false;
    }
    return isAllowedHost(host, allowlist);
  });

  if (!cookies.length && !origins.length) return undefined;
  return { cookies, origins };
}

/**
 * Majburlash yoqilganmi. Default — YOQILGAN.
 *
 * `AGENT_DOMAIN_ALLOWLIST_ENFORCE=false` faqat lokal debug uchun (shadow
 * rejim: blok yozib boriladi, lekin amalga oshirilmaydi). Konstitutsiya #39:
 * bu flag 2 sprintdan ortiq yashamaydi.
 */
export function isEnforcementEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AGENT_DOMAIN_ALLOWLIST_ENFORCE !== 'false';
}
