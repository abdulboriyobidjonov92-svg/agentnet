import axios from 'axios';
import { ConnectorDefinition, ok, fail, missingFields, needsCredentials } from '../connector.types';

export const aftershipConnector: ConnectorDefinition = {
  id: 'aftership-tracking',
  name: 'AfterShip (yuk kuzatuvi)',
  category: 'logistics',
  region: 'global',
  description: 'Live shipment tracking across 1000+ carriers (used by the Trade agent).',
  docsUrl: 'https://www.aftership.com/docs/tracking/quickstart',
  availability: 'live',
  auth: {
    type: 'api_key',
    fields: [{ key: 'api_key', label: 'AfterShip API key', required: true, secret: true }],
  },
  actions: [
    {
      id: 'track',
      label: 'Track shipment',
      description: 'Creates/fetches tracking for a number and returns live status.',
      params: [
        { key: 'tracking_number', label: 'Tracking number', type: 'string', required: true },
        { key: 'carrier', label: 'Carrier slug (optional)', type: 'string', required: false, example: 'dhl' },
      ],
      returns: '{ status, checkpoints: [{ time, location, message }] }',
    },
  ],
  async execute(actionId, params, ctx) {
    const miss = missingFields(this, ctx.config);
    if (miss.length) return needsCredentials(miss);
    if (actionId !== 'track') return fail(`Unknown action: ${actionId}`);
    const headers = { 'as-api-key': ctx.config.api_key, 'Content-Type': 'application/json' };
    try {
      // Avval yaratamiz (agar bo'lsa — 4003 qaytadi, keyin o'qiymiz)
      await axios.post('https://api.aftership.com/tracking/2024-04/trackings',
        { tracking: { tracking_number: params.tracking_number, slug: params.carrier || undefined } },
        { headers, timeout: 15_000 },
      ).catch((e) => {
        if (e.response?.data?.meta?.code !== 4003) throw e;
      });
      const { data } = await axios.get(
        `https://api.aftership.com/tracking/2024-04/trackings/${params.carrier || 'auto-detect'}/${params.tracking_number}`,
        { headers, timeout: 15_000 },
      );
      const t = data.data?.tracking;
      return ok({
        status: t?.tag,
        checkpoints: (t?.checkpoints ?? []).map((c: any) => ({ time: c.checkpoint_time, location: c.location, message: c.message })),
      });
    } catch (e: any) {
      return fail(`AfterShip API: ${e.response?.data?.meta?.message ?? e.message}`);
    }
  },
};
