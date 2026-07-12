import { AgentTemplate, tri } from '../types';

export const LAWYER: AgentTemplate = {
  id: 'lawyer',
  profession: tri('Yurist / notarius', 'Юрист / нотариус', 'Lawyer / notary'),
  domain: 'law',
  vertical: 'legal',
  complexity: 4,
  createUsd: 40,
  monthlyUsd: 20,
  moduleIds: ['doc_analysis', 'deadline_control', 'auto_followup'],
  keywords: ['yurist', 'notarius', 'advokat', 'юрист', 'нотариус', 'lawyer', 'notary', 'legal'],
  flagship: tri(
    'Shartnomadagi risk-bandlarni ajratib, oqibatlarini sodda tilda tushuntiradi',
    'Выделяет рисковые пункты договора и объясняет последствия простым языком',
    'Extracts risky contract clauses and explains consequences in plain language',
  ),
};
