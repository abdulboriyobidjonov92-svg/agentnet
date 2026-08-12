"use client";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, Car, CheckCircle2, FingerprintPattern, Globe2,
  HeartPulse, Lock, Radio, Stethoscope, TrendingUp, Users, Wrench, Zap,
} from "lucide-react";
import { useAgentStore } from "./store/agentStore";

/**
 * Rol-vidjetlari — barcha ko'rsatkichlar DEMO SIMULYATSIYA (SIM belgisi bilan).
 * Har vidjet glass-panel ichida, data JetBrains Mono bilan.
 */

const mono = "font-[family-name:var(--font-jetbrains)]";

function SimBadge() {
  return (
    <span className={`${mono} rounded border border-white/15 px-1 py-px text-[8px] uppercase tracking-widest text-white/35`}>
      sim
    </span>
  );
}

function WidgetFrame({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="aos-glass flex h-full flex-col rounded-2xl p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/70">
          <Icon className="h-3.5 w-3.5 text-[hsl(var(--aos-accent))]" /> {title}
        </span>
        <SimBadge />
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

/* ============================= GENERIC ============================= */

export function WelcomeWidget() {
  return (
    <WidgetFrame title="AgentOS" icon={FingerprintPattern}>
      <p className="text-sm leading-relaxed text-white/70">
        Adaptiv interfeys — rolingizni tanlang yoki <span className="text-[hsl(var(--aos-accent))]">demo rejimni</span> ishga
        tushiring: tizim rolga qarab o'zini qayta quradi.
      </p>
      <div className={`${mono} mt-3 grid grid-cols-3 gap-2 text-center text-[10px] uppercase tracking-wider text-white/45`}>
        {["B2C", "B2B", "B2G"].map((s) => (
          <div key={s} className="rounded-lg border border-white/10 py-2">{s}</div>
        ))}
      </div>
    </WidgetFrame>
  );
}

/* ============================= DOCTOR ============================= */

export function VitalsWidget() {
  return (
    <WidgetFrame title="Bemor monitoringi" icon={HeartPulse}>
      <svg viewBox="0 0 300 60" className="h-14 w-full" aria-hidden>
        <motion.path
          d="M0,30 L40,30 L52,30 L58,12 L66,48 L74,22 L80,30 L120,30 L132,30 L138,12 L146,48 L154,22 L160,30 L200,30 L212,30 L218,12 L226,48 L234,22 L240,30 L300,30"
          fill="none" stroke="hsl(var(--aos-accent))" strokeWidth="1.6"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
        />
      </svg>
      <div className={`${mono} mt-2 grid grid-cols-3 gap-2 text-center`}>
        {[["HR", "72", "bpm"], ["SpO₂", "98", "%"], ["BP", "118/76", ""]].map(([l, v, u]) => (
          <div key={l} className="rounded-lg border border-white/10 py-1.5">
            <p className="text-[9px] uppercase text-white/40">{l}</p>
            <p className="text-sm font-semibold text-[hsl(var(--aos-accent))]">{v}<span className="text-[9px] text-white/40"> {u}</span></p>
          </div>
        ))}
      </div>
    </WidgetFrame>
  );
}

export function PatientQueueWidget() {
  const rows = [["09:30", "A. Karimova", "qabul"], ["10:15", "B. Tosheva", "tahlil"], ["11:00", "S. Rahimov", "nazorat"]];
  return (
    <WidgetFrame title="Navbat" icon={Users}>
      <div className={`${mono} space-y-1.5 text-[11px]`}>
        {rows.map(([t, n, k]) => (
          <div key={t} className="flex items-center justify-between rounded-lg border border-white/10 px-2 py-1.5">
            <span className="text-[hsl(var(--aos-accent))]">{t}</span>
            <span className="text-white/75">{n}</span>
            <span className="text-white/40">{k}</span>
          </div>
        ))}
      </div>
    </WidgetFrame>
  );
}

export function ProtocolWidget() {
  return (
    <WidgetFrame title="Steril protokol" icon={Stethoscope}>
      <div className="space-y-1.5 text-[11px] text-white/70">
        {["Qo'l gigienasi tasdiqlandi", "Asboblar sterilizatsiyasi OK", "Xona havosi filtrlanmoqda"].map((s) => (
          <p key={s} className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 shrink-0 text-[hsl(var(--aos-accent))]" /> {s}
          </p>
        ))}
      </div>
    </WidgetFrame>
  );
}

/* ============================= MECHANIC ============================= */

export function DiagnosticsWidget() {
  return (
    <WidgetFrame title="Diagnostika · Chevrolet Cobalt" icon={Car}>
      <div className="relative">
        {/* Avtomobil sxemasi (yon ko'rinish) */}
        <svg viewBox="0 0 300 90" className="h-20 w-full" aria-hidden>
          <path
            d="M30,65 L55,62 L75,42 L130,38 L185,40 L215,52 L268,58 L272,66 L255,70 L60,70 L38,70 Z"
            fill="none" stroke="hsl(var(--aos-accent) / 0.7)" strokeWidth="1.6"
          />
          <circle cx="85" cy="70" r="11" fill="none" stroke="hsl(var(--aos-accent))" strokeWidth="1.6" />
          <circle cx="225" cy="70" r="11" fill="none" stroke="hsl(var(--aos-accent))" strokeWidth="1.6" />
          {/* Nosozlik nuqtasi — dvigatel */}
          <motion.circle
            cx="105" cy="50" r="5" fill="hsl(var(--aos-accent))"
            animate={{ opacity: [1, 0.25, 1], r: [5, 7, 5] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
        </svg>
        <p className={`${mono} mt-1 flex items-center gap-1.5 text-[11px] text-[hsl(var(--aos-accent))]`}>
          <AlertTriangle className="h-3 w-3" /> P0301 — 1-tsilindr misfire · moy darajasi past
        </p>
      </div>
    </WidgetFrame>
  );
}

export function TorqueButtonsWidget() {
  const speak = useAgentStore((s) => s.speak);
  const stop = useAgentStore((s) => s.stopSpeaking);
  const actions = [
    ["Moy tarixi", "Oxirgi almashtirish: 8 200 km oldin. Keyingisi 800 km ichida tavsiya etiladi."],
    ["OBD skaner", "OBD-II ulanish simulyatsiyasi: 2 ta kod topildi — P0301, P0171."],
    ["Buyurtma", "Ehtiyot qism buyurtmasi qoralandi: moy filtri + shamlar to'plami."],
    ["Smeta", "Ish smetasi: 450 000 so'm (2.5 soat mehnat + qismlar)."],
  ] as const;
  return (
    <WidgetFrame title="Tezkor amallar" icon={Wrench}>
      {/* Katta, qo'lqopda bosiladigan tugmalar — ustaxona sharoiti uchun */}
      <div className="grid h-full grid-cols-2 gap-2">
        {actions.map(([label, line]) => (
          <motion.button
            key={label}
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            onClick={() => { speak(line); window.setTimeout(stop, 3200); }}
            className={`${mono} min-h-[52px] rounded-xl border border-[hsl(var(--aos-accent)/0.35)] bg-[hsl(var(--aos-accent)/0.1)] text-[12px] font-bold uppercase tracking-wide text-[hsl(var(--aos-accent))] transition-colors hover:bg-[hsl(var(--aos-accent)/0.2)]`}
          >
            {label}
          </motion.button>
        ))}
      </div>
    </WidgetFrame>
  );
}

export function JobQueueWidget() {
  const rows = [["#214", "Cobalt", "moy + filtr"], ["#215", "Nexia 3", "tormoz"], ["#216", "Damas", "diagnostika"]];
  return (
    <WidgetFrame title="Ish navbati" icon={Zap}>
      <div className={`${mono} space-y-1.5 text-[11px]`}>
        {rows.map(([id, car, job]) => (
          <div key={id} className="flex items-center justify-between rounded-lg border border-white/10 px-2 py-1.5">
            <span className="text-[hsl(var(--aos-accent))]">{id}</span>
            <span className="text-white/75">{car}</span>
            <span className="text-white/40">{job}</span>
          </div>
        ))}
      </div>
    </WidgetFrame>
  );
}

/* ============================= PRESIDENT ============================= */

export function GlobeWidget() {
  // SVG globus — uchinchi WebGL canvas o'rniga (60fps byudjeti uchun)
  return (
    <WidgetFrame title="Global monitoring" icon={Globe2}>
      <div className="flex h-full items-center justify-center">
        <svg viewBox="0 0 120 120" className="h-full max-h-36 w-auto" aria-hidden>
          <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--aos-accent) / 0.5)" strokeWidth="1" />
          {[20, 40, 60].map((ry) => (
            <ellipse key={ry} cx="60" cy="60" rx="50" ry={ry} fill="none" stroke="hsl(var(--aos-accent) / 0.25)" strokeWidth="0.8" />
          ))}
          <motion.ellipse
            cx="60" cy="60" rx="50" ry="50" fill="none"
            stroke="hsl(var(--aos-accent2, var(--aos-accent)))" strokeWidth="1" strokeDasharray="6 10"
            animate={{ rotate: 360 }} transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "60px 60px" }}
          />
          {[[38, 42], [72, 30], [86, 66], [48, 82]].map(([x, y], i) => (
            <motion.circle
              key={i} cx={x} cy={y} r="2.6" fill="hsl(var(--aos-accent2, var(--aos-accent)))"
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.45 }}
            />
          ))}
        </svg>
      </div>
    </WidgetFrame>
  );
}

export function TickerWidget() {
  const rows = [["YaIM o'sishi", "+5.8%"], ["Eksport (chorak)", "$6.4B"], ["Valyuta zaxirasi", "$41.2B"], ["Inflyatsiya", "8.9%"]];
  return (
    <WidgetFrame title="Strategik ko'rsatkichlar" icon={TrendingUp}>
      <div className={`${mono} space-y-1.5 text-[11px]`}>
        {rows.map(([l, v], i) => (
          <motion.div
            key={l}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, type: "spring", stiffness: 300, damping: 26 }}
            className="flex items-center justify-between rounded-lg border border-white/10 px-2 py-1.5"
          >
            <span className="text-white/60">{l}</span>
            <span className="font-semibold text-[hsl(var(--aos-accent2,var(--aos-accent)))]">{v}</span>
          </motion.div>
        ))}
      </div>
    </WidgetFrame>
  );
}

export function SecureCommWidget() {
  return (
    <WidgetFrame title="Maxfiy aloqa" icon={Lock}>
      <div className={`${mono} space-y-2 text-[11px]`}>
        <p className="flex items-center gap-1.5 text-white/70">
          <Radio className="h-3 w-3 text-[hsl(var(--aos-accent))]" /> Kanal: <span className="text-[hsl(var(--aos-accent))]">AES-256 · SIM</span>
        </p>
        <div className="rounded-lg border border-white/10 p-2 text-white/50">
          ▸ Vazirlar Mahkamasi — hisobot tayyor<br />
          ▸ Mintaqa-3 — infratuzilma so'rovi<br />
          ▸ Xavfsizlik kengashi — 14:00 brifing
        </div>
      </div>
    </WidgetFrame>
  );
}

/* ============================= UMUMIY ============================= */

export function ActivityWidget() {
  return (
    <WidgetFrame title="Tizim faolligi" icon={Activity}>
      <svg viewBox="0 0 200 40" className="h-12 w-full" aria-hidden>
        <motion.polyline
          points="0,30 20,26 40,28 60,18 80,22 100,12 120,16 140,8 160,14 180,6 200,10"
          fill="none" stroke="hsl(var(--aos-accent))" strokeWidth="1.5"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6 }}
        />
      </svg>
      <p className={`${mono} mt-1 text-[10px] uppercase tracking-wider text-white/40`}>agent chaqiruvlari · 24h</p>
    </WidgetFrame>
  );
}
