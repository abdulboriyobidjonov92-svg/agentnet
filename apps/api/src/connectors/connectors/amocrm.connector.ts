import axios from 'axios';
import { ConnectorDefinition, ok, fail, missingFields, needsCredentials } from '../connector.types';

export const amocrmConnector: ConnectorDefinition = {
  id: 'amocrm',
  name: 'amoCRM (Kommo)',
  category: 'crm',
  region: 'UZ/CIS',
  description: 'Create and list leads in amoCRM/Kommo — popular sales CRM in CIS.',
  docsUrl: 'https://www.amocrm.ru/developers',
  availability: 'live',
  auth: {
    type: 'token',
    fields: [
      { key: 'domain', label: 'Account domain', required: true, placeholder: 'yourco.amocrm.ru' },
      { key: 'access_token', label: 'Long-lived access token', required: true, secret: true },
    ],
  },
  actions: [
    {
      id: 'create_lead',
      label: 'Create lead',
      description: 'Adds a lead with name and price.',
      params: [
        { key: 'name', label: 'Lead name', type: 'string', required: true },
        { key: 'price', label: 'Price', type: 'number', required: false },
      ],
      returns: '{ lead_id }',
    },
    {
      id: 'list_leads',
      label: 'List recent leads',
      description: 'Returns latest leads.',
      params: [{ key: 'limit', label: 'Limit', type: 'number', required: false, example: '10' }],
      returns: '[{ id, name, price, status_id }]',
    },
  ],
  async execute(actionId, params, ctx) {
    const miss = missingFields(this, ctx.config);
    if (miss.length) return needsCredentials(miss);
    const base = `https://${String(ctx.config.domain).replace(/^https?:\/\//, '')}/api/v4`;
    const headers = { Authorization: `Bearer ${ctx.config.access_token}` };
    try {
      if (actionId === 'create_lead') {
        const { data } = await axios.post(`${base}/leads`, [{ name: params.name, price: Number(params.price ?? 0) }], { headers, timeout: 15_000 });
        return ok({ lead_id: data?._embedded?.leads?.[0]?.id });
      }
      if (actionId === 'list_leads') {
        const { data } = await axios.get(`${base}/leads`, { headers, params: { limit: Number(params.limit ?? 10) }, timeout: 15_000 });
        const items = (data?._embedded?.leads ?? []).map((l: any) => ({ id: l.id, name: l.name, price: l.price, status_id: l.status_id }));
        return ok(items);
      }
      return fail(`Unknown action: ${actionId}`);
    } catch (e: any) {
      return fail(`amoCRM API: ${e.response?.data?.detail ?? e.message}`);
    }
  },
};
