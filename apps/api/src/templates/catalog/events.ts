import { AgentTemplate, tri } from '../types';

export const EVENTS: AgentTemplate = {
  id: 'events',
  profession: tri("To'y / tadbir tashkilotchisi", 'Организатор мероприятий', 'Event organizer'),
  domain: 'general',
  complexity: 3,
  createUsd: 35,
  monthlyUsd: 18,
  moduleIds: ['budget_control', 'match_engine', 'customer_reminder'],
  keywords: ["to'y", 'tadbir', 'tantana', 'той', 'мероприят', 'свадьб', 'event', 'wedding'],
  flagship: tri(
    "Byudjetni AI taqsimlaydi, ta'minotchilar reytingidan moslashtiradi, mehmon ro'yxati",
    'ИИ распределяет бюджет, подбирает подрядчиков по рейтингу',
    'AI budget allocation, supplier matching by rating, guest management',
  ),
};
