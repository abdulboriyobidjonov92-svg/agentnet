import { ConnectorDefinition } from './connector.types';
import { telegramBotConnector } from './connectors/telegram-bot.connector';
import { whatsappBusinessConnector } from './connectors/whatsapp-business.connector';
import { eskizSmsConnector } from './connectors/eskiz-sms.connector';
import { playmobileSmsConnector } from './connectors/playmobile-sms.connector';
import { smtpEmailConnector } from './connectors/smtp-email.connector';
import { bitrix24Connector } from './connectors/bitrix24.connector';
import { amocrmConnector } from './connectors/amocrm.connector';
import { shopifyConnector } from './connectors/shopify.connector';
import { woocommerceConnector } from './connectors/woocommerce.connector';
import { uzumMarketConnector } from './connectors/uzum-market.connector';
import { paymeMerchantConnector } from './connectors/payme-merchant.connector';
import { clickMerchantConnector } from './connectors/click-merchant.connector';
import { googleSheetsConnector } from './connectors/google-sheets.connector';
import { aftershipConnector } from './connectors/aftership.connector';
import { didoxEinvoiceConnector } from './connectors/didox-einvoice.connector';
import { myGovUzConnector } from './connectors/my-gov-uz.connector';
import { soliqUzConnector } from './connectors/soliq-uz.connector';

/**
 * S2: Connector registry — yangi integratsiya qo'shish uchun:
 *   1. connectors/<slug>.connector.ts fayl yozing (ConnectorDefinition)
 *   2. Shu ro'yxatga qo'shing. Tamom.
 * Qo'llanma: docs/CONNECTOR_SDK.md
 */
export const CONNECTORS: ConnectorDefinition[] = [
  // Messaging (xabar yuborish — alert va mijoz kommunikatsiyasi)
  telegramBotConnector,
  whatsappBusinessConnector,
  eskizSmsConnector,
  playmobileSmsConnector,
  smtpEmailConnector,
  // CRM
  bitrix24Connector,
  amocrmConnector,
  // E-commerce
  shopifyConnector,
  woocommerceConnector,
  uzumMarketConnector,
  // To'lovlar (O'zbekiston)
  paymeMerchantConnector,
  clickMerchantConnector,
  // Data / accounting / logistics
  googleSheetsConnector,
  didoxEinvoiceConnector,
  aftershipConnector,
  // Davlat xizmatlari (halol stub — shartnoma kerak)
  myGovUzConnector,
  soliqUzConnector,
];

export const connectorById = new Map(CONNECTORS.map((c) => [c.id, c]));
