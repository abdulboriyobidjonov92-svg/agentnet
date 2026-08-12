"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle2, FingerprintPattern, Play, ShieldCheck, Square, Zap } from "lucide-react";
import { NeuralBackground } from "@/components/features/AgentOS/NeuralBackground";
import { HologramActor } from "@/components/features/AgentOS/HologramActor";
import { AdaptiveShell } from "@/components/features/AgentOS/AdaptiveShell";
import { useDemoMode } from "@/components/features/AgentOS/useDemoMode";
import { ROLE_THEMES, useAgentStore, type UserRole } from "@/components/features/AgentOS/store/agentStore";

/**
 * AgentOS Demo — "Living Interface" ko'rgazma sahnasi.
 * To'liq ekran (100dvh, skrollsiz), rolga qarab butun interfeys morflanadi:
 * Neural Void zarrachalari, rang tokenlari, bento-layout va hologram agent.
 * Barcha ko'rsatkichlar SIMULYATSIYA — sahifa hech qanday backend chaqirmaydi.
 */

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

const ROLES: UserRole[] = ["generic", "doctor", "mechanic", "president"];

function RoleSwitcher() {
  const role = useAgentStore((s) => s.role);
  const setRole = useAgentStore((s) => s.setRole);
  return (
    <div className="aos-glass flex rounded-full p-1" role="tablist" aria-label="Rol tanlash">
      {ROLES.map((r) => (
        <button
          key={r}
          role="tab"
          aria-selected={role === r}
          onClick={() => setRole(r)}
          className={`relative rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
            role === r ? "text-black" : "text-white/55 hover:text-white/85"
          }`}
        >
          {role === r && (
            <motion.span
              layoutId="role-pill"
              className="absolute inset-0 rounded-full bg-[hsl(var(--aos-accent))]"
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
            />
          )}
          <span className="relative">{ROLE_THEMES[r].labelUz}</span>
        </button>
      ))}
    </div>
  );
}

/** Demo bosqich overlaylari — biometrik skan, rol aniqlash, marketplace xarid */
function DemoOverlay() {
  const step = useAgentStore((s) => s.demoStep);
  const purchaseSuccess = useAgentStore((s) => s.purchaseSuccess);

  return (
    <AnimatePresence>
      {step === "biometric" && (
        <motion.div
          key="bio"
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="aos-glass aos-neon flex flex-col items-center gap-4 rounded-3xl p-10">
            <div className="relative">
              <FingerprintPattern className="h-16 w-16 text-[hsl(var(--aos-accent))]" />
              <motion.div
                className="absolute inset-x-0 h-0.5 bg-[hsl(var(--aos-accent))]"
                animate={{ top: ["10%", "90%", "10%"] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <p className="font-[family-name:var(--font-jetbrains)] text-xs uppercase tracking-[0.25em] text-white/70">
              Biometrik skan · simulyatsiya
            </p>
          </div>
        </motion.div>
      )}

      {step === "role_detect" && (
        <motion.div
          key="detect"
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="text-center font-[family-name:var(--font-jetbrains)]">
            <motion.p
              className="text-xs uppercase tracking-[0.3em] text-white/50"
              animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}
            >
              Foydalanuvchi skanerlanmoqda…
            </motion.p>
            <motion.p
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.2, type: "spring", stiffness: 300, damping: 20 }}
              className="mt-3 text-2xl font-bold tracking-tight text-[hsl(var(--aos-accent))]"
            >
              ROL ANIQLANDI: AVTO MEXANIK
            </motion.p>
          </div>
        </motion.div>
      )}

      {step === "marketplace" && (
        <motion.div
          key="market"
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="aos-glass aos-neon w-[300px] rounded-3xl p-6 text-center"
            initial={{ y: 24 }} animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--aos-accent)/0.15)]">
              <Zap className="h-6 w-6 text-[hsl(var(--aos-accent))]" />
            </div>
            <p className="text-sm font-bold">Diagnostics Plugin</p>
            <p className="font-[family-name:var(--font-jetbrains)] mt-1 text-[11px] text-white/50">
              OBD-II tahlil · 45 000 so'm · demo-xarid
            </p>
            {!purchaseSuccess ? (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full bg-[hsl(var(--aos-accent))]"
                  initial={{ width: "0%" }} animate={{ width: "100%" }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                />
              </div>
            ) : (
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 18 }}
                className="mt-4 flex items-center justify-center gap-1.5 text-[hsl(var(--aos-accent))]"
              >
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-bold">O'rnatildi!</span>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function AgentOSDemoPage() {
  const role = useAgentStore((s) => s.role);
  const crisis = useAgentStore((s) => s.crisis);
  const setCrisis = useAgentStore((s) => s.setCrisis);
  const demo = useDemoMode({ loop: false });
  const theme = ROLE_THEMES[role];

  // Rol temasi — CSS o'zgaruvchilar (barcha .aos-* utilities shundan oziqlanadi)
  const themeVars = useMemo(
    () =>
      ({
        "--aos-accent": theme.accent,
        "--aos-accent2": theme.accent2,
        "--aos-bg": theme.bgTint,
      }) as React.CSSProperties,
    [theme],
  );

  return (
    <main
      className={`${inter.variable} ${jetbrains.variable} aos-noscroll relative h-dvh overflow-hidden font-[family-name:var(--font-inter)] text-white transition-colors duration-700`}
      style={{ ...themeVars, background: "hsl(var(--aos-bg))" }}
    >
      {/* Neural Void — zarracha fon */}
      <NeuralBackground className="absolute inset-0" />

      {/* Yuqori panel */}
      <header className="relative z-30 flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="aos-glass flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition-colors hover:text-white"
            aria-label="Bosh sahifaga qaytish"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-sm font-bold tracking-tight">AgentOS</p>
            <p className="font-[family-name:var(--font-jetbrains)] text-[9px] uppercase tracking-[0.25em] text-[hsl(var(--aos-accent))]">
              Living Interface · Demo
            </p>
          </div>
        </div>

        <div className="hidden md:block">
          <RoleSwitcher />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCrisis(!crisis)}
            aria-pressed={crisis}
            className={`aos-glass rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
              crisis ? "text-red-400" : "text-white/55 hover:text-white/85"
            }`}
          >
            {crisis ? "Inqiroz: ON" : "Inqiroz: OFF"}
          </button>
          <button
            onClick={demo.active ? demo.stop : demo.start}
            className="cta-gold flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider"
          >
            {demo.active ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {demo.active ? "To'xtatish" : "Demo rejim"}
          </button>
        </div>
      </header>

      {/* Mobil rol tanlagich */}
      <div className="relative z-30 px-4 pb-2 md:hidden">
        <RoleSwitcher />
      </div>

      {/* Asosiy sahna: chap — adaptiv bento, o'ng — hologram stage */}
      <div className="relative z-20 flex h-[calc(100dvh-64px)] gap-4 px-4 pb-4 sm:px-6 md:h-[calc(100dvh-60px)]">
        <AdaptiveShell className="aos-noscroll min-w-0 flex-1 overflow-y-auto pt-1" />
        <div className="hidden w-[300px] shrink-0 lg:block">
          <div className="aos-glass aos-neon h-full rounded-3xl">
            <HologramActor className="h-full w-full" />
          </div>
        </div>
      </div>

      {/* Pastki status */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-1 z-20 flex items-center justify-center gap-2 font-[family-name:var(--font-jetbrains)] text-[9px] uppercase tracking-[0.2em] text-white/30">
        <ShieldCheck className="h-3 w-3" /> Halal Filter faol · barcha ko'rsatkichlar simulyatsiya
      </footer>

      <DemoOverlay />
    </main>
  );
}
