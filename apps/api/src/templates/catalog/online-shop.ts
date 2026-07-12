import { AgentTemplate, tri } from '../types';

export const ONLINE_SHOP: AgentTemplate = {
  id: 'online-shop',
  profession: tri("Onlayn do'kon (Instagram/Telegram)", 'Онлайн-магазин', 'Online shop (IG/TG)'),
  domain: 'retail',
  vertical: 'retail',
  complexity: 4,
  createUsd: 40,
  monthlyUsd: 20,
  moduleIds: ['churn_predict', 'auto_followup', 'inventory_track'],
  keywords: ['onlayn', 'instagram', 'telegram', 'онлайн', 'инстаграм', 'online', 'ecommerce'],
  flagship: tri(
    'Kim qayta xarid qilishini aniqlaydi, avto shaxsiylashtirilgan marketing xabari yuboradi',
    'Определяет вероятность повторной покупки и шлёт персональный маркетинг',
    'Predicts repurchase likelihood and sends auto personalized marketing',
  ),
};
