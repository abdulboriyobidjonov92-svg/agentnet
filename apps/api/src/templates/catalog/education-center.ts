import { AgentTemplate, tri } from '../types';

export const EDUCATION_CENTER: AgentTemplate = {
  id: 'education-center',
  profession: tri("O'quv markazi", 'Учебный центр', 'Education center'),
  domain: 'education',
  complexity: 4,
  createUsd: 40,
  monthlyUsd: 20,
  moduleIds: ['lesson_adapt', 'progress_report', 'customer_reminder'],
  keywords: ["o'quv", 'markaz', 'kurs', 'учебный', 'курсы', 'education', 'course', 'tutor'],
  flagship: tri(
    'Test natijalaridan zaif mavzuni aniqlab individual dastur tavsiya qiladi, ota-onaga hisobot',
    'По результатам тестов находит слабые темы и рекомендует индивидуальную программу',
    'Finds weak topics from test results and recommends an individual program',
  ),
};
