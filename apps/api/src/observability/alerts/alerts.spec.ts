import { AlertService } from './alert.service';
import { drainCounters, recordHttpFailure, resetCounters, snapshotCounters } from './alert-counters';
import {
  evaluateAgentFailure,
  evaluateAuthAnomaly,
  evaluateInfrastructure,
  evaluatePaymentFailure,
  resolveThresholds,
  timeBucket,
  evaluateFreeTierBudget,
} from './alert-rules';
import { ALERT_DEFINITIONS, type AlertKey } from './alert.types';
import { resetSecretValueCache } from '../redaction';

/** Phase 5 (P5.4) — alert testlari. */


/**
 * Free tarif budjeti (OpenRouter) — 5-qoida.
 *
 * Spetsifikatsiya talabi: chegara yaqinlashsa yangi ro'yxatdan o'tishlar
 * TO'XTATILMAYDI, faqat signal beriladi. Shuning uchun bu qoida sof
 * kuzatuv — hech qanday bloklovchi ta'siri yo'q.
 */
describe('evaluateFreeTierBudget', () => {
  it('chegaradan past -> signal YO‘Q (shovqin qilmaydi)', () => {
    expect(evaluateFreeTierBudget({ used: 35, cap: 45, alertAt: 36 }, 'b1')).toBeNull();
  });

  it('80% chegarasida -> "near" signali, foizi bilan', () => {
    const ev = evaluateFreeTierBudget({ used: 36, cap: 45, alertAt: 36 }, 'b1');
    expect(ev).not.toBeNull();
    expect(ev!.definition.key).toBe('free_tier_budget');
    expect(ev!.dedupeKey).toBe('free_tier_budget:near:b1');
    expect(ev!.facts.percent).toBe(80);
  });

  it('budjet tugaganda -> ALOHIDA dedup kaliti ("near" uni bostirmasin)', () => {
    const ev = evaluateFreeTierBudget({ used: 45, cap: 45, alertAt: 36 }, 'b1');
    expect(ev!.dedupeKey).toBe('free_tier_budget:exhausted:b1');
    expect(ev!.facts.percent).toBe(100);
  });
});

describe('alert shartnomasi', () => {
  const keys: AlertKey[] = [
    'payment_failure_anomaly',
    'agent_execution_failure',
    'infrastructure_degraded',
    'auth_anomaly',
    'free_tier_budget',
  ];

  it('beshta alert e’lon qilingan', () => {
    expect(Object.keys(ALERT_DEFINITIONS).sort()).toEqual([...keys].sort());
  });

  it("har alert MAJBURIY maydonlarni e'lon qiladi (signal/oyna/sovish/jiddiylik/runbook)", () => {
    for (const key of keys) {
      const def = ALERT_DEFINITIONS[key];
      expect(def.signal.length).toBeGreaterThan(20);
      expect(def.windowMinutes).toBeGreaterThan(0);
      expect(def.cooldownMinutes).toBeGreaterThan(0);
      expect(['critical', 'high', 'warning']).toContain(def.severity);
      expect(def.runbook).toMatch(/^docs\/runbooks\/incident-response\.md#/);
    }
  });
});

describe('hisoblagichlar', () => {
  beforeEach(() => resetCounters());

  it('5xx va 401/403 alohida hisoblanadi', () => {
    recordHttpFailure(500);
    recordHttpFailure(502);
    recordHttpFailure(401);
    recordHttpFailure(403);
    recordHttpFailure(404); // hisoblanmaydi
    const snapshot = snapshotCounters();
    expect(snapshot.serverErrors).toBe(2);
    expect(snapshot.authFailures).toBe(2);
  });

  it('drain oynani yopadi va nollaydi (bir hodisa ikki marta sanalmaydi)', () => {
    recordHttpFailure(500);
    const first = drainCounters();
    expect(first.serverErrors).toBe(1);
    const second = drainCounters();
    expect(second.serverErrors).toBe(0);
  });
});

describe('to‘lov anomaliyasi qoidasi', () => {
  const thresholds = resolveThresholds({});

  it('kam sonli xato — signal YO‘Q (tungi shovqin)', () => {
    expect(evaluatePaymentFailure({ failed: 2, total: 3 }, thresholds, 'b')).toBeNull();
  });

  it('ko‘p xato, lekin ulush past — signal YO‘Q', () => {
    expect(evaluatePaymentFailure({ failed: 6, total: 100 }, thresholds, 'b')).toBeNull();
  });

  it('son ham, ulush ham chegaradan yuqori — signal BOR', () => {
    const event = evaluatePaymentFailure({ failed: 8, total: 10 }, thresholds, 'b');
    expect(event?.definition.key).toBe('payment_failure_anomaly');
    expect(event?.facts.failed).toBe(8);
  });

  it('chegaralar env orqali sozlanadi', () => {
    const custom = resolveThresholds({ ALERT_PAYMENT_MIN_FAILURES: '2', ALERT_PAYMENT_FAILURE_RATIO: '0.1' });
    // Default chegara bilan signal BERMAYDIGAN holat, past chegara bilan beradi.
    expect(evaluatePaymentFailure({ failed: 2, total: 10 }, resolveThresholds({}), 'b')).toBeNull();
    expect(evaluatePaymentFailure({ failed: 2, total: 10 }, custom, 'b')).not.toBeNull();
  });
});

describe('agent ijrosi qoidasi', () => {
  const thresholds = resolveThresholds({});

  it('normal ish — signal yo‘q', () => {
    expect(evaluateAgentFailure({ failed: 1, total: 50 }, thresholds, 'b')).toBeNull();
  });

  it('ko‘pchilik run yiqilgan — signal bor', () => {
    const event = evaluateAgentFailure({ failed: 9, total: 10 }, thresholds, 'b');
    expect(event?.definition.key).toBe('agent_execution_failure');
    expect(event?.definition.severity).toBe('high');
  });
});

describe('infratuzilma qoidasi', () => {
  const thresholds = resolveThresholds({});

  it('bitta muvaffaqiyatsiz DB tekshiruvi — signal yo‘q (bir martalik uzilish)', () => {
    expect(
      evaluateInfrastructure({ consecutiveDbFailures: 1, serverErrors: 0 }, thresholds, 'b'),
    ).toBeNull();
  });

  it('ketma-ket ikki muvaffaqiyatsizlik — signal bor', () => {
    const event = evaluateInfrastructure(
      { consecutiveDbFailures: 2, serverErrors: 0, dbCode: 'db_unreachable' },
      thresholds,
      'b',
    );
    expect(event?.definition.severity).toBe('critical');
    expect(event?.facts.db_code).toBe('db_unreachable');
  });

  it('5xx portlashi ham signal beradi', () => {
    const event = evaluateInfrastructure(
      { consecutiveDbFailures: 0, serverErrors: 25 },
      thresholds,
      'b',
    );
    expect(event).not.toBeNull();
    expect(event?.dedupeKey).toContain('http5xx');
  });

  it('DB va 5xx dedup kalitlari AJRATILGAN', () => {
    const db = evaluateInfrastructure({ consecutiveDbFailures: 2, serverErrors: 0 }, thresholds, 'b');
    const http = evaluateInfrastructure({ consecutiveDbFailures: 0, serverErrors: 99 }, thresholds, 'b');
    expect(db?.dedupeKey).not.toBe(http?.dedupeKey);
  });
});

describe('auth anomaliyasi qoidasi', () => {
  const thresholds = resolveThresholds({});

  it('oddiy 401 shovqini — signal yo‘q', () => {
    expect(
      evaluateAuthAnomaly({ authFailures: 10, deniedPrivilegedAttempts: 0 }, thresholds, 'b'),
    ).toBeNull();
  });

  it('401/403 portlashi — signal bor', () => {
    const event = evaluateAuthAnomaly(
      { authFailures: 150, deniedPrivilegedAttempts: 0 },
      thresholds,
      'b',
    );
    expect(event?.definition.key).toBe('auth_anomaly');
  });

  it('BITTA rad etilgan impersonation urinishi ham signal beradi', () => {
    const event = evaluateAuthAnomaly({ authFailures: 0, deniedPrivilegedAttempts: 1 }, thresholds, 'b');
    expect(event).not.toBeNull();
    expect(event?.dedupeKey).toContain('privileged');
  });
});

describe('vaqt chelagi (dedup oynasi)', () => {
  it('bir xil sovish oynasida bir xil chelak', () => {
    const now = 1_700_000_000_000;
    expect(timeBucket(now, 60)).toBe(timeBucket(now + 60_000, 60));
  });

  it('keyingi oynada boshqa chelak', () => {
    const now = 1_700_000_000_000;
    expect(timeBucket(now, 60)).not.toBe(timeBucket(now + 61 * 60_000, 60));
  });
});

describe('AlertService — yetkazish, dedup, sir', () => {
  const OLD_ENV = { ...process.env };
  let telegram: { sendMessage: jest.Mock };
  let service: AlertService;

  const event = () =>
    evaluatePaymentFailure({ failed: 9, total: 10 }, resolveThresholds({}), 'bucket-1')!;

  beforeEach(() => {
    resetSecretValueCache();
    telegram = { sendMessage: jest.fn(async () => undefined) };
    service = new AlertService(telegram as never);
    // Logger shovqinini jimlantiramiz (test chiqishi toza bo'lsin).
    jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
    jest.restoreAllMocks();
    resetSecretValueCache();
  });

  it("kanal sozlanmagan — SOXTA muvaffaqiyat qaytarilmaydi", async () => {
    delete process.env.OWNER_ALERT_TELEGRAM_CHAT_ID;
    delete process.env.SENTRY_DSN;
    const result = await service.send(event());
    expect(result.delivered).toBe(false);
    expect(result.reason).toBe('no_channel_configured');
    // Signal baribir logga tushadi — jim yo'qolmaydi.
    expect(result.channels).toContain('log');
  });

  it('Telegram sozlangan — yuboriladi', async () => {
    process.env.OWNER_ALERT_TELEGRAM_CHAT_ID = '-1001234567890';
    const result = await service.send(event());
    expect(result.delivered).toBe(true);
    expect(telegram.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('Telegram xatosi — halol `delivery_failed` (yolg‘on emas)', async () => {
    process.env.OWNER_ALERT_TELEGRAM_CHAT_ID = '-1001234567890';
    delete process.env.SENTRY_DSN;
    telegram.sendMessage.mockRejectedValueOnce(new Error('telegram 429'));
    const result = await service.send(event());
    expect(result.delivered).toBe(false);
    expect(result.reason).toBe('delivery_failed');
  });

  it('cooldown ichida takroriy signal BOSTIRILADI', async () => {
    process.env.OWNER_ALERT_TELEGRAM_CHAT_ID = '-1001234567890';
    const now = Date.now();
    await service.send(event(), now);
    const second = await service.send(event(), now + 60_000);
    expect(second.suppressed).toBe(true);
    expect(second.reason).toBe('cooldown');
    expect(telegram.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('cooldown tugagach yana yuboriladi', async () => {
    process.env.OWNER_ALERT_TELEGRAM_CHAT_ID = '-1001234567890';
    const now = Date.now();
    await service.send(event(), now);
    const later = now + (ALERT_DEFINITIONS.payment_failure_anomaly.cooldownMinutes + 1) * 60_000;
    const second = await service.send(event(), later);
    expect(second.suppressed).toBe(false);
    expect(telegram.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('YETKAZILMAGAN signal cooldown BOSHLAMAYDI (jim yo‘qolmasin)', async () => {
    delete process.env.OWNER_ALERT_TELEGRAM_CHAT_ID;
    delete process.env.SENTRY_DSN;
    const now = Date.now();
    await service.send(event(), now);
    process.env.OWNER_ALERT_TELEGRAM_CHAT_ID = '-1001234567890';
    const second = await service.send(event(), now + 1000);
    expect(second.suppressed).toBe(false);
    expect(second.delivered).toBe(true);
  });

  it('signal matnida SIR va SHAXSIY MA’LUMOT yo‘q', async () => {
    process.env.INTERNAL_API_TOKEN = 'internal-token-secret-value';
    process.env.OWNER_ALERT_TELEGRAM_CHAT_ID = '-1001234567890';
    resetSecretValueCache();

    const poisoned = event();
    // Kimdir kelajakda `facts` ga sir qo'shib qo'ysa ham kesilishi kerak.
    poisoned.facts.leaked = process.env.INTERNAL_API_TOKEN;
    poisoned.facts.jwt = 'eyJhbGciOiJIUzI1NiJ9.abcdefghij.klmnopqrst';

    const message = service.formatMessage(poisoned);
    expect(message).not.toContain('internal-token-secret-value');
    expect(message).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(message).toContain('runbook: docs/runbooks/incident-response.md');
  });

  it('signal matni runbook havolasini va oynani o‘z ichiga oladi', () => {
    const message = service.formatMessage(event());
    expect(message).toContain('alert: payment_failure_anomaly');
    expect(message).toContain('oyna: 15 daq');
    expect(message).toContain('[CRITICAL]');
  });
});
