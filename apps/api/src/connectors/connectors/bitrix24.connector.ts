import axios from 'axios';
import { ConnectorDefinition, ok, fail, missingFields, needsCredentials } from '../connector.types';

/** Bitrix24 — CIS'dagi eng keng tarqalgan CRM. Webhook REST API. */
export const bitrix24Connector: ConnectorDefinition = {
  id: 'bitrix24-crm',
  name: 'Bitrix24 CRM',
  category: 'crm',
  region: 'UZ/CIS',
  description: 'Create leads/deals and read CRM data in Bitrix24 (the most common CRM in CIS).',
  docsUrl: 'https://dev.1c-bitrix.ru/rest_help/',
  availability: 'live',
  auth: {
    type: 'webhook_url',
    fields: [
      {
        key: 'webhook_url', label: 'Inbound webhook URL', required: true, secret: true,
        placeholder: 'https://yourco.bitrix24.ru/rest/1/abc123/',
        help: 'Bitrix24 → Developer resources → Other → Inbound webhook',
      },
    ],
  },
  actions: [
    {
      id: 'create_lead',
      label: 'Create lead',
      description: 'Adds a new lead to the CRM.',
      params: [
        { key: 'title', label: 'Lead title', type: 'string', required: true },
        { key: 'name', label: 'Contact name', type: 'string', required: false },
        { key: 'phone', label: 'Phone', type: 'string', required: false },
        { key: 'comment', label: 'Comment', type: 'string', required: false },
      ],
      returns: '{ lead_id }',
    },
    {
      id: 'list_deals',
      label: 'List recent deals',
      description: 'Returns the latest deals with stage and amount.',
      params: [{ key: 'limit', label: 'Limit', type: 'number', required: false, example: '10' }],
      returns: '[{ id, title, stage, opportunity, currency }]',
    },
  ],
  async execute(actionId, params, ctx) {
    const miss = missingFields(this, ctx.config);
    if (miss.length) return needsCredentials(miss);
    const base = String(ctx.config.webhook_url).replace(/\/+$/, '');
    try {
      if (actionId === 'create_lead') {
        const { data } = await axios.post(`${base}/crm.lead.add.json`, {
          fields: {
            TITLE: params.title,
            NAME: params.name ?? '',
            PHONE: params.phone ? [{ VALUE: params.phone, VALUE_TYPE: 'WORK' }] : undefined,
            COMMENTS: params.comment ?? '',
          },
        }, { timeout: 15_000 });
        return ok({ lead_id: data.result });
      }
      if (actionId === 'list_deals') {
        const { data } = await axios.post(`${base}/crm.deal.list.json`, {
          order: { ID: 'DESC' },
          select: ['ID', 'TITLE', 'STAGE_ID', 'OPPORTUNITY', 'CURRENCY_ID'],
        }, { timeout: 15_000 });
        const items = (data.result ?? []).slice(0, Number(params.limit ?? 10)).map((d: any) => ({
          id: d.ID, title: d.TITLE, stage: d.STAGE_ID, opportunity: d.OPPORTUNITY, currency: d.CURRENCY_ID,
        }));
        return ok(items);
      }
      return fail(`Unknown action: ${actionId}`);
    } catch (e: any) {
      return fail(`Bitrix24 API: ${e.response?.data?.error_description ?? e.message}`);
    }
  },
};
