import axios from 'axios';
import { ConnectorDefinition, ok, fail, missingFields, needsCredentials } from '../connector.types';

/** Uzum Market seller API — O'zbekistonning eng yirik marketpleysi. */
export const uzumMarketConnector: ConnectorDefinition = {
  id: 'uzum-market',
  name: 'Uzum Market (sotuvchi)',
  category: 'ecommerce',
  region: 'UZ/CIS',
  description: 'Read seller orders and product stock on Uzum Market marketplace.',
  docsUrl: 'https://api-seller.uzum.uz/api/seller-openapi/swagger-ui/index.html',
  availability: 'live',
  // P0-6 (SAFETY_POLICY_LAYER §3.1/§3.2): Marketplace yozuvi
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
      { key: 'api_token', label: 'Seller API token', required: true, secret: true },
      { key: 'shop_id', label: 'Shop ID', required: true },
    ],
  },
  actions: [
    {
      id: 'list_orders',
      label: 'List recent orders',
      description: 'Returns latest FBS orders.',
      params: [{ key: 'limit', label: 'Limit', type: 'number', required: false, example: '10' }],
      returns: '[{ order_id, status, amount, date }]',
    },
    {
      id: 'list_products',
      label: 'List products',
      description: 'Returns shop products with stock.',
      params: [{ key: 'limit', label: 'Limit', type: 'number', required: false, example: '10' }],
      returns: '[{ product_id, title, amount_available }]',
    },
  ],
  async execute(actionId, params, ctx) {
    const miss = missingFields(this, ctx.config);
    if (miss.length) return needsCredentials(miss);
    const headers = { Authorization: `Bearer ${ctx.config.api_token}` };
    const base = 'https://api-seller.uzum.uz/api/seller-openapi/v1';
    try {
      if (actionId === 'list_orders') {
        const { data } = await axios.get(`${base}/shops/${ctx.config.shop_id}/orders`, {
          headers, params: { size: Number(params.limit ?? 10), page: 0 }, timeout: 15_000,
        });
        const items = (data?.orders ?? data?.content ?? []).map((o: any) => ({
          order_id: o.id, status: o.status, amount: o.price ?? o.totalSum, date: o.dateCreated ?? o.date,
        }));
        return ok(items);
      }
      if (actionId === 'list_products') {
        const { data } = await axios.get(`${base}/product/shop/${ctx.config.shop_id}`, {
          headers, params: { size: Number(params.limit ?? 10), page: 0 }, timeout: 15_000,
        });
        const items = (data?.productList ?? data?.content ?? []).map((p: any) => ({
          product_id: p.productId ?? p.id, title: p.title, amount_available: p.quantityActive ?? p.amount,
        }));
        return ok(items);
      }
      return fail(`Unknown action: ${actionId}`);
    } catch (e: any) {
      return fail(`Uzum API: ${e.response?.data?.message ?? e.message}`);
    }
  },
};
