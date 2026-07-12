import { AgentTemplate, tri } from '../types';

export const FARMER: AgentTemplate = {
  id: 'farmer',
  profession: tri('Fermer', 'Фермер', 'Farmer'),
  domain: 'agriculture',
  complexity: 5,
  createUsd: 55,
  monthlyUsd: 28,
  moduleIds: ['yield_predict', 'disease_detect', 'demand_predict', 'customer_reminder'],
  keywords: ['fermer', 'dehqon', 'hosil', 'фермер', 'урожай', 'farmer', 'crop', 'harvest'],
  flagship: tri(
    "Ob-havo+tuproqdan hosilni bashorat qiladi, o'simlik fotosidan kasallikni aniqlaydi",
    'Прогнозирует урожай по погоде/почве и определяет болезни по фото',
    'Forecasts yield from weather/soil and detects disease from a plant photo',
  ),
};
