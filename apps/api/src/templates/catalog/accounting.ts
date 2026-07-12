import { AgentTemplate, tri } from '../types';

export const ACCOUNTING: AgentTemplate = {
  id: 'accounting',
  profession: tri('Buxgalteriya xizmati', 'Бухгалтерия', 'Accounting service'),
  domain: 'finance',
  vertical: 'finance',
  complexity: 3,
  createUsd: 35,
  monthlyUsd: 18,
  moduleIds: ['pnl_report', 'compliance_check', 'deadline_control', 'customer_reminder'],
  keywords: ['buxgalter', 'hisobchi', 'soliq', 'бухгалтер', 'налог', 'accounting', 'tax'],
  flagship: tri(
    'Hisobotni avto-generatsiya qiladi, xarajatni turkumlab soliq optimallashtirish taklif qiladi',
    'Авто-генерирует отчёты и предлагает налоговую оптимизацию',
    'Auto-generates reports and suggests tax optimization',
  ),
};
