import axios from 'axios';
import { ConnectorDefinition, ok, fail, missingFields, needsCredentials } from '../connector.types';

export const woocommerceConnector: ConnectorDefinition = {
  id: 'woocommerce',
  name: 'WooCommerce',
  category: 'ecommerce',
  region: 'global',
  description: 'Read products/orders from a WooCommerce (WordPress) store.',
  docsUrl: 'https://woocommerce.github.io/woocommerce-rest-api-docs/',
  availability: 'live',
  // P0-6 (SAFETY_POLICY_LAYER §3.1/§3.2): Do'kon ma'lumotini o'zgartiradi
  limits: {
    rateLimit: { max: 60, windowSec: 60 },
    dailySpendCap: { amount: 1_000, unit: 'calls' },
    riskTier: 'HIGH',
    killable: true,
    reversible: true,
  },
  auth: {
    type: 'basic',
    fields: [
      { key: 'site_url', label: 'Store URL', required: true, placeholder: 'https://shop.uz' },
      { key: 'consumer_key', label: 'Consumer key', required: true, secret: true },
      { key: 'consumer_secret', label: 'Consumer secret', required: true, secret: true },
    ],
  },
  actions: [
    {
      id: 'list_products',
      label: 'List products',
      description: 'Returns products with stock.',
      params: [{ key: 'limit', label: 'Limit', type: 'number', required: false, example: '10' }],
      returns: '[{ id, name, stock_quantity, price }]',
    },
    {
      id: 'list_orders',
      label: 'List recent orders',
      description: 'Returns latest orders.',
      params: [{ key: 'limit', label: 'Limit', type: 'number', required: false, example: '10' }],
      returns: '[{ id, status, total, customer }]',
    },
  ],
  async execute(actionId, params, ctx) {
    const miss = missingFields(this, ctx.config);
    if (miss.length) return needsCredentials(miss);
    const base = `${String(ctx.config.site_url).replace(/\/+$/, '')}/wp-json/wc/v3`;
    const auth = { username: ctx.config.consumer_key, password: ctx.config.consumer_secret };
    try {
      if (actionId === 'list_products') {
        const { data } = await axios.get(`${base}/products`, { auth, params: { per_page: Number(params.limit ?? 10) }, timeout: 15_000 });
        return ok((data ?? []).map((p: any) => ({ id: p.id, name: p.name, stock_quantity: p.stock_quantity, price: p.price })));
      }
      if (actionId === 'list_orders') {
        const { data } = await axios.get(`${base}/orders`, { auth, params: { per_page: Number(params.limit ?? 10) }, timeout: 15_000 });
        return ok((data ?? []).map((o: any) => ({
          id: o.id, status: o.status, total: o.total,
          customer: `${o.billing?.first_name ?? ''} ${o.billing?.last_name ?? ''}`.trim(),
        })));
      }
      return fail(`Unknown action: ${actionId}`);
    } catch (e: any) {
      return fail(`WooCommerce API: ${e.response?.data?.message ?? e.message}`);
    }
  },
};
