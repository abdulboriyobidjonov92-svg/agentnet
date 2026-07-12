import { AgentTemplate, tri } from '../types';

export const SHOP_OWNER: AgentTemplate = {
  id: 'shop-owner',
  profession: tri("Do'kon egasi", 'Владелец магазина', 'Shop owner'),
  domain: 'retail',
  vertical: 'retail',
  complexity: 5,
  createUsd: 70,
  monthlyUsd: 40,
  moduleIds: ['inventory_track', 'stockout_forecast', 'auto_reorder', 'competitor_price', 'pnl_report', 'sales_qa'],
  keywords: ["do'kon", 'dokon', 'magazin', 'магазин', 'shop', 'store', 'savdo', 'tovar'],
  flagship: tri(
    'Savdo trendidan qaysi tovar necha kunda tugashini bashorat qiladi va ta\'minotchiga avto-buyurtma tayyorlaydi',
    'Прогнозирует, через сколько дней закончится товар, и готовит автозаказ поставщику',
    'Forecasts days-to-stockout from the sales trend and auto-drafts the supplier reorder',
  ),
};
