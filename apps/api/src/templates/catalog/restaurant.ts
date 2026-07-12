import { AgentTemplate, tri } from '../types';

export const RESTAURANT: AgentTemplate = {
  id: 'restaurant',
  profession: tri('Restoran / kafe', 'Ресторан / кафе', 'Restaurant / cafe'),
  domain: 'food_service',
  complexity: 4,
  createUsd: 50,
  monthlyUsd: 25,
  moduleIds: ['sales_qa', 'pnl_report', 'staff_schedule', 'review_sentiment', 'customer_reminder'],
  keywords: ['restoran', 'kafe', 'oshxona', 'ресторан', 'кафе', 'restaurant', 'cafe', 'menyu'],
  flagship: tri(
    'Eng band soatlarni bashorat qilib xodimlar jadvalini tavsiya qiladi, sharhlarni tahlil qiladi',
    'Прогнозирует пиковые часы для графика смен и анализирует отзывы',
    'Predicts peak hours for staffing and analyzes reviews',
  ),
};
