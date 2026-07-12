import { AgentTemplate, tri } from '../types';

export const DOCTOR: AgentTemplate = {
  id: 'doctor',
  profession: tri('Shifokor / stomatolog', 'Врач / стоматолог', 'Doctor / dentist'),
  domain: 'healthcare',
  vertical: 'healthcare',
  complexity: 4,
  createUsd: 45,
  monthlyUsd: 22,
  moduleIds: ['customer_reminder', 'staff_schedule', 'compliance_check'],
  keywords: ['shifokor', 'stomatolog', 'klinika', 'врач', 'стоматолог', 'doctor', 'dentist', 'clinic'],
  flagship: tri(
    'Bemor tarixiga qarab individual eslatma, qabul jadvalini optimallashtirish, telemeditsina anketasi',
    'Индивидуальные напоминания по истории пациента и оптимизация записи',
    'Patient-history reminders, appointment optimization, telemedicine intake',
  ),
};
