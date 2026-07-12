import { AgentTemplate, tri } from '../types';

export const GYM: AgentTemplate = {
  id: 'gym',
  profession: tri('Sport zali egasi', 'Владелец спортзала', 'Gym owner'),
  domain: 'sports',
  complexity: 3,
  createUsd: 35,
  monthlyUsd: 18,
  moduleIds: ['churn_predict', 'customer_reminder', 'staff_schedule'],
  keywords: ['sport zali', 'fitnes', 'zal', 'спортзал', 'фитнес', 'gym', 'fitness'],
  flagship: tri(
    "A'zo faolligidan tark etishni bashorat qilib avto saqlab qolish taklifi yuboradi",
    'Прогнозирует отток по активности и шлёт авто-предложение удержания',
    'Predicts member churn from activity and auto-sends a retention offer',
  ),
};
