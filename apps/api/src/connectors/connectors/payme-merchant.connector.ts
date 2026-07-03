import axios from 'axios';
import { ConnectorDefinition, ok, fail, missingFields, needsCredentials } from '../connector.types';

/** Payme Business (Subscribe API) — O'zbekiston to'lov tizimi. */
export const paymeMerchantConnector: ConnectorDefinition = {
  id: 'payme-merchant',
  name: 'Payme Business (O\'zbekiston)',
  category: 'payments',
  region: 'UZ/CIS',
  description: 'Create payment receipts and check their status via Payme merchant API.',
  docsUrl: 'https://developer.help.paycom.uz/',
  availability: 'live',
  auth: {
    type: 'api_key',
    fields: [
      { key: 'merchant_id', label: 'Merchant ID (kassa)', required: true },
      { key: 'api_key', label: 'API key (X-Auth password)', required: true, secret: true },
      { key: 'test_mode', label: 'Test/sandbox mode (true/false)', required: false, placeholder: 'true' },
    ],
  },
  actions: [
    {
      id: 'create_receipt',
      label: 'Create payment receipt',
      description: 'Creates a receipt (invoice) the customer can pay.',
      params: [
        { key: 'amount', label: 'Amount (UZS tiyin)', type: 'number', required: true, example: '5000000' },
        { key: 'order_id', label: 'Your order ID', type: 'string', required: true },
        { key: 'description', label: 'Description', type: 'string', required: false },
      ],
      returns: '{ receipt_id, pay_url }',
    },
    {
      id: 'check_receipt',
      label: 'Check receipt status',
      description: 'Returns the state of a receipt.',
      params: [{ key: 'receipt_id', label: 'Receipt ID', type: 'string', required: true }],
      returns: '{ state }',
    },
  ],
  async execute(actionId, params, ctx) {
    const miss = missingFields(this, ctx.config);
    if (miss.length) return needsCredentials(miss);
    const test = String(ctx.config.test_mode ?? 'true') === 'true';
    const base = test ? 'https://checkout.test.paycom.uz/api' : 'https://checkout.paycom.uz/api';
    const headers = { 'X-Auth': `${ctx.config.merchant_id}:${ctx.config.api_key}` };
    try {
      if (actionId === 'create_receipt') {
        const { data } = await axios.post(base, {
          id: Date.now(), method: 'receipts.create',
          params: {
            amount: Number(params.amount),
            account: { order_id: params.order_id },
            description: params.description ?? '',
          },
        }, { headers, timeout: 15_000 });
        if (data.error) return fail(`Payme: ${data.error.message}`);
        const rid = data.result?.receipt?._id;
        return ok({ receipt_id: rid, pay_url: `https://checkout.${test ? 'test.' : ''}paycom.uz/${rid}` });
      }
      if (actionId === 'check_receipt') {
        const { data } = await axios.post(base, {
          id: Date.now(), method: 'receipts.check', params: { id: params.receipt_id },
        }, { headers, timeout: 15_000 });
        if (data.error) return fail(`Payme: ${data.error.message}`);
        return ok({ state: data.result?.state });
      }
      return fail(`Unknown action: ${actionId}`);
    } catch (e: any) {
      return fail(`Payme API: ${e.response?.data?.error?.message ?? e.message}`);
    }
  },
};
