import { AgentTemplate, tri } from '../types';

export const TAXI_FLEET: AgentTemplate = {
  id: 'taxi-fleet',
  profession: tri('Taksi / flot egasi', 'Такси / автопарк', 'Taxi / fleet owner'),
  domain: 'transport',
  complexity: 4,
  createUsd: 45,
  monthlyUsd: 22,
  moduleIds: ['maintenance_predict', 'dynamic_pricing', 'budget_control'],
  keywords: ['taksi', 'flot', 'haydovchi', 'такси', 'автопарк', 'taxi', 'fleet', 'driver'],
  flagship: tri(
    'Talab-yuqori soatlarni bashorat qilib narxlashni tavsiya qiladi, texnik xizmat xarajatini bashorat',
    'Прогнозирует часы пик для цен и расходы на ТО',
    'Predicts peak-demand hours for pricing and maintenance costs',
  ),
};
