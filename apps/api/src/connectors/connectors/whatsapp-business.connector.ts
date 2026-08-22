import axios from 'axios';
import { ConnectorDefinition, ok, fail, missingFields, needsCredentials } from '../connector.types';

export const whatsappBusinessConnector: ConnectorDefinition = {
  id: 'whatsapp-business',
  name: 'WhatsApp Business (Meta Cloud API)',
  category: 'messaging',
  region: 'global',
  description: 'Send WhatsApp messages to clients via the official Meta Cloud API.',
  docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
  availability: 'live',
  // P0-6 (SAFETY_POLICY_LAYER §3.1/§3.2): Tashqi dunyoga xabar
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
      { key: 'access_token', label: 'Meta access token', required: true, secret: true },
      { key: 'phone_number_id', label: 'Phone number ID', required: true, placeholder: '1055...' },
    ],
  },
  actions: [
    {
      id: 'send_message',
      label: 'Send text message',
      description: 'Sends a WhatsApp text message (24h session window rules apply).',
      params: [
        { key: 'to', label: 'Recipient phone (international)', type: 'string', required: true, example: '998901234567' },
        { key: 'text', label: 'Message text', type: 'string', required: true },
      ],
      returns: '{ message_id }',
    },
    {
      id: 'send_template',
      label: 'Send template message',
      description: 'Sends an approved template (for messages outside the 24h window).',
      params: [
        { key: 'to', label: 'Recipient phone', type: 'string', required: true },
        { key: 'template', label: 'Template name', type: 'string', required: true, example: 'hello_world' },
        { key: 'language', label: 'Template language', type: 'string', required: false, example: 'uz' },
      ],
      returns: '{ message_id }',
    },
  ],
  async execute(actionId, params, ctx) {
    const miss = missingFields(this, ctx.config);
    if (miss.length) return needsCredentials(miss);
    const url = `https://graph.facebook.com/v21.0/${ctx.config.phone_number_id}/messages`;
    const headers = { Authorization: `Bearer ${ctx.config.access_token}` };
    try {
      if (actionId === 'send_message') {
        const { data } = await axios.post(
          url,
          { messaging_product: 'whatsapp', to: params.to, type: 'text', text: { body: params.text } },
          { headers, timeout: 15_000 },
        );
        return ok({ message_id: data.messages?.[0]?.id });
      }
      if (actionId === 'send_template') {
        const { data } = await axios.post(
          url,
          {
            messaging_product: 'whatsapp',
            to: params.to,
            type: 'template',
            template: { name: params.template, language: { code: params.language || 'en_US' } },
          },
          { headers, timeout: 15_000 },
        );
        return ok({ message_id: data.messages?.[0]?.id });
      }
      return fail(`Unknown action: ${actionId}`);
    } catch (e: any) {
      return fail(`WhatsApp API: ${e.response?.data?.error?.message ?? e.message}`);
    }
  },
};
