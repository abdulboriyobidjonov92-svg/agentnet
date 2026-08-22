import axios from 'axios';
import { ConnectorDefinition, ok, fail, missingFields, needsCredentials } from '../connector.types';

/** Eskiz.uz — O'zbekistondagi yetakchi SMS-gateway. */
export const eskizSmsConnector: ConnectorDefinition = {
  id: 'eskiz-sms',
  name: 'Eskiz SMS (O\'zbekiston)',
  category: 'messaging',
  region: 'UZ/CIS',
  description: 'Send real SMS to Uzbek numbers via Eskiz.uz gateway.',
  docsUrl: 'https://documenter.getpostman.com/view/663428/RzfmES4z',
  availability: 'live',
  // P0-6 (SAFETY_POLICY_LAYER §3.1/§3.2): SMS — pul + reklama/spam javobgarligi; qaytarilmaydi
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
      { key: 'email', label: 'Eskiz account email', required: true },
      { key: 'password', label: 'Eskiz API password', required: true, secret: true },
      { key: 'from', label: 'Sender name (nickname)', required: false, placeholder: '4546' },
    ],
  },
  actions: [
    {
      id: 'send_sms',
      label: 'Send SMS',
      description: 'Sends an SMS to an Uzbek phone number.',
      params: [
        { key: 'phone', label: 'Phone (998...)', type: 'string', required: true, example: '998901234567' },
        { key: 'text', label: 'SMS text', type: 'string', required: true },
      ],
      returns: '{ message_id, status }',
    },
    {
      id: 'balance',
      label: 'Check balance',
      description: 'Returns the SMS balance of the account.',
      params: [],
      returns: '{ balance }',
    },
  ],
  async execute(actionId, params, ctx) {
    const miss = missingFields(this, ctx.config);
    if (miss.length) return needsCredentials(miss);
    try {
      // 1. Auth → token (Eskiz talabi)
      const { data: auth } = await axios.post(
        'https://notify.eskiz.uz/api/auth/login',
        { email: ctx.config.email, password: ctx.config.password },
        { timeout: 15_000 },
      );
      const token = auth?.data?.token;
      if (!token) return fail('Eskiz auth failed — check email/password');
      const headers = { Authorization: `Bearer ${token}` };

      if (actionId === 'send_sms') {
        const { data } = await axios.post(
          'https://notify.eskiz.uz/api/message/sms/send',
          { mobile_phone: String(params.phone).replace(/\D/g, ''), message: params.text, from: ctx.config.from || '4546' },
          { headers, timeout: 15_000 },
        );
        return ok({ message_id: data?.id, status: data?.status });
      }
      if (actionId === 'balance') {
        const { data } = await axios.get('https://notify.eskiz.uz/api/user/get-limit', { headers, timeout: 15_000 });
        return ok({ balance: data?.data });
      }
      return fail(`Unknown action: ${actionId}`);
    } catch (e: any) {
      return fail(`Eskiz API: ${e.response?.data?.message ?? e.message}`);
    }
  },
};
