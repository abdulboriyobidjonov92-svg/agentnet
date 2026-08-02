import { BadRequestException, Injectable } from '@nestjs/common';
import { CONNECTORS } from '../connectors/connectors.registry';

/**
 * BOSQICH 6 — Qobiliyat-yo'naltiruvchi (MCP/connector-birinchi).
 *
 * Brief tamoyili: ekran-nazorat ENG SEKIN, ENG OXIRGI usul. Har vazifa uchun
 * avval tezroq yo'l izlanadi. Bu servis "qaysi ilovaga ulanish kerak" so'ralganda
 * eng arzon/ishonchli bajaruvchini tanlaydi:
 *   1) rasmiy connector / MCP mavjud bo'lsa — o'sha (tez, arzon, ishonchli)
 *   2) veb-manzil bo'lsa — brauzer-agent (BOSQICH 0)
 *   3) aks holda — ekran-nazorat / computer-use (BOSQICH 2, sekin, oxirgi chora)
 */

export type ExecutorTier = 'connector' | 'browser' | 'screen';

@Injectable()
export class CapabilityRouterService {
  resolve(target: string): { tier: ExecutorTier; executor: string; name: string; reason: string } {
    const q = (target ?? '').toLowerCase().trim();
    if (!q) throw new BadRequestException('target kerak');

    // 1) Connector/MCP katalogida bormi (id-slug yoki nom bo'yicha)
    const hit = CONNECTORS.find((c) => {
      const id = c.id.toLowerCase();
      const name = c.name.toLowerCase();
      const idWord = id.split(/[-_]/)[0]; // "telegram-bot" -> "telegram"
      return q === id || q === name || q.includes(idWord) || name.includes(q);
    });
    if (hit) {
      return {
        tier: 'connector',
        executor: hit.id,
        name: hit.name,
        reason: `'${target}' uchun rasmiy connector bor (${hit.category}) — ekran-nazoratdan tez va ishonchli`,
      };
    }

    // 2) Veb-manzil ko'rinishida bo'lsa — brauzer-agent
    if (/^https?:\/\//.test(q) || /\.[a-z]{2,}(\/|$|\s)/.test(q)) {
      return {
        tier: 'browser',
        executor: 'browser-agent',
        name: 'Brauzer-agent',
        reason: 'Veb-manzil — brauzer-avtomatlashtirish (BOSQICH 0)',
      };
    }

    // 3) Oxirgi chora — ekran-nazorat
    return {
      tier: 'screen',
      executor: 'computer-use',
      name: 'Ekran-nazorat',
      reason: 'Connector/MCP/veb topilmadi — ekran-nazorat (eng oxirgi, eng sekin usul)',
    };
  }

  /** Mavjud connector/MCP katalogi (yo'naltirish shu asosda). */
  catalog() {
    return CONNECTORS.map((c) => ({ id: c.id, name: c.name, category: c.category }));
  }
}
