import axios from 'axios';
import { ConnectorDefinition, ok, fail } from '../connector.types';

export const telegramBotConnector: ConnectorDefinition = {
  id: 'telegram-bot',
  name: 'Telegram Bot',
  category: 'messaging',
  region: 'global',
  description: 'Send real messages via a Telegram bot (owner alerts, client notifications).',
  docsUrl: 'https://core.telegram.org/bots/api',
  availability: 'live',
  // P0-6 (SAFETY_POLICY_LAYER §3.1/§3.2): Tashqi dunyoga xabar — qaytarilmaydi
  limits: {
    rateLimit: { max: 30, windowSec: 60 },
    dailySpendCap: { amount: 500, unit: 'calls' },
    riskTier: 'HIGH',
    killable: true,
    reversible: false,
  },
  auth: {
    type: 'token',
    fields: [
      { key: 'bot_token', label: 'Bot token (@BotFather)', required: false, secret: true, help: 'Bo\'sh qoldirilsa platformaning TELEGRAM_BOT_TOKEN env kaliti ishlatiladi' },
      { key: 'default_chat_id', label: 'Default chat ID', required: false, placeholder: '123456789' },
    ],
  },
  actions: [
    {
      id: 'send_message',
      label: 'Send message',
      description: 'Sends a text message to a chat.',
      params: [
        { key: 'chat_id', label: 'Chat ID', type: 'string', required: false, example: '123456789' },
        { key: 'text', label: 'Message text', type: 'string', required: true },
      ],
      returns: '{ message_id, chat_id }',
    },
    {
      id: 'get_updates',
      label: 'Get updates',
      description: 'Reads recent messages sent to the bot (useful to find your chat_id).',
      params: [],
      returns: '[{ chat_id, from, text, date }]',
    },
  ],
  async execute(actionId, params, ctx) {
    const token = ctx.config?.bot_token || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return { ok: false, needs: 'credentials', error: 'bot_token yo\'q (yoki TELEGRAM_BOT_TOKEN env)' };
    const api = `https://api.telegram.org/bot${token}`;
    try {
      if (actionId === 'send_message') {
        const chatId = params.chat_id || ctx.config?.default_chat_id;
        if (!chatId) return fail('chat_id required (param yoki default_chat_id)');
        const { data } = await axios.post(`${api}/sendMessage`, { chat_id: chatId, text: params.text, parse_mode: 'HTML' }, { timeout: 10_000 });
        return ok({ message_id: data.result?.message_id, chat_id: chatId });
      }
      if (actionId === 'get_updates') {
        const { data } = await axios.get(`${api}/getUpdates`, { timeout: 10_000 });
        const items = (data.result ?? []).slice(-10).map((u: any) => ({
          chat_id: u.message?.chat?.id,
          from: u.message?.from?.username ?? u.message?.from?.first_name,
          text: u.message?.text,
          date: u.message?.date,
        }));
        return ok(items);
      }
      return fail(`Unknown action: ${actionId}`);
    } catch (e: any) {
      return fail(`Telegram API: ${e.response?.data?.description ?? e.message}`);
    }
  },
};
