import { AgentTemplate, tri } from '../types';

export const PHOTOGRAPHER: AgentTemplate = {
  id: 'photographer',
  profession: tri('Fotograf / videograf', 'Фотограф / видеограф', 'Photographer / videographer'),
  domain: 'media',
  complexity: 3,
  createUsd: 30,
  monthlyUsd: 15,
  moduleIds: ['customer_reminder', 'portfolio_post', 'auto_followup', 'churn_predict'],
  keywords: ['fotograf', 'videograf', 'suratchi', 'фотограф', 'видеограф', 'photographer', 'photo'],
  flagship: tri(
    'Mijoz uslub-profilidan kelgusi taklif, fayl yetkazib berishni avtomatlashtiradi, portfolio yangilaydi',
    'По стилю клиента предлагает следующий заказ и авто-обновляет портфолио',
    'Suggests next bookings from client style and auto-updates the portfolio',
  ),
};
