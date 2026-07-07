import { AgentModule, tri } from './types';

/**
 * Umumiy qobiliyat modullari — 20 shablon shulardan yig'iladi.
 * Har modul promptFragment orqali agentga BASHORAT qilish va AVTONOM harakat
 * qilishni o'rgatadi (brief: "moy almashtirish vaqti keldi" emas, "12 kundan
 * keyin kerak bo'ladi, hozirdan buyurtma qiling").
 */

const M: AgentModule[] = [
  {
    id: 'inventory_track',
    name: tri('Zaxira kuzatuvi', 'Учёт склада', 'Inventory tracking'),
    promptFragment:
      'Track inventory levels the owner reports (and camera/POS events when available). Reconcile counts and surface discrepancies.',
    tools: ['finance.get_transactions'],
  },
  {
    id: 'stockout_forecast',
    name: tri('Tugash bashorati', 'Прогноз исчерпания', 'Stockout forecast'),
    promptFragment:
      'From recent sales velocity (last weeks) predict how many DAYS until each product runs out. Do not just say "low stock" — give a dated forecast ("runs out in ~9 days at current pace").',
    tools: ['finance.get_transactions'],
    prediction: true,
  },
  {
    id: 'auto_reorder',
    name: tri('Avto-buyurtma', 'Автозаказ', 'Auto reorder'),
    promptFragment:
      'When a product is forecast to run out soon, autonomously draft a supplier reorder (quantity based on the trend and lead time) and send it for the owner to approve — do not wait to be asked.',
    tools: ['messaging.telegram_send'],
    autonomous: true,
  },
  {
    id: 'competitor_price',
    name: tri('Raqobatchi narxi', 'Цены конкурентов', 'Competitor pricing'),
    promptFragment:
      'Monitor competitor prices online for the owner\'s key products and flag when the owner is priced notably above or below the market.',
    tools: ['knowledge.search'],
  },
  {
    id: 'pnl_report',
    name: tri('Foyda-zarar', 'Отчёт P&L', 'Profit & loss'),
    promptFragment:
      'Produce plain-language profit-and-loss summaries (revenue, cost of goods, margin) for a period the owner asks about.',
    tools: ['finance.get_transactions', 'finance.currency_rates'],
  },
  {
    id: 'sales_qa',
    name: tri('Savdo savol-javob', 'Вопросы по продажам', 'Sales Q&A'),
    promptFragment:
      'Answer natural-language questions about the business ("what sold most this week?", "which item is slow?") from the sales data.',
    tools: ['finance.get_transactions'],
  },
  {
    id: 'maintenance_predict',
    name: tri('Xizmat bashorati', 'Прогноз ТО', 'Maintenance forecast'),
    promptFragment:
      'From usage/mileage trends predict WHEN the next service (oil, filter, part) is due and tell the customer in advance, recommending they order the part now.',
    tools: ['calendar.get_events'],
    prediction: true,
  },
  {
    id: 'churn_predict',
    name: tri('Churn bashorati', 'Прогноз оттока', 'Churn prediction'),
    promptFragment:
      'Predict which customers are likely to stop coming (based on their visit/purchase gaps) and autonomously draft a personalized win-back offer for each.',
    tools: ['messaging.telegram_send'],
    prediction: true,
    autonomous: true,
  },
  {
    id: 'customer_reminder',
    name: tri('Mijoz eslatmasi', 'Напоминания клиентам', 'Customer reminders'),
    promptFragment:
      'Send personalized reminders at the right time (e.g. "6 weeks since last visit — time to rebook"), autonomously drafting the message per customer.',
    tools: ['messaging.telegram_send', 'calendar.get_events'],
    autonomous: true,
  },
  {
    id: 'review_sentiment',
    name: tri('Sharh tahlili', 'Анализ отзывов', 'Review sentiment'),
    promptFragment:
      'Collect and analyze customer reviews, summarize sentiment trends, and flag recurring complaints to fix.',
    tools: ['knowledge.search'],
  },
  {
    id: 'staff_schedule',
    name: tri('Smena rejasi', 'График смен', 'Staff scheduling'),
    promptFragment:
      'Predict the busiest hours from historical demand and recommend a staff schedule that matches load to coverage.',
    tools: ['calendar.get_events'],
    prediction: true,
  },
  {
    id: 'budget_control',
    name: tri('Byudjet nazorati', 'Контроль бюджета', 'Budget control'),
    promptFragment:
      'Track planned vs actual spend in real time and warn early when a line item is trending over budget before it overruns.',
    tools: ['finance.get_transactions', 'finance.currency_rates'],
    prediction: true,
  },
  {
    id: 'route_optimize',
    name: tri('Marshrut optimallashtirish', 'Оптимизация маршрута', 'Route optimization'),
    promptFragment:
      'Order multi-stop routes efficiently (nearest-sensible sequence), estimate fuel cost, and share a live tracking summary.',
    tools: ['utility.weather'],
  },
  {
    id: 'yield_predict',
    name: tri('Hosil bashorati', 'Прогноз урожая', 'Yield forecast'),
    promptFragment:
      'From weather and soil/season data predict likely yield and recommend the most profitable time to sell.',
    tools: ['utility.weather', 'knowledge.search'],
    prediction: true,
  },
  {
    id: 'disease_detect',
    name: tri('Kasallik aniqlash', 'Определение болезней', 'Disease detection'),
    promptFragment:
      'From a photo of a plant/crop, identify likely disease or pest (visual analysis) and recommend a treatment. State this is an approximate signal, not certainty.',
    tools: ['knowledge.search'],
    prediction: true,
  },
  {
    id: 'demand_predict',
    name: tri('Talab bashorati', 'Прогноз спроса', 'Demand forecast'),
    promptFragment:
      'Predict demand ahead (seasonal illness, occupancy, peak days) so the owner stocks/staffs/prices for it in advance.',
    tools: ['knowledge.search'],
    prediction: true,
  },
  {
    id: 'dynamic_pricing',
    name: tri('Dinamik narx', 'Динамическое ценообразование', 'Dynamic pricing'),
    promptFragment:
      'Recommend price adjustments based on predicted demand (raise when demand is forecast high, discount slow inventory) and explain each suggestion.',
    tools: ['finance.currency_rates'],
    prediction: true,
    autonomous: true,
  },
  {
    id: 'progress_report',
    name: tri('Progress hisoboti', 'Отчёт о ходе работ', 'Progress report'),
    promptFragment:
      'Autonomously compile progress updates (photo/video summaries, milestones done) and send them to the client on a cadence.',
    tools: ['messaging.telegram_send'],
    autonomous: true,
  },
  {
    id: 'deadline_control',
    name: tri('Muddat nazorati', 'Контроль сроков', 'Deadline control'),
    promptFragment:
      'Track deadlines and predict which are at risk of slipping (from progress pace), warning early with the reason.',
    tools: ['calendar.get_events'],
    prediction: true,
  },
  {
    id: 'doc_analysis',
    name: tri('Hujjat tahlili', 'Анализ документов', 'Document analysis'),
    promptFragment:
      'Analyze contracts/documents: extract risky clauses, explain legal consequences in plain language, and flag missing items. Drafting support, not legal advice.',
    tools: ['knowledge.search'],
  },
  {
    id: 'lesson_adapt',
    name: tri('Dars moslashuvi', 'Адаптация обучения', 'Adaptive learning'),
    promptFragment:
      'From test results identify each student\'s weak topics, recommend an individualized program, and produce a plain-language progress report for parents.',
    tools: [],
    prediction: true,
  },
  {
    id: 'match_engine',
    name: tri('Moslashtirish', 'Подбор', 'Matching engine'),
    promptFragment:
      'Match supply to need (property↔buyer, supplier↔job) from stated criteria and budget, ranking the best fits with reasons.',
    tools: ['knowledge.search'],
  },
  {
    id: 'auto_followup',
    name: tri('Avto follow-up', 'Автопоследовательность', 'Auto follow-up'),
    promptFragment:
      'Autonomously run a follow-up sequence with prospects/clients (timed messages), adapting the next message to their responses.',
    tools: ['messaging.telegram_send'],
    autonomous: true,
  },
  {
    id: 'portfolio_post',
    name: tri('Portfolio post', 'Пост-портфолио', 'Portfolio posting'),
    promptFragment:
      'Autonomously draft and schedule portfolio/social posts from new work, matched to seasonal themes.',
    tools: ['messaging.telegram_send'],
    autonomous: true,
  },
  {
    id: 'expiry_control',
    name: tri('Muddat (yaroqlilik) nazorati', 'Контроль сроков годности', 'Expiry control'),
    promptFragment:
      'Track product expiry dates and warn in advance which stock must be sold or removed, prioritizing by date.',
    tools: ['finance.get_transactions'],
    prediction: true,
  },
  {
    id: 'compliance_check',
    name: tri('Qonuniy tekshiruv', 'Проверка соответствия', 'Compliance check'),
    promptFragment:
      'Check requests against the relevant rules (prescription validity, tax deadlines) and flag anything that needs a licensed professional.',
    tools: ['knowledge.search'],
  },
];

export const MODULES: Record<string, AgentModule> = Object.fromEntries(M.map((m) => [m.id, m]));

export function getModules(ids: string[]): AgentModule[] {
  return ids.map((id) => MODULES[id]).filter(Boolean);
}
