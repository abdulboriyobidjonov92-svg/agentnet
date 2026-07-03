import axios from 'axios';
import { ConnectorDefinition, ok, fail, missingFields, needsCredentials } from '../connector.types';

/** Didox — O'zbekiston elektron hisob-faktura (EDI) provayderi (soliq bilan integratsiyalangan). */
export const didoxEinvoiceConnector: ConnectorDefinition = {
  id: 'didox-einvoice',
  name: 'Didox e-hisob-faktura (O\'zbekiston)',
  category: 'accounting',
  region: 'UZ/CIS',
  description: 'List and check electronic invoices (e-faktura) through Didox EDI.',
  docsUrl: 'https://didox.uz',
  availability: 'live',
  auth: {
    type: 'token',
    fields: [
      { key: 'api_token', label: 'Didox API token', required: true, secret: true },
      { key: 'tin', label: 'Company TIN (STIR)', required: true, placeholder: '301234567' },
    ],
  },
  actions: [
    {
      id: 'list_documents',
      label: 'List documents',
      description: 'Returns recent inbox/outbox e-invoice documents.',
      params: [
        { key: 'box', label: 'inbox | outbox', type: 'string', required: false, example: 'inbox' },
        { key: 'limit', label: 'Limit', type: 'number', required: false, example: '10' },
      ],
      returns: '[{ doc_id, partner, total, status, date }]',
    },
  ],
  async execute(actionId, params, ctx) {
    const miss = missingFields(this, ctx.config);
    if (miss.length) return needsCredentials(miss);
    if (actionId !== 'list_documents') return fail(`Unknown action: ${actionId}`);
    try {
      const { data } = await axios.get('https://api.didox.uz/v1/documents', {
        headers: { 'user-key': ctx.config.api_token },
        params: { owner: params.box === 'outbox' ? 0 : 1, limit: Number(params.limit ?? 10) },
        timeout: 15_000,
      });
      const items = (data?.data ?? []).map((d: any) => ({
        doc_id: d.doc_id ?? d.id,
        partner: d.partner_name ?? d.contractor,
        total: d.total_sum ?? d.total,
        status: d.status,
        date: d.doc_date ?? d.created_at,
      }));
      return ok(items);
    } catch (e: any) {
      return fail(`Didox API: ${e.response?.data?.message ?? e.message}`);
    }
  },
};
