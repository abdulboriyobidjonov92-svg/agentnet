import { AgentTemplate, tri } from '../types';

export const PHARMACY: AgentTemplate = {
  id: 'pharmacy',
  profession: tri('Dorixona', 'Аптека', 'Pharmacy'),
  domain: 'healthcare',
  vertical: 'healthcare',
  complexity: 4,
  createUsd: 45,
  monthlyUsd: 22,
  moduleIds: ['demand_predict', 'expiry_control', 'compliance_check', 'customer_reminder'],
  keywords: ['dorixona', 'dori', 'apteka', 'аптека', 'лекарств', 'pharmacy', 'medicine'],
  flagship: tri(
    'Mavsumiy kasallik statistikasidan dori talabini oldindan biladi, muddatni nazorat qiladi',
    'Предсказывает спрос на лекарства по сезонной статистике и следит за сроками',
    'Predicts seasonal medicine demand and controls expiry dates',
  ),
};
