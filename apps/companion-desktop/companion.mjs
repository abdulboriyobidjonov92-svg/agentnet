#!/usr/bin/env node
/**
 * AgentNet — Desktop Companion (BOSQICH 2, beta skelet).
 *
 * NEGA KERAK: hosted server foydalanuvchining ish stoliga BEVOSITA tegا olmaydi.
 * Bu kichik dastur foydalanuvchi MASHINASIDA ishlaydi, serverga juftlash-kodi
 * bilan bog'lanadi, buyruqlarni POLL qiladi va bajaradi. Server faqat REJA beradi
 * (Gemini vision), bajarish shu yerda. Har amal DevicePermission bilan cheklangan.
 *
 * ISHGA TUSHIRISH:
 *   node companion.mjs <PAIRING_CODE>          # dashboard'dagi 6-xonali kod
 *   API_URL=http://localhost:3001 node companion.mjs 306751
 *
 * HOLAT (halol): juftlash + poll-loop + computer-use loop TO'LIQ ishlaydi.
 * Ekran-olish va kiritish-boshqaruvi NATIV kutubxona talab qiladi — pastda
 * aniq belgilangan JOY (screenshotDesktop / performAction). MVP'da ular
 * `@nut-tree/nut-js` bilan ulanadi (`npm i @nut-tree/nut-js screenshot-desktop`).
 * Kutubxona bo'lmasa dastur baribir ishlaydi (stub) — buyruqlarni ko'rsatadi.
 */

const API = (process.env.API_URL ?? 'http://localhost:3001') + '/api';
const CODE = process.argv[2];
const POLL_MS = 2000;

if (!CODE) {
  console.error('Foydalanish: node companion.mjs <PAIRING_CODE>');
  process.exit(1);
}

let TOKEN = null;

async function pair() {
  const r = await fetch(`${API}/device/companion/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pairingCode: CODE }),
  });
  if (!r.ok) throw new Error(`Juftlash muvaffaqiyatsiz: ${r.status} ${await r.text()}`);
  const d = await r.json();
  TOKEN = d.token;
  console.log(`✔ Juftlandi (${d.kind}). Companion ishlamoqda — buyruqlar kutilmoqda…`);
}

const ct = () => ({ 'Content-Type': 'application/json', 'x-companion-token': TOKEN });

async function poll() {
  const r = await fetch(`${API}/device/companion/poll`, { method: 'POST', headers: ct() });
  if (!r.ok) return null;
  return (await r.json()).command;
}

async function report(commandId, status, result) {
  await fetch(`${API}/device/companion/result`, {
    method: 'POST',
    headers: ct(),
    body: JSON.stringify({ commandId, status, result }),
  }).catch(() => null);
}

// --- Buyruq bajaruvchilari ---
async function handle(cmd) {
  console.log(`→ Buyruq: ${cmd.kind}`, cmd.payload);
  try {
    if (cmd.kind === 'computer_use') {
      const summary = await computerUseLoop(cmd.payload.goal);
      await report(cmd.id, 'done', summary);
    } else {
      // send_sms/call/open_app — desktop'da qo'llab-quvvatlanmaydi (bu telefon-agent ishi)
      await report(cmd.id, 'failed', `Desktop companion '${cmd.kind}' ni qo'llamaydi`);
    }
  } catch (e) {
    await report(cmd.id, 'failed', String(e.message).slice(0, 200));
  }
}

/** B2 tsikli: skrinshot → server reja beradi (Gemini vision) → harakat → takror. */
async function computerUseLoop(goal) {
  const history = [];
  for (let i = 0; i < 15; i++) {
    const { image, width, height } = await screenshotDesktop();
    const r = await fetch(`${API}/device/companion/computer-use/plan`, {
      method: 'POST',
      headers: ct(),
      body: JSON.stringify({ goal, screenshot: image, screen: { width, height }, history }),
    });
    const action = await r.json();
    console.log(`   [${i + 1}] ${action.action}`, action.x ?? '', action.y ?? '', '—', action.reason ?? '');
    if (action.action === 'done') return action.summary ?? 'done';
    if (action.action === 'fail') return `fail: ${action.reason}`;
    const res = await performAction(action);
    history.push({ ...action, result: res });
  }
  return 'step budget exhausted';
}

// ================= NATIV JOY (MVP'da @nut-tree/nut-js bilan ulanadi) =================
async function screenshotDesktop() {
  try {
    const { default: screenshot } = await import('screenshot-desktop');
    const buf = await screenshot({ format: 'jpg' });
    // O'lchamni aniqlash uchun nut-js screen size:
    let width = 1920, height = 1080;
    try { const nut = await import('@nut-tree/nut-js'); width = await nut.screen.width(); height = await nut.screen.height(); } catch {}
    return { image: 'data:image/jpeg;base64,' + buf.toString('base64'), width, height };
  } catch {
    console.warn('   (stub) screenshot-desktop o\'rnatilmagan — bo\'sh kadr. `npm i screenshot-desktop @nut-tree/nut-js`');
    return { image: null, width: 1920, height: 1080 };
  }
}

async function performAction(action) {
  try {
    const nut = await import('@nut-tree/nut-js');
    const { mouse, keyboard, Point, Button } = nut;
    if (action.action === 'click') { await mouse.setPosition(new Point(action.x, action.y)); await mouse.click(Button.LEFT); return 'clicked'; }
    if (action.action === 'double_click') { await mouse.setPosition(new Point(action.x, action.y)); await mouse.doubleClick(Button.LEFT); return 'double'; }
    if (action.action === 'type') { await keyboard.type(action.text); return 'typed'; }
    if (action.action === 'key') { return 'key: ' + action.keys; /* nut key-map bilan */ }
    if (action.action === 'wait') { await new Promise(r => setTimeout(r, action.ms ?? 500)); return 'waited'; }
    return 'noop';
  } catch {
    console.warn('   (stub) @nut-tree/nut-js o\'rnatilmagan — harakat bajarilmadi.');
    return 'stub (nut-js yo\'q)';
  }
}
// ====================================================================================

async function main() {
  await pair();
  for (;;) {
    const cmd = await poll().catch(() => null);
    if (cmd) await handle(cmd);
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}
main().catch((e) => { console.error('Companion xatosi:', e.message); process.exit(1); });
