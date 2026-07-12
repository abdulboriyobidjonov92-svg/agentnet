import { AgentTemplate, tri } from '../types';

export const HOTEL: AgentTemplate = {
  id: 'hotel',
  profession: tri('Kichik mehmonxona', 'Мини-отель', 'Small hotel'),
  domain: 'general',
  complexity: 4,
  createUsd: 40,
  monthlyUsd: 20,
  moduleIds: ['demand_predict', 'dynamic_pricing', 'review_sentiment'],
  keywords: ['mehmonxona', 'hotel', 'mehmon', 'отель', 'гостиниц', 'hostel', 'guesthouse'],
  flagship: tri(
    'Bandlik bashoratiga asoslangan dinamik narx tavsiya qiladi, mehmon fikrini tahlil qiladi',
    'Рекомендует динамические цены по прогнозу загрузки и анализирует отзывы',
    'Recommends dynamic pricing from an occupancy forecast and analyzes guest feedback',
  ),
};
