import axios from 'axios';
import { ConnectorDefinition, ok, fail, missingFields, needsCredentials } from '../connector.types';

export const shopifyConnector: ConnectorDefinition = {
  id: 'shopify',
  name: 'Shopify',
  category: 'ecommerce',
  region: 'global',
  description: 'Read products/orders and update inventory in a Shopify store.',
  docsUrl: 'https://shopify.dev/docs/api/admin-rest',
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
    type: 'token',
    fields: [
      { key: 'shop', label: 'Shop domain', required: true, placeholder: 'my-store.myshopify.com' },
      { key: 'access_token', label: 'Admin API access token', required: true, secret: true },
    ],
  },
  actions: [
    {
      id: 'list_products',
      label: 'List products',
      description: 'Returns products with inventory quantity.',
      params: [{ key: 'limit', label: 'Limit', type: 'number', required: false, example: '10' }],
      returns: '[{ id, title, inventory_quantity, price }]',
    },
    {
      id: 'list_orders',
      label: 'List recent orders',
      description: 'Returns latest orders with totals.',
      params: [{ key: 'limit', label: 'Limit', type: 'number', required: false, example: '10' }],
      returns: '[{ id, name, total_price, financial_status }]',
    },
  ],
  async execute(actionId, params, ctx) {
    const miss = missingFields(this, ctx.config);
    if (miss.length) return needsCredentials(miss);
    const base = `https://${ctx.config.shop}/admin/api/2024-10`;
    const headers = { 'X-Shopify-Access-Token': ctx.config.access_token };
    try {
      if (actionId === 'list_products') {
        const { data } = await axios.get(`${base}/products.json`, { headers, params: { limit: Number(params.limit ?? 10) }, timeout: 15_000 });
        const items = (data.products ?? []).map((p: any) => ({
          id: p.id, title: p.title,
          inventory_quantity: p.variants?.[0]?.inventory_quantity,
          price: p.variants?.[0]?.price,
        }));
        return ok(items);
      }
      if (actionId === 'list_orders') {
        const { data } = await axios.get(`${base}/orders.json`, { headers, params: { limit: Number(params.limit ?? 10), status: 'any' }, timeout: 15_000 });
        const items = (data.orders ?? []).map((o: any) => ({ id: o.id, name: o.name, total_price: o.total_price, financial_status: o.financial_status }));
        return ok(items);
      }
      return fail(`Unknown action: ${actionId}`);
    } catch (e: any) {
      return fail(`Shopify API: ${e.response?.data?.errors ?? e.message}`);
    }
  },
};
