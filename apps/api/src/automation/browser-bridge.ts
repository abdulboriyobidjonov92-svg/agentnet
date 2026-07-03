import { Logger } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';

/**
 * S1: Browser Bridge — Playwright ustidagi past darajali primitivlar.
 * Sahifa holatini (URL, sarlavha, matn, interaktiv elementlar) yig'adi va
 * planner (engine, LLM-first) qaytargan amallarni bajaradi.
 *
 * Xavfsizlik: faqat http/https; to'lov/yuborish kabi amallar planner
 * qoidalari bilan cheklangan (maqsadda aniq so'ralmagan bo'lsa taqiqlanadi).
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

export class BrowserBridge {
  private readonly logger = new Logger(BrowserBridge.name);
  private browser: Browser | null = null;
  private page: Page | null = null;

  async open(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage({ viewport: { width: 1280, height: 900 } });
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => null);
    this.browser = null;
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
          if (!/^https?:\/\//i.test(url)) return `ERROR: only http/https URLs are allowed (got: ${url.slice(0, 60)})`;
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
}
