import axios from 'axios';
import { ConnectorDefinition, ok, fail, missingFields, needsCredentials } from '../connector.types';

/** Playmobile (broker.playmobile.uz) — O'zbekiston korporativ SMS brokeri. */
export const playmobileSmsConnector: ConnectorDefinition = {
  id: 'playmobile-sms',
  name: 'Playmobile SMS (O\'zbekiston)',
  category: 'messaging',
  region: 'UZ/CIS',
  description: 'Corporate SMS broker used by Uzbek banks and large businesses.',
  docsUrl: 'https://playmobile.uz',
  availability: 'live',
  // P0-6 (SAFETY_POLICY_LAYER §3.1/§3.2): SMS — ayni sabab
  limits: {
    rateLimit: { max: 20, windowSec: 60 },
    dailySpendCap: { amount: 200, unit: 'calls' },
    riskTier: 'HIGH',
    killable: true,
    reversible: false,
  },
  auth: {
    type: 'basic',
    fields: [
      { key: 'login', label: 'Broker login', required: true },
      { key: 'password', label: 'Broker password', required: true, secret: true },
      { key: 'originator', label: 'Originator (alpha name)', required: false, placeholder: '3700' },
    ],
  },
  actions: [
    {
      id: 'send_sms',
      label: 'Send SMS',
      description: 'Sends an SMS through the Playmobile broker.',
      params: [
        { key: 'phone', label: 'Phone (998...)', type: 'string', required: true },
        { key: 'text', label: 'SMS text', type: 'string', required: true },
      ],
      returns: '{ request_id, status }',
    },
  ],
  async execute(actionId, params, ctx) {
    const miss = missingFields(this, ctx.config);
    if (miss.length) return needsCredentials(miss);
    if (actionId !== 'send_sms') return fail(`Unknown action: ${actionId}`);
    try {
      const messageId = `agentnet-${Date.now()}`;
      const { status } = await axios.post(
        'https://send.smsxabar.uz/broker-api/send',
        {
          messages: [
            {
              recipient: String(params.phone).replace(/\D/g, ''),
              'message-id': messageId,
              sms: { originator: ctx.config.originator || '3700', content: { text: params.text } },
            },
          ],
        },
        { auth: { username: ctx.config.login, password: ctx.config.password }, timeout: 15_000 },
      );
      return ok({ request_id: messageId, status });
    } catch (e: any) {
      return fail(`Playmobile API: ${e.response?.data?.error_description ?? e.message}`);
    }
  },
};
