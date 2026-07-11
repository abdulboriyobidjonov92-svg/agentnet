import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF himoyasi — server (yoki server boshqaradigan brauzer) foydalanuvchi
 * bergan URL'ga chiqqanda ichki/zahiralangan manzillarga yetib bormasligini
 * ta'minlaydi. Aks holda foydalanuvchi platforma ichki servislariga yoki bulut-
 * metadata (169.254.169.254) kalitlariga yeta olardi. Ikki joyda ishlatiladi:
 * browser-bridge (Playwright navigatsiya) va competitor-price (narx-scrape fetch).
 */

/** IP ichki/zahiralangan (loopback/private/link-local/CGNAT/ULA) oraliqdami. */
export function isPrivateAddress(ip: string): boolean {
  const v = ip.replace(/^::ffff:/i, ''); // IPv4-mapped IPv6 -> IPv4
  if (isIP(v) === 4) {
    const [a, b] = v.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + bulut-metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const low = ip.toLowerCase();
  if (low === '::1' || low === '::') return true; // loopback / unspecified
  const seg = low.split('%')[0].split(':')[0]; // birinchi hextet (zona-id'siz)
  if (seg.startsWith('fc') || seg.startsWith('fd')) return true; // unique-local fc00::/7
  const first = parseInt((seg || '0').padEnd(4, '0').slice(0, 4), 16);
  if (!Number.isNaN(first) && first >= 0xfe80 && first <= 0xfebf) return true; // link-local
  return false;
}

/**
 * URL navigatsiya/fetch uchun xavfsizmi — bloklash sababini (string) yoki null
 * (ruxsat) qaytaradi. Host DNS orqali IP'ga resolve qilinadi (hostname-orqali
 * ichki IP'ga ko'rsatuvchi hujumni ham bloklaydi).
 */
export async function urlBlockedReason(rawUrl: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return 'invalid URL';
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'only http/https URLs are allowed';
  const host = u.hostname;
  let ips: string[];
  if (isIP(host)) {
    ips = [host];
  } else {
    try {
      ips = (await lookup(host, { all: true })).map((r) => r.address);
    } catch {
      return 'host could not be resolved';
    }
  }
  if (!ips.length || ips.some(isPrivateAddress)) return 'internal/reserved address blocked';
  return null;
}

/**
 * SSRF-xavfsiz matn-fetch: HAR redirect hop qayta tekshiriladi (ochiq URL
 * ichki IP'ga 30x redirect qilib himoyani chetlab o'tolmaydi). Bloklangan
 * manzilda Error tashlaydi; aks holda {ok,status,text} qaytaradi.
 */
export async function safeFetchText(
  rawUrl: string,
  opts: { timeoutMs?: number; maxRedirects?: number } = {},
): Promise<{ ok: boolean; status: number; text: string }> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxRedirects = opts.maxRedirects ?? 5;
  let url = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const reason = await urlBlockedReason(url);
    if (reason) throw new Error(reason);

    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { ok: false, status: res.status, text: '' };
      url = new URL(loc, url).toString(); // keyingi hop tsikl boshida qayta tekshiriladi
      continue;
    }
    return { ok: res.ok, status: res.status, text: await res.text() };
  }
  throw new Error('too many redirects');
}
