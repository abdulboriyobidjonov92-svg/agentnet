import { Logger } from '@nestjs/common';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { urlBlockedReason } from '../common/ssrf';
import {
  domainBlockedReason,
  filterStorageState,
  isNonNavigationalUrl,
} from './domain-allowlist';

/** Playwright storageState — cookie + localStorage. Sessiya-in'ektsiya uchun. */
export type StorageState = {
  cookies?: any[];
  origins?: { origin: string; localStorage?: { name: string; value: string }[] }[];
};

/**
 * Bir nechta storageState'ni bittaga birlashtiradi — foydalanuvchining BARCHA
 * ulangan sessiyalari (Instagram, YouTube, Gmail, ...) bitta run kontekstiga
 * in'ektsiya qilinadi. Shunda agent qaysi saytga o'tsa ham, foydalanuvchi o'sha
 * yerda login qilgan bo'lsa — sessiya tayyor (universal).
 * Dedupe: cookie (name+domain+path bo'yicha, oxirgisi yutadi), origin bo'yicha.
 */
export function mergeStorageStates(states: StorageState[]): StorageState | undefined {
  if (!states.length) return undefined;
  const cookieMap = new Map<string, any>();
  const originMap = new Map<string, { origin: string; localStorage?: { name: string; value: string }[] }>();
  for (const s of states) {
    for (const c of s.cookies ?? []) {
      cookieMap.set(`${c.name} ${c.domain} ${c.path}`, c);
    }
    for (const o of s.origins ?? []) {
      originMap.set(o.origin, o);
    }
  }
  return { cookies: [...cookieMap.values()], origins: [...originMap.values()] };
}

/**
 * S1: Browser Bridge — Playwright ustidagi past darajali primitivlar.
 * Sahifa holatini (URL, sarlavha, matn, interaktiv elementlar) yig'adi va
 * planner (engine, LLM-first) qaytargan amallarni bajaradi.
 *
 * Xavfsizlik: faqat http/https; to'lov/yuborish kabi amallar planner
 * qoidalari bilan cheklangan (maqsadda aniq so'ralmagan bo'lsa taqiqlanadi).
 * SSRF himoyasi (common/ssrf.ts): navigatsiya OLDIDAN host IP'ga resolve
 * qilinadi va ichki/zahiralangan oraliqlar (loopback, private, link-local +
 * bulut-metadata 169.254.169.254) BLOKLANADI — brauzer platforma tarmog'ida
 * ishlaydi, aks holda foydalanuvchi ichki servis/metadata'ga yeta olardi.
 */

export interface PageElement {
  tag: string;
  type?: string;
  name?: string;
  id?: string;
  placeholder?: string;
  text?: string;
}

export interface PageState {
  url: string;
  title: string;
  text: string;
  elements: PageElement[];
}

export interface BridgeAction {
  action: 'navigate' | 'click' | 'fill' | 'extract' | 'done' | 'fail';
  url?: string;
  element_index?: number;
  value?: string;
  what?: string;
  summary?: string;
  extracted?: string;
  reason?: string;
  method?: string;
}

const INTERACTIVE_SELECTOR =
  'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [type=submit]';

/** SEC-07 blok hodisasi — chaqiruvchi uni `DeviceActionLog`ga yozadi. */
export interface DomainBlockEvent {
  /** Bloklangan host (TO'LIQ URL EMAS: query'da sir bo'lishi mumkin). */
  host: string;
  reason: string;
  /** `navigate` — aniq amal; `route` — sahifa ichidagi navigatsiya/redirect. */
  source: 'navigate' | 'route';
}

export interface BrowserBridgeOptions {
  /**
   * SEC-07 ruxsat etilgan domenlar (kanonik, `resolveAllowlist` natijasi).
   * BO'SH = hech qayerga navigatsiya yo'q (fail-closed).
   */
  allowedDomains?: readonly string[];
  /**
   * SEC-07 majburlanadimi. Default — **HA**.
   *
   * `false` FAQAT lokal debug uchun (`AGENT_DOMAIN_ALLOWLIST_ENFORCE=false`):
   * domen tekshiruvi butunlay o'tkazib yuboriladi va sessiya filtri ham
   * qo'llanmaydi. Bo'sh `allowedDomains` bilan ARALASHTIRILMAYDI — u
   * "hech narsaga ruxsat yo'q" degani, bu esa "tekshirma" degani.
   */
  enforceDomainAllowlist?: boolean;
  /** Har blok uchun chaqiriladi (audit/trace). Xatosi ijroni yiqitmaydi. */
  onBlocked?: (event: DomainBlockEvent) => void;
}

export class BrowserBridge {
  private readonly logger = new Logger(BrowserBridge.name);
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly allowedDomains: readonly string[];
  private readonly enforceDomainAllowlist: boolean;
  private readonly onBlocked?: (event: DomainBlockEvent) => void;

  constructor(options: BrowserBridgeOptions = {}) {
    this.allowedDomains = options.allowedDomains ?? [];
    this.enforceDomainAllowlist = options.enforceDomainAllowlist ?? true;
    this.onBlocked = options.onBlocked;
  }

  /**
   * Domen bloklanadimi — majburlash o'chirilgan bo'lsa HAR DOIM `null`.
   * Yagona qaror nuqtasi: `navigate` ham, `route()` ham shuni chaqiradi.
   */
  private domainBlock(rawUrl: string): string | null {
    if (!this.enforceDomainAllowlist) return null;
    if (isNonNavigationalUrl(rawUrl)) return null;
    return domainBlockedReason(rawUrl, this.allowedDomains);
  }

  /**
   * SEC-07 blokini qayd etadi. Host ajratib olinadi — to'liq URL hech qayerga
   * yozilmaydi (blueprint §2.3.1: query'da token bo'lishi mumkin).
   */
  private recordBlock(rawUrl: string, reason: string, source: DomainBlockEvent['source']): void {
    let host = 'unknown';
    try {
      host = new URL(rawUrl).hostname || 'unknown';
    } catch {
      /* yaroqsiz URL — host noma'lum bo'lib qoladi */
    }
    this.logger.warn(`SEC-07 blok (${source}): ${host} — ${reason}`);
    try {
      this.onBlocked?.({ host, reason, source });
    } catch (e: any) {
      // Audit yozuvining xatosi brauzer ijrosini YIQITMAYDI.
      this.logger.warn(`Blok hodisasini yozib bo'lmadi: ${e?.message}`);
    }
  }

  /**
   * Brauzerni ochadi. `storageState` berilsa (shifrsizlantirilgan Playwright
   * holati — cookie+localStorage), kontekstga in'ektsiya qilinadi va agent
   * foydalanuvchining LOGIN-sessiyasida ishlaydi (BrowserSession'dan keladi).
   */
  async open(storageState?: StorageState): Promise<void> {
    try {
      this.browser = await chromium.launch({ headless: true });
    } catch (e: any) {
      // Playwright chromium o'rnatilmagan bo'lsa (Dockerfile'da `playwright
      // install` bajarilmagan) — raw stack o'rniga aniq, harakatga chorlaydigan
      // xato. Bu holat prod'da bo'lmasligi kerak (Dockerfile chromium'ni
      // o'rnatadi), lekin lokal/noto'g'ri muhitda tashxis oson bo'lsin.
      const msg = String(e?.message ?? e);
      if (/Executable doesn.?t exist|playwright install|browserType\.launch/i.test(msg)) {
        throw new Error(
          "Brauzer-avtomatlashtirish mavjud emas: Playwright chromium o'rnatilmagan " +
            "(`npx playwright install chromium`).",
        );
      }
      throw e;
    }
    // SEC-07 (Contract AC): kontekstga FAQAT allowlist domenlarining
    // cookie'lari in'ektsiya qilinadi. `mergeStorageStates` foydalanuvchining
    // BARCHA sessiyalarini birlashtiradi — filtrsiz, ruxsat etilgan domendagi
    // prompt injection uning Gmail/bank cookie'siga yeta olardi.
    const scopedState = this.enforceDomainAllowlist
      ? filterStorageState(storageState, this.allowedDomains)
      : storageState;
    if (storageState && !scopedState) {
      this.logger.log('SEC-07: allowlist domenlariga mos sessiya yo‘q — login‘siz davom etiladi');
    }

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 900 },
      // Playwright's own StorageState type is structurally compatible but
      // declared in a different module; a plain cast (not `any`) avoids
      // duplicating its shape here without silencing type-checking entirely.
      storageState: scopedState as import('playwright').BrowserContextOptions['storageState'],
    });
    // SSRF himoyasi tarmoq qatlamida: hujjat/navigatsiya so'rovlari (jumladan
    // sahifa REDIRECT'lari va havola-bosishlar) ichki IP'ga ketsa abort qilinadi
    // — bu `navigate` amalidagi tekshiruvni chetlab o'tib bo'lmasligini ta'minlaydi.
    // Subresurslar (rasm/CSS/JS) tekshirilmaydi (har biriga DNS = sekin); asosiy
    // eksfiltratsiya vektori LLM o'qiydigan hujjatning o'zi. Route kontekstda —
    // shu kontekstda ochilgan har qanday sahifaga (jumladan yangi tab) tegishli.
    await this.context.route('**/*', async (route) => {
      const req = route.request();
      if (req.resourceType() === 'document' || req.isNavigationRequest()) {
        const url = req.url();
        // Ikki filtr KETMA-KET, ikkalasidan ham o'tish shart. SSRF birinchi:
        // allowlist'ga `localhost` yozilgan bo'lsa ham u BEKOR QILINMAYDI.
        if (await urlBlockedReason(url)) return route.abort('blockedbyclient');
        // SEC-07: bu shox REDIRECT'ni ham qamraydi (`isNavigationRequest()`),
        // ya'ni ruxsat etilgan domendan tashqariga 30x bilan chiqib bo'lmaydi.
        const domainReason = this.domainBlock(url);
        if (domainReason) {
          this.recordBlock(url, domainReason, 'route');
          return route.abort('blockedbyclient');
        }
      }
      return route.continue();
    });
    this.page = await this.context.newPage();
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => null);
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /** Amalni bajaradi va kuzatuv (observation) matnini qaytaradi. */
  async execute(action: BridgeAction): Promise<string> {
    const page = this.page;
    if (!page) return 'ERROR: browser not open';

    try {
      switch (action.action) {
        case 'navigate': {
          const url = String(action.url ?? '');
          const reason = await urlBlockedReason(url);
          if (reason) return `ERROR: ${reason} (got: ${url.slice(0, 60)})`;
          // SEC-07: `route()` ilgagi buni baribir ushlaydi, lekin bu yerdagi
          // tekshiruv plannerga ANIQ sabab qaytaradi (route abort'i faqat
          // "net::ERR_BLOCKED_BY_CLIENT" beradi — LLM undan xulosa chiqara olmaydi).
          const domainReason = this.domainBlock(url);
          if (domainReason) {
            this.recordBlock(url, domainReason, 'navigate');
            return `ERROR: ${domainReason} (got: ${url.slice(0, 60)})`;
          }
          await page.goto(url, { timeout: 25_000, waitUntil: 'domcontentloaded' });
          return `Opened ${page.url()} — "${await page.title()}"`;
        }
        case 'click': {
          const loc = page.locator(INTERACTIVE_SELECTOR).nth(action.element_index ?? -1);
          const label = ((await loc.textContent().catch(() => '')) ?? '').trim().slice(0, 60);
          await loc.click({ timeout: 10_000 });
          await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => null);
          return `Clicked element #${action.element_index} "${label}" → now at ${page.url()}`;
        }
        case 'fill': {
          const loc = page.locator(INTERACTIVE_SELECTOR).nth(action.element_index ?? -1);
          await loc.fill(String(action.value ?? ''), { timeout: 10_000 });
          return `Filled element #${action.element_index} with "${String(action.value ?? '').slice(0, 60)}"`;
        }
        case 'extract': {
          const text = await this.visibleText();
          return text.slice(0, 1500);
        }
        default:
          return `ERROR: unsupported action ${action.action}`;
      }
    } catch (e: any) {
      this.logger.warn(`Bridge action failed: ${e.message}`);
      return `ERROR: ${String(e.message).slice(0, 200)}`;
    }
  }

  /** Joriy sahifa holati — planner shu asosda keyingi qadamni tanlaydi. */
  async getState(): Promise<PageState | null> {
    const page = this.page;
    if (!page || page.url() === 'about:blank') return null;

    const elements: PageElement[] = [];
    try {
      const locs = page.locator(INTERACTIVE_SELECTOR);
      const count = Math.min(await locs.count(), 40);
      for (let i = 0; i < count; i++) {
        const el = locs.nth(i);
        const info = await el
          .evaluate((node: any) => ({
            tag: node.tagName?.toLowerCase() ?? '',
            type: node.getAttribute?.('type') ?? undefined,
            name: node.getAttribute?.('name') ?? undefined,
            id: node.id || undefined,
            placeholder: node.getAttribute?.('placeholder') ?? undefined,
            text: (node.innerText ?? node.value ?? '').trim().slice(0, 80) || undefined,
          }))
          .catch(() => null);
        if (info) elements.push(info);
      }
    } catch {
      /* sahifa almashayotgan bo'lishi mumkin — holatni qisman qaytaramiz */
    }

    return {
      url: page.url(),
      title: await page.title().catch(() => ''),
      text: (await this.visibleText()).slice(0, 2000),
      elements,
    };
  }

  private async visibleText(): Promise<string> {
    const page = this.page;
    if (!page) return '';
    return (
      (await page
        .evaluate(() => document.body?.innerText ?? '')
        .catch(() => '')) as string
    ).replace(/\n{3,}/g, '\n\n');
  }

  /**
   * Joriy sahifaning JPEG skrinshoti (base64 data-URL). Qadam-tekshiruvi
   * asosan DOM-o'qish orqali (getState) — bu qo'shimcha: UI "agent nimani
   * ko'ryapti"ni ko'rsatishi yoki og'ir sahifalarda vizual tasdiq uchun.
   * Sifat pasaytirilgan (SSE orqali yuborish yengil bo'lsin).
   */
  async screenshot(): Promise<string | null> {
    const page = this.page;
    if (!page || page.url() === 'about:blank') return null;
    try {
      const buf = await page.screenshot({ type: 'jpeg', quality: 45 });
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    } catch {
      return null;
    }
  }
}
