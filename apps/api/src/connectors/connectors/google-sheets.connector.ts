import axios from 'axios';
import { ConnectorDefinition, ok, fail, missingFields, needsCredentials } from '../connector.types';

export const googleSheetsConnector: ConnectorDefinition = {
  id: 'google-sheets',
  name: 'Google Sheets',
  category: 'data',
  region: 'global',
  description: 'Append rows and read ranges — the universal small-business database.',
  docsUrl: 'https://developers.google.com/sheets/api',
  availability: 'live',
  // P0-6 (SAFETY_POLICY_LAYER §3.1/§3.2): O'qish-only yo'l — yon ta'sirsiz
  limits: {
    rateLimit: { max: 60, windowSec: 60 },
    dailySpendCap: null,
    riskTier: 'LOW',
    killable: true,
    reversible: true,
  },
  auth: {
    type: 'token',
    fields: [
      { key: 'access_token', label: 'OAuth access token', required: true, secret: true, help: 'OAuth2 token with spreadsheets scope' },
      { key: 'spreadsheet_id', label: 'Spreadsheet ID', required: true, placeholder: '1BxiMVs0XRA...' },
    ],
  },
  actions: [
    {
      id: 'append_row',
      label: 'Append row',
      description: 'Appends one row of values to a sheet.',
      params: [
        { key: 'range', label: 'Range (Sheet1!A:Z)', type: 'string', required: false, example: 'Sheet1!A:Z' },
        { key: 'values', label: 'Row values (JSON array)', type: 'json', required: true, example: '["2026-07-03","Sale",50000]' },
      ],
      returns: '{ updated_range }',
    },
    {
      id: 'read_range',
      label: 'Read range',
      description: 'Reads values from a range.',
      params: [{ key: 'range', label: 'Range', type: 'string', required: true, example: 'Sheet1!A1:D20' }],
      returns: '{ values: [[...]] }',
    },
  ],
  async execute(actionId, params, ctx) {
    const miss = missingFields(this, ctx.config);
    if (miss.length) return needsCredentials(miss);
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${ctx.config.spreadsheet_id}`;
    const headers = { Authorization: `Bearer ${ctx.config.access_token}` };
    try {
      if (actionId === 'append_row') {
        const range = params.range || 'Sheet1!A:Z';
        const values = Array.isArray(params.values) ? params.values : JSON.parse(String(params.values));
        const { data } = await axios.post(
          `${base}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
          { values: [values] },
          { headers, timeout: 15_000 },
        );
        return ok({ updated_range: data.updates?.updatedRange });
      }
      if (actionId === 'read_range') {
        const { data } = await axios.get(`${base}/values/${encodeURIComponent(params.range)}`, { headers, timeout: 15_000 });
        return ok({ values: data.values ?? [] });
      }
      return fail(`Unknown action: ${actionId}`);
    } catch (e: any) {
      return fail(`Sheets API: ${e.response?.data?.error?.message ?? e.message}`);
    }
  },
};
