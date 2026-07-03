import { ConnectorDefinition, fail, needsAgreement } from '../connector.types';

/**
 * Soliq.uz (Davlat soliq qo'mitasi) — soliq hisobotlari va to'lov holati.
 * HALOL STUB: rasmiy API akkreditatsiya/ERI talab qiladi. Sxema tayyor.
 */
export const soliqUzConnector: ConnectorDefinition = {
  id: 'soliq-uz',
  name: 'Soliq.uz (soliq xizmati)',
  category: 'government',
  region: 'UZ/CIS',
  description: 'Check tax debts and filing deadlines. Requires accredited access (ERI).',
  docsUrl: 'https://soliq.uz',
  availability: 'agreement_required',
  auth: {
    type: 'api_key',
    fields: [
      { key: 'eri_key', label: 'ERI (elektron imzo) key reference', required: true, secret: true },
      { key: 'tin', label: 'Company TIN (STIR)', required: true },
    ],
  },
  actions: [
    {
      id: 'check_debt',
      label: 'Check tax debt',
      description: 'Returns current tax debt for the TIN.',
      params: [],
      returns: '{ total_debt, by_tax_type }',
    },
    {
      id: 'filing_deadlines',
      label: 'Upcoming filing deadlines',
      description: 'Returns upcoming report deadlines for the tax regime.',
      params: [],
      returns: '[{ report, deadline }]',
    },
  ],
  async execute(actionId) {
    if (!['check_debt', 'filing_deadlines'].includes(actionId)) return fail(`Unknown action: ${actionId}`);
    return needsAgreement(
      'Soliq.uz API access requires ERI-based accreditation. Schema is ready; ' +
        'until then the Finance agent answers deadline questions from the built-in reference.',
    );
  },
};
