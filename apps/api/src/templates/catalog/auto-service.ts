import { AgentTemplate, tri } from '../types';

export const AUTO_SERVICE: AgentTemplate = {
  id: 'auto-service',
  profession: tri('Avtoservis', 'Автосервис', 'Auto service'),
  domain: 'transport',
  complexity: 4,
  createUsd: 45,
  monthlyUsd: 20,
  moduleIds: ['maintenance_predict', 'inventory_track', 'progress_report', 'churn_predict'],
  keywords: ['avtoservis', 'moy', 'mashina', 'автосервис', 'сервис', 'car', 'garage', 'mechanic'],
  flagship: tri(
    'Kilometraj tendensiyasidan moy/filtr almashtirish muddatini oldindan aytadi',
    'По пробегу заранее предсказывает срок замены масла/фильтра',
    'Predicts oil/filter change timing ahead from the mileage trend',
  ),
};
