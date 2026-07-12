import { AgentTemplate, tri } from '../types';

export const BEAUTY_SALON: AgentTemplate = {
  id: 'beauty-salon',
  profession: tri("Go'zallik saloni", 'Салон красоты', 'Beauty salon'),
  domain: 'retail',
  complexity: 3,
  createUsd: 35,
  monthlyUsd: 18,
  moduleIds: ['customer_reminder', 'staff_schedule', 'churn_predict'],
  keywords: ["go'zallik", 'salon', 'sartarosh', 'салон', 'красот', 'beauty', 'barber', 'spa'],
  flagship: tri(
    '"6 hafta o\'tdi, bo\'yash vaqti" — shaxsiy eslatma; master yuklamasini muvozanatlaydi',
    '«6 недель прошло — пора» — персональные напоминания; балансирует загрузку мастеров',
    'Personalized rebooking reminders; balances stylist load',
  ),
};
