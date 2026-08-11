import * as fs from 'fs';
import * as path from 'path';

/**
 * Phase 5 (P5.1 / P5.8) — KONFIGURATSIYA QULFI.
 *
 * NEGA BU YERDA, `apps/web` DA EMAS: `apps/web` da ATAYLAB test
 * infratuzilmasi yo'q (Phase 1 qarori — CI'da web uchun typecheck +
 * lint + build ishlaydi, jest yo'q). Shu sababli web va engine
 * kuzatuv konfiguratsiyasining XAVFSIZLIK INVARIANTLARI shu yerda,
 * matn ustidan tekshiriladi — aynan `gitleaks-config.spec.ts` va
 * `dependency-security.spec.ts` naqshi (SEC-14/SEC-15).
 *
 * Bu testlar "ishlaydimi" ni emas, "xavfsizlik qoidasi buzilmadimi" ni
 * qulflaydi: kimdir DSN'ni kodga yozib qo'ysa, `sendDefaultPii` ni
 * yoqsa, Session Replay qo'shsa yoki source-map'ni ommaviy qoldirsa —
 * CI qizaradi.
 */

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

const webServerConfig = read('apps/web/sentry.server.config.ts');
const webEdgeConfig = read('apps/web/sentry.edge.config.ts');
const webClientConfig = read('apps/web/instrumentation-client.ts');
const webNextConfig = read('apps/web/next.config.ts');
const webScrub = read('apps/web/src/lib/observability/scrub.ts');
const engineObservability = read('apps/agent-engine/observability.py');
const envExample = read('.env.example');
const renderYaml = read('render.yaml');

const allSentryConfigs = [
  ['web server', webServerConfig],
  ['web edge', webEdgeConfig],
  ['web client', webClientConfig],
] as const;

describe('P5.1 — DSN hech qayerda qotirilmagan', () => {
  const files: Array<[string, string]> = [
    ['web server', webServerConfig],
    ['web edge', webEdgeConfig],
    ['web client', webClientConfig],
    ['web next.config', webNextConfig],
    ['engine', engineObservability],
    ['render.yaml', renderYaml],
  ];

  it.each(files)('%s da haqiqiy DSN (https://<key>@...ingest...) yo‘q', (_name, content) => {
    // Haqiqiy DSN shakli: https://<public_key>@<org>.ingest.sentry.io/<project>
    expect(content).not.toMatch(/https:\/\/[a-f0-9]{16,}@/i);
    expect(content).not.toMatch(/@[a-z0-9-]+\.ingest\.(?:[a-z]+\.)?sentry\.io/i);
  });

  it('render.yaml da DSN `sync: false` (git\'ga tushmaydi)', () => {
    // Har `SENTRY_DSN` yozuvidan keyin `sync: false` kelishi shart.
    const matches = [...renderYaml.matchAll(/key: (NEXT_PUBLIC_)?SENTRY_DSN\s*\n\s*(\S+)/g)];
    expect(matches.length).toBeGreaterThanOrEqual(3); // engine + api + web
    for (const match of matches) {
      expect(match[2]).toBe('sync:');
    }
  });

  it('render.yaml da uchala servis uchun ham DSN yozuvi bor', () => {
    const count = (renderYaml.match(/key: SENTRY_DSN/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

describe('P5.1 — web Sentry xavfsizlik invariantlari', () => {
  it.each(allSentryConfigs)('%s: sendDefaultPii FALSE', (_name, content) => {
    expect(content).toContain('sendDefaultPii: false');
    expect(content).not.toContain('sendDefaultPii: true');
  });

  it.each(allSentryConfigs)('%s: beforeSend tozalash ulangan', (_name, content) => {
    expect(content).toContain('beforeSend');
    expect(content).toContain('scrubSentryEvent');
  });

  it.each(allSentryConfigs)('%s: init faqat DSN bo‘lganda (ixtiyoriylik)', (_name, content) => {
    expect(content).toContain('sentryEnabled(dsn)');
  });

  it('klient Session Replay ni YOQMAYDI (chat/balans DOM‘i sizmasin)', () => {
    // Izohda nomi tilga olinadi — KOD sifatida chaqirilmasligi shart.
    expect(webClientConfig).not.toMatch(/replayIntegration\s*\(/);
    expect(webClientConfig).not.toMatch(/^\s*replays(?:Session|OnError)SampleRate\s*:/m);
    expect(webClientConfig).toContain('integrations: []');
  });

  it('klient ALOHIDA (NEXT_PUBLIC_) DSN ishlatadi — server DSN bundle\'ga tushmaydi', () => {
    expect(webClientConfig).toContain('clientSentryDsn');
    expect(webClientConfig).not.toContain('serverSentryDsn');
    expect(webScrub).toContain('NEXT_PUBLIC_SENTRY_DSN');
  });

  it('server/edge konfiguratsiyalari NEXT_PUBLIC DSN ni ISHLATMAYDI', () => {
    expect(webServerConfig).toContain('serverSentryDsn');
    expect(webEdgeConfig).toContain('serverSentryDsn');
  });

  it('React render xatolari uchun global-error boundary bor', () => {
    const globalError = read('apps/web/src/app/global-error.tsx');
    expect(globalError).toContain('Sentry.captureException');
    // Xato MATNI ekranga chiqmaydi (ichki yo'l/qiymat sizishi mumkin).
    expect(globalError).not.toMatch(/\{\s*error\.message\s*\}/);
    // i18n shartnomasi: uchala til.
    for (const locale of ['uz:', 'ru:', 'en:']) expect(globalError).toContain(locale);
  });

  it('EDGE runtime uchun alohida konfiguratsiya bor (BFF xatolari ko‘rinsin)', () => {
    const instrumentation = read('apps/web/instrumentation.ts');
    expect(instrumentation).toContain('sentry.edge.config');
    expect(instrumentation).toContain('sentry.server.config');
    expect(instrumentation).toContain('onRequestError');
  });
});

describe('P5.1 — web source-map siyosati (prod uchun xavfsiz)', () => {
  it('yuklangan map fayllar build chiqishidan O‘CHIRILADI', () => {
    expect(webNextConfig).toContain('deleteSourcemapsAfterUpload: true');
  });

  it('auth-token bo‘lmasa yuklash butunlay o‘chadi (build yiqilmaydi)', () => {
    expect(webNextConfig).toContain('disable: !sourceMapUploadEnabled');
    expect(webNextConfig).toContain('SENTRY_AUTH_TOKEN');
  });

  it('tunnelRoute YOQILMAGAN (ochiq proxy / SSRF yuzasi yaratmaydi)', () => {
    // Izohda nomi tilga olinishi mumkin — QIYMAT sifatida bo'lmasligi shart.
    expect(webNextConfig).not.toMatch(/^\s*tunnelRoute\s*:/m);
  });
});

describe('P5.1 — web CSP Sentry origin‘ini FAIL-CLOSED qo‘shadi', () => {
  const securityHeaders = read('apps/web/src/lib/security-headers.ts');

  it('origin DSN‘ning O‘ZIDAN olinadi (qo‘lda satr emas)', () => {
    expect(securityHeaders).toContain('new URL(dsn).origin');
  });

  it('DSN yo‘q bo‘lsa connect-src kengaymaydi', () => {
    expect(securityHeaders).toMatch(/if \(!dsn\) return \[\];/);
  });

  it('yaroqsiz DSN ham siyosatni bo‘shashtirmaydi (catch -> [])', () => {
    expect(securityHeaders).toMatch(/catch \{\s*return \[\];/);
  });
});

describe('P5.1 — engine Sentry xavfsizlik invariantlari', () => {
  it('send_default_pii FALSE', () => {
    expect(engineObservability).toContain('send_default_pii=False');
  });

  it('before_send ulangan', () => {
    expect(engineObservability).toContain('before_send=before_send');
  });

  it('PROMPT maydonlari tozalanmaydi — BUTUNLAY olib tashlanadi', () => {
    expect(engineObservability).toContain('_PROMPT_KEYS');
    expect(engineObservability).toContain('[omitted:');
    for (const key of ['prompt', 'system_prompt', 'messages', 'conversation_history']) {
      expect(engineObservability).toContain(`"${key}"`);
    }
  });

  it('INTERNAL_API_TOKEN redaksiya ro‘yxatida', () => {
    expect(engineObservability).toContain('"INTERNAL_API_TOKEN"');
  });

  it('sentry-sdk requirements.txt da QOTIRILGAN versiya bilan', () => {
    const requirements = read('apps/agent-engine/requirements.txt');
    expect(requirements).toMatch(/^sentry-sdk==\d+\.\d+\.\d+$/m);
  });
});

describe('P5 — .env.example hujjatlashtirilgan', () => {
  const requiredKeys = [
    'SENTRY_DSN',
    'NEXT_PUBLIC_SENTRY_DSN',
    'SENTRY_ENVIRONMENT',
    'SENTRY_TRACES_SAMPLE_RATE',
    'SENTRY_AUTH_TOKEN',
    'LOG_LEVEL',
    'TRUST_INCOMING_REQUEST_ID',
    'TRUST_CLIENT_REQUEST_ID',
    'ALERTS_ENABLED',
    'ALERT_PAYMENT_MIN_FAILURES',
    'ALERT_AGENT_MIN_FAILURES',
    'ALERT_SERVER_ERROR_MIN',
    'ALERT_AUTH_FAILURE_MIN',
    'HEALTH_CACHE_MS',
  ];

  it.each(requiredKeys)('%s hujjatlashtirilgan', (key) => {
    expect(envExample).toMatch(new RegExp(`^${key}=`, 'm'));
  });

  it('.env.example da HAQIQIY DSN yo‘q (faqat bo‘sh qiymat)', () => {
    expect(envExample).toMatch(/^SENTRY_DSN=""$/m);
    expect(envExample).toMatch(/^NEXT_PUBLIC_SENTRY_DSN=""$/m);
  });
});

describe('P5.5 — render healthCheckPath readiness‘ga qaraydi', () => {
  it('deploy darvozasi /api/health/ready', () => {
    expect(renderYaml).toContain('healthCheckPath: /api/health/ready');
  });

  it('engine uchun healthCheckPath qo‘shilmagan (pserv — web only maydon)', () => {
    const engineBlock = renderYaml.slice(
      renderYaml.indexOf('name: agentnet-engine'),
      renderYaml.indexOf('name: agentnet-api'),
    );
    expect(engineBlock).not.toContain('healthCheckPath:');
  });
});
