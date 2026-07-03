# AgentNet Connector SDK

**Maqsad:** integratsiyalar bo'g'in emas, o'sish dvigateli bo'lsin. Lindy 5000+
integratsiyaga bitta yagona interfeys bilan yetgan — bizda ham har bir connector
UCH narsani bir xil shaklda e'lon qiladi: **auth sxemasi**, **action sxemasi**,
**data sxemasi**. Yangi integratsiya = bitta fayl.

## Arxitektura

```
apps/api/src/connectors/
├── connector.types.ts        # SDK interfeysi (ConnectorDefinition)
├── connectors.registry.ts    # Ro'yxat — yangi connector shu yerga qo'shiladi
├── connectors.service.ts     # Katalog, configure, invoke, sendViaChannel
├── connectors.controller.ts  # REST API (+ /internal/invoke agentlar uchun)
└── connectors/
    ├── telegram-bot.connector.ts
    ├── whatsapp-business.connector.ts
    └── ... (har biri mustaqil fayl)
```

Foydalanuvchi konfiglari `ConnectorConfig` jadvalida (Prisma). Sirlar API
javobida hech qachon qaytmaydi — faqat maydon sxemasi.

## Yangi connector qo'shish (5 daqiqa)

1. `connectors/<slug>.connector.ts` yarating:

```ts
import axios from 'axios';
import { ConnectorDefinition, ok, fail, missingFields, needsCredentials } from '../connector.types';

export const myServiceConnector: ConnectorDefinition = {
  id: 'my-service',
  name: 'My Service',
  category: 'crm',            // messaging|crm|ecommerce|payments|accounting|logistics|government|data
  region: 'UZ/CIS',           // yoki 'global'
  description: 'Nima qiladi — bitta gap.',
  availability: 'live',       // yoki 'agreement_required' (halol stub)
  auth: {
    type: 'token',            // api_key | token | basic | webhook_url | none
    fields: [
      { key: 'api_token', label: 'API token', required: true, secret: true },
    ],
  },
  actions: [
    {
      id: 'do_thing',
      label: 'Do thing',
      description: 'Amal tavsifi.',
      params: [{ key: 'x', label: 'X', type: 'string', required: true }],
      returns: '{ result_id }',        // data sxemasi
    },
  ],
  async execute(actionId, params, ctx) {
    const miss = missingFields(this, ctx.config);
    if (miss.length) return needsCredentials(miss);
    try {
      const { data } = await axios.post('https://api.myservice.com/thing',
        { x: params.x },
        { headers: { Authorization: `Bearer ${ctx.config.api_token}` }, timeout: 15_000 });
      return ok({ result_id: data.id });
    } catch (e: any) {
      return fail(`MyService API: ${e.message}`);
    }
  },
};
```

2. `connectors.registry.ts` dagi `CONNECTORS` ro'yxatiga qo'shing. **Tamom** —
   katalog, konfiguratsiya UI, invoke API, agent-vositasi (`connector.invoke`)
   va audit avtomatik ishlaydi.

## Qoidalar

- **Halol holatlar:** hisob ma'lumotisiz `needsCredentials(...)`, rasmiy
  shartnoma kerak bo'lsa `availability: 'agreement_required'` + `needsAgreement(...)`.
  Hech qachon soxta muvaffaqiyat qaytarmang.
- **Timeout:** har HTTP chaqiruvda (10-15s).
- **Xato xabari:** provayder xabarini qisqartirib o'tkazing (`fail(...)`).
- **Sirlar:** `secret: true` — UI yashiradi, API javobiga chiqmaydi.

## Ishlatish yo'llari

| Yo'l | Qanday |
|---|---|
| REST (UI) | `POST /api/connectors/:id/invoke` `{action, params}` |
| Agent vositasi | agent toolsConfig'iga `connector.invoke` qo'shiladi |
| Servislar (Retail/Ops) | `ConnectorsService.sendViaChannel(user, kanal, target, matn)` |
| Ichki (engine) | `POST /api/connectors/internal/invoke` + `x-internal-token` |

## Joriy connectorlar (17)

| Kategoriya | Connector | Holat |
|---|---|---|
| Messaging | telegram-bot, whatsapp-business, eskiz-sms (UZ), playmobile-sms (UZ), smtp-email | live |
| CRM | bitrix24-crm, amocrm | live |
| E-commerce | shopify, woocommerce, uzum-market (UZ) | live |
| Payments | payme-merchant (UZ), click-merchant (UZ) | live |
| Data/Accounting | google-sheets, didox-einvoice (UZ) | live |
| Logistics | aftership-tracking | live |
| Government | my-gov-uz, soliq-uz | agreement_required (halol stub, sxema tayyor) |

"live" = to'g'ri hisob ma'lumotlari kiritilsa haqiqiy API chaqiruvi ishlaydi.
