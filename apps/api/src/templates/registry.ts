import { AgentTemplate, tri, loc } from './types';
import { getModules } from './modules';

/**
 * 20 tayyor shablon — brief Y3-EXTRA jadvalidan (kasb, murakkablik ★, narx).
 * Har biri umumiy modullardan yig'iladi; kamida bitta BASHORAT + bitta AVTONOM
 * modulga ega (investor-darajasidagi chuqurlik). 1-shablon (do'kon egasi) —
 * bayroqdor ★★★★★ (kamera fuziyasi + tugash bashorati + avto-buyurtma).
 */

const TEMPLATES: AgentTemplate[] = [
  {
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
  },
  {
    id: 'auto-service',
    profession: tri('Avtoservis', 'Автосервис', 'Auto service'),
    domain: 'transport',
    complexity: 4,
    createUsd: 45,
    monthlyUsd: 20,
    moduleIds: ['maintenance_predict', 'inventory_track', 'progress_report', 'churn_predict'],
    keywords: ['avtoservis', 'moy', 'mashina', 'автосервис', 'сервис', 'car', 'garage', 'mechanic'],
    flagship: tri(
      'Kilometraj tendensiyasidan moy/filtr almashtirish muddatini oldindan aytadi',
      'По пробегу заранее предсказывает срок замены масла/фильтра',
      'Predicts oil/filter change timing ahead from the mileage trend',
    ),
  },
  {
    id: 'restaurant',
    profession: tri('Restoran / kafe', 'Ресторан / кафе', 'Restaurant / cafe'),
    domain: 'food_service',
    complexity: 4,
    createUsd: 50,
    monthlyUsd: 25,
    moduleIds: ['sales_qa', 'pnl_report', 'staff_schedule', 'review_sentiment', 'customer_reminder'],
    keywords: ['restoran', 'kafe', 'oshxona', 'ресторан', 'кафе', 'restaurant', 'cafe', 'menyu'],
    flagship: tri(
      'Eng band soatlarni bashorat qilib xodimlar jadvalini tavsiya qiladi, sharhlarni tahlil qiladi',
      'Прогнозирует пиковые часы для графика смен и анализирует отзывы',
      'Predicts peak hours for staffing and analyzes reviews',
    ),
  },
  {
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
  },
  {
    id: 'atelier',
    profession: tri('Tikuvchi / atelye', 'Ателье / швея', 'Tailor / atelier'),
    domain: 'retail',
    complexity: 3,
    createUsd: 30,
    monthlyUsd: 15,
    moduleIds: ['customer_reminder', 'inventory_track', 'portfolio_post', 'demand_predict'],
    keywords: ['tikuvchi', 'atelye', 'tikuv', 'ателье', 'швея', 'tailor', 'atelier', 'sewing'],
    flagship: tri(
      "Mavsum almashganda shaxsiylashtirilgan taklif yuboradi, portfolio-postni avto-tayyorlaydi",
      'При смене сезона шлёт персональные предложения и авто-постит портфолио',
      'Sends personalized seasonal offers and auto-drafts portfolio posts',
    ),
  },
  {
    id: 'beauty-salon',
    profession: tri("Go'zallik saloni", 'Салон красоты', 'Beauty salon'),
    domain: 'retail',
    complexity: 3,
    createUsd: 35,
    monthlyUsd: 18,
    moduleIds: ['customer_reminder', 'staff_schedule', 'churn_predict'],
    keywords: ["go'zallik", 'salon', 'sartarosh', 'салон', 'красот', 'beauty', 'barber', 'spa'],
    flagship: tri(
      '"6 hafta o\'tdi, bo\'yash vaqti" — shaxsiy eslatma; master yuklamasini muvozanatlaydi',
      '«6 недель прошло — пора» — персональные напоминания; балансирует загрузку мастеров',
      'Personalized rebooking reminders; balances stylist load',
    ),
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
    id: 'farmer',
    profession: tri('Fermer', 'Фермер', 'Farmer'),
    domain: 'agriculture',
    complexity: 5,
    createUsd: 55,
    monthlyUsd: 28,
    moduleIds: ['yield_predict', 'disease_detect', 'demand_predict', 'customer_reminder'],
    keywords: ['fermer', 'dehqon', 'hosil', 'фермер', 'урожай', 'farmer', 'crop', 'harvest'],
    flagship: tri(
      "Ob-havo+tuproqdan hosilni bashorat qiladi, o'simlik fotosidan kasallikni aniqlaydi",
      'Прогнозирует урожай по погоде/почве и определяет болезни по фото',
      'Forecasts yield from weather/soil and detects disease from a plant photo',
    ),
  },
  {
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
  },
  {
    id: 'lawyer',
    profession: tri('Yurist / notarius', 'Юрист / нотариус', 'Lawyer / notary'),
    domain: 'law',
    vertical: 'legal',
    complexity: 4,
    createUsd: 40,
    monthlyUsd: 20,
    moduleIds: ['doc_analysis', 'deadline_control', 'auto_followup'],
    keywords: ['yurist', 'notarius', 'advokat', 'юрист', 'нотариус', 'lawyer', 'notary', 'legal'],
    flagship: tri(
      'Shartnomadagi risk-bandlarni ajratib, oqibatlarini sodda tilda tushuntiradi',
      'Выделяет рисковые пункты договора и объясняет последствия простым языком',
      'Extracts risky contract clauses and explains consequences in plain language',
    ),
  },
  {
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
  },
  {
    id: 'events',
    profession: tri("To'y / tadbir tashkilotchisi", 'Организатор мероприятий', 'Event organizer'),
    domain: 'general',
    complexity: 3,
    createUsd: 35,
    monthlyUsd: 18,
    moduleIds: ['budget_control', 'match_engine', 'customer_reminder'],
    keywords: ["to'y", 'tadbir', 'tantana', 'той', 'мероприят', 'свадьб', 'event', 'wedding'],
    flagship: tri(
      "Byudjetni AI taqsimlaydi, ta'minotchilar reytingidan moslashtiradi, mehmon ro'yxati",
      'ИИ распределяет бюджет, подбирает подрядчиков по рейтингу',
      'AI budget allocation, supplier matching by rating, guest management',
    ),
  },
  {
    id: 'taxi-fleet',
    profession: tri('Taksi / flot egasi', 'Такси / автопарк', 'Taxi / fleet owner'),
    domain: 'transport',
    complexity: 4,
    createUsd: 45,
    monthlyUsd: 22,
    moduleIds: ['maintenance_predict', 'dynamic_pricing', 'budget_control'],
    keywords: ['taksi', 'flot', 'haydovchi', 'такси', 'автопарк', 'taxi', 'fleet', 'driver'],
    flagship: tri(
      'Talab-yuqori soatlarni bashorat qilib narxlashni tavsiya qiladi, texnik xizmat xarajatini bashorat',
      'Прогнозирует часы пик для цен и расходы на ТО',
      'Predicts peak-demand hours for pricing and maintenance costs',
    ),
  },
  {
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
  },
  {
    id: 'gym',
    profession: tri('Sport zali egasi', 'Владелец спортзала', 'Gym owner'),
    domain: 'sports',
    complexity: 3,
    createUsd: 35,
    monthlyUsd: 18,
    moduleIds: ['churn_predict', 'customer_reminder', 'staff_schedule'],
    keywords: ['sport zali', 'fitnes', 'zal', 'спортзал', 'фитнес', 'gym', 'fitness'],
    flagship: tri(
      "A'zo faolligidan tark etishni bashorat qilib avto saqlab qolish taklifi yuboradi",
      'Прогнозирует отток по активности и шлёт авто-предложение удержания',
      'Predicts member churn from activity and auto-sends a retention offer',
    ),
  },
  {
    id: 'photographer',
    profession: tri('Fotograf / videograf', 'Фотограф / видеограф', 'Photographer / videographer'),
    domain: 'media',
    complexity: 3,
    createUsd: 30,
    monthlyUsd: 15,
    moduleIds: ['customer_reminder', 'portfolio_post', 'auto_followup', 'churn_predict'],
    keywords: ['fotograf', 'videograf', 'suratchi', 'фотограф', 'видеограф', 'photographer', 'photo'],
    flagship: tri(
      'Mijoz uslub-profilidan kelgusi taklif, fayl yetkazib berishni avtomatlashtiradi, portfolio yangilaydi',
      'По стилю клиента предлагает следующий заказ и авто-обновляет портфолио',
      'Suggests next bookings from client style and auto-updates the portfolio',
    ),
  },
  {
    id: 'hotel',
    profession: tri('Kichik mehmonxona', 'Мини-отель', 'Small hotel'),
    domain: 'general',
    complexity: 4,
    createUsd: 40,
    monthlyUsd: 20,
    moduleIds: ['demand_predict', 'dynamic_pricing', 'review_sentiment'],
    keywords: ['mehmonxona', 'hotel', 'mehmon', 'отель', 'гостиниц', 'hostel', 'guesthouse'],
    flagship: tri(
      'Bandlik bashoratiga asoslangan dinamik narx tavsiya qiladi, mehmon fikrini tahlil qiladi',
      'Рекомендует динамические цены по прогнозу загрузки и анализирует отзывы',
      'Recommends dynamic pricing from an occupancy forecast and analyzes guest feedback',
    ),
  },
];

export const TEMPLATE_REGISTRY: Record<string, AgentTemplate> = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t]),
);

export function allTemplates(): AgentTemplate[] {
  return TEMPLATES;
}

/** Modul tool'larini birlashtiradi (takrorsiz) — ToolSpec ro'yxati. */
export function assembleTools(t: AgentTemplate): { tool_id: string; config: Record<string, unknown> }[] {
  const ids = new Set<string>();
  for (const m of getModules(t.moduleIds)) for (const tool of m.tools) ids.add(tool);
  return [...ids].map((tool_id) => ({ tool_id, config: {} }));
}

const VERTICAL_DISCLAIMER: Record<string, string> = {
  healthcare: 'This is decision support and drafting help, never a diagnosis or licensed medical advice.',
  legal: 'This is drafting and analysis support, not licensed legal advice.',
  finance: 'This is information and bookkeeping support, not licensed financial advice.',
};

/** Modullardan agent system-promptini yig'adi (predict + act tamoyili bilan). */
export function buildSystemPrompt(t: AgentTemplate, language: string): string {
  const prof = loc(t.profession, language);
  const modules = getModules(t.moduleIds);
  const capabilities = modules.map((m) => `- ${m.promptFragment}`).join('\n');
  const disclaimer = t.vertical ? VERTICAL_DISCLAIMER[t.vertical] : undefined;

  return [
    `You are an AI assistant for a ${prof} — a small business owner in Uzbekistan.`,
    `You do not merely send reminders: you ANALYZE the owner's real data, PREDICT what happens next, and take autonomous action where it is safe.`,
    ``,
    `Capabilities:`,
    capabilities,
    ``,
    `Principles: ground every prediction in the owner's actual numbers and state it is an estimate with its assumptions; for autonomous actions, draft and send for the owner's approval rather than doing irreversible things silently.`,
    disclaimer ? disclaimer : '',
    `Always reply in the language the user writes in.`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Shablonda kamida bitta bashorat va bitta avtonom modul bormi (brief talabi). */
export function templateDepth(t: AgentTemplate): { prediction: boolean; autonomous: boolean } {
  const modules = getModules(t.moduleIds);
  return {
    prediction: modules.some((m) => m.prediction),
    autonomous: modules.some((m) => m.autonomous),
  };
}
