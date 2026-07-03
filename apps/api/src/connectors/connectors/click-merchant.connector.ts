import axios from 'axios';
import { createHash } from 'crypto';
import { ConnectorDefinition, ok, fail, missingFields, needsCredentials } from '../connector.types';

/** Click Merchant API — O'zbekiston to'lov tizimi. */
export const clickMerchantConnector: ConnectorDefinition = {
  id: 'click-merchant',
  name: 'Click Merchant (O\'zbekiston)',
  category: 'payments',
  region: 'UZ/CIS',
  description: 'Create invoices and check payment status via Click merchant API.',
  docsUrl: 'https://docs.click.uz/',
  availability: 'live',
  auth: {
    type: 'api_key',
    fields: [
      { key: 'merchant_id', label: 'Merchant ID', required: true },
      { key: 'service_id', label: 'Service ID', required: true },
      { key: 'merchant_user_id', label: 'Merchant user ID', required: true },
      { key: 'secret_key', label: 'Secret key', required: true, secret: true },
    ],
  },
  actions: [
    {
      id: 'create_invoice',
      label: 'Create invoice',
      description: 'Sends an invoice to the customer\'s phone.',
      params: [
        { key: 'amount', label: 'Amount (UZS)', type: 'number', required: true, example: '50000' },
        { key: 'phone', label: 'Customer phone (998...)', type: 'string', required: true },
        { key: 'order_id', label: 'Your order ID', type: 'string', required: true },
      ],
      returns: '{ invoice_id }',
    },
    {
      id: 'check_invoice',
      label: 'Check invoice status',
      description: 'Returns invoice payment status.',
      params: [{ key: 'invoice_id', label: 'Invoice ID', type: 'string', required: true }],
      returns: '{ status, status_note }',
    },
  ],
  async execute(actionId, params, ctx) {
    const miss = missingFields(this, ctx.config);
    if (miss.length) return needsCredentials(miss);
    // Click auth: merchant_user_id:sha1(timestamp+secret):timestamp
    const ts = Math.floor(Date.now() / 1000);
    const digest = createHash('sha1').update(`${ts}${ctx.config.secret_key}`).digest('hex');
    const headers = { Auth: `${ctx.config.merchant_user_id}:${digest}:${ts}` };
    const base = 'https://api.click.uz/v2/merchant';
    try {
      if (actionId === 'create_invoice') {
        const { data } = await axios.post(`${base}/invoice/create`, {
          service_id: Number(ctx.config.service_id),
          amount: Number(params.amount),
          phone_number: String(params.phone).replace(/\D/g, ''),
          merchant_trans_id: params.order_id,
        }, { headers, timeout: 15_000 });
        if (data.error_code && data.error_code !== 0) return fail(`Click: ${data.error_note}`);
        return ok({ invoice_id: data.invoice_id });
      }
      if (actionId === 'check_invoice') {
        const { data } = await axios.get(
          `${base}/invoice/status/${ctx.config.service_id}/${params.invoice_id}`,
          { headers, timeout: 15_000 },
        );
        return ok({ status: data.status, status_note: data.status_note });
      }
      return fail(`Unknown action: ${actionId}`);
    } catch (e: any) {
      return fail(`Click API: ${e.response?.data?.error_note ?? e.message}`);
    }
  },
};
