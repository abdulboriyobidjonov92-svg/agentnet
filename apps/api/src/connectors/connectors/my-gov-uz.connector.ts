import { ConnectorDefinition, fail, needsAgreement } from '../connector.types';

/**
 * my.gov.uz — Yagona interaktiv davlat xizmatlari portali.
 * HALOL STUB: ommaviy yozish-API yo'q; rasmiy data-sharing shartnomasi va
 * akkreditatsiya talab qilinadi. Action-sxema tayyor — shartnoma imzolangach
 * execute() haqiqiy endpointlarga ulanadi. GovTech agenti hozircha ichki
 * marshrutlangan tiket rejimida ishlaydi (S7).
 */
export const myGovUzConnector: ConnectorDefinition = {
  id: 'my-gov-uz',
  name: 'my.gov.uz (davlat xizmatlari)',
  category: 'government',
  region: 'UZ/CIS',
  description: 'Submit citizen applications and check status on the national services portal. Requires an official data-sharing agreement.',
  docsUrl: 'https://my.gov.uz',
  availability: 'agreement_required',
  // P0-6 (SAFETY_POLICY_LAYER §3.1/§3.2): Davlat xizmati — huquqiy oqibat
  limits: {
    rateLimit: { max: 10, windowSec: 60 },
    dailySpendCap: { amount: 50, unit: 'calls' },
    riskTier: 'CRITICAL',
    killable: true,
    reversible: false,
  },
  auth: {
    type: 'api_key',
    fields: [
      { key: 'client_id', label: 'Accredited client ID', required: true, secret: true },
      { key: 'client_secret', label: 'Client secret', required: true, secret: true },
    ],
  },
  actions: [
    {
      id: 'submit_application',
      label: 'Submit application',
      description: 'Submits a citizen application to a government service.',
      params: [
        { key: 'service_code', label: 'Service code', type: 'string', required: true },
        { key: 'citizen_pinfl', label: 'Citizen PINFL', type: 'string', required: true },
        { key: 'payload', label: 'Application payload (JSON)', type: 'json', required: true },
      ],
      returns: '{ application_id, status }',
    },
    {
      id: 'check_status',
      label: 'Check application status',
      description: 'Returns the live status of an application.',
      params: [{ key: 'application_id', label: 'Application ID', type: 'string', required: true }],
      returns: '{ status, updated_at }',
    },
  ],
  async execute(actionId) {
    if (!['submit_application', 'check_status'].includes(actionId)) return fail(`Unknown action: ${actionId}`);
    return needsAgreement(
      'my.gov.uz integration needs government accreditation + a data-sharing agreement. ' +
        'The action schema is ready; until then GovTech requests are tracked as internal routed tickets (see /govtech).',
    );
  },
};
