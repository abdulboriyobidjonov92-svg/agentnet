import { AgentTemplate, tri } from '../types';

export const ATELIER: AgentTemplate = {
  id: 'atelier',
  profession: tri('Tikuvchi / atelye', 'Ателье / швея', 'Tailor / atelier'),
  domain: 'retail',
  complexity: 3,
  createUsd: 30,
  monthlyUsd: 15,
  moduleIds: ['customer_reminder', 'inventory_track', 'portfolio_post', 'demand_predict'],
  keywords: ['tikuvchi', 'atelye', 'tikuv', 'ателье', 'швея', 'tailor', 'atelier', 'sewing'],
  flagship: tri(
    "Mavsum almashganda shaxsiylashtirilgan taklif yuboradi, portfolio-postni avto-tayyorlaydi",
    'При смене сезона шлёт персональные предложения и авто-постит портфолио',
    'Sends personalized seasonal offers and auto-drafts portfolio posts',
  ),
};
