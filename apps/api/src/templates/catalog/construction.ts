import { AgentTemplate, tri } from '../types';

export const CONSTRUCTION: AgentTemplate = {
  id: 'construction',
  profession: tri('Qurilish ustasi', 'Строитель / прораб', 'Construction contractor'),
  domain: 'construction',
  complexity: 4,
  createUsd: 45,
  monthlyUsd: 22,
  moduleIds: ['budget_control', 'deadline_control', 'progress_report'],
  keywords: ['qurilish', 'usta', 'prorab', 'строитель', 'прораб', 'construction', 'builder', "ta'mir"],
  flagship: tri(
    'Reja vs haqiqiy xarajatni real-vaqtda nazorat qiladi, mijozga avto progress-hisobot yuboradi',
    'Контролирует план vs факт в реальном времени и шлёт клиенту авто-отчёт',
    'Real-time plan-vs-actual budget control with auto progress reports to the client',
  ),
};
