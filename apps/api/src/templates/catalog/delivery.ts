import { AgentTemplate, tri } from '../types';

export const DELIVERY: AgentTemplate = {
  id: 'delivery',
  profession: tri('Yetkazib berish xizmati', 'Служба доставки', 'Delivery service'),
  domain: 'transport',
  complexity: 4,
  createUsd: 50,
  monthlyUsd: 25,
  moduleIds: ['route_optimize', 'budget_control', 'progress_report'],
  keywords: ['yetkazib', 'kuryer', 'dostavka', 'доставка', 'курьер', 'delivery', 'courier', 'logistics'],
  flagship: tri(
    "Ko'p-to'xtash marshrutini optimallashtiradi, yoqilg'i xarajatini hisoblaydi, jonli kuzatuv",
    'Оптимизирует маршрут с несколькими точками и считает расход топлива',
    'Optimizes multi-stop routes, estimates fuel cost, live tracking',
  ),
};
