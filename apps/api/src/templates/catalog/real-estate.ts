import { AgentTemplate, tri } from '../types';

export const REAL_ESTATE: AgentTemplate = {
  id: 'real-estate',
  profession: tri("Ko'chmas mulk agenti", 'Риелтор', 'Real estate agent'),
  domain: 'retail',
  complexity: 4,
  createUsd: 40,
  monthlyUsd: 20,
  moduleIds: ['match_engine', 'demand_predict', 'auto_followup'],
  keywords: ["ko'chmas", 'mulk', 'kvartira', 'риелтор', 'недвижимость', 'realtor', 'property'],
  flagship: tri(
    "So'rov+byudjet+joylashuvga qarab mulk-mijoz moslashtiradi, avto follow-up yuritadi",
    'Подбирает объект под запрос/бюджет и ведёт авто-последовательность',
    'AI matches property to buyer criteria and runs an auto follow-up sequence',
  ),
};
