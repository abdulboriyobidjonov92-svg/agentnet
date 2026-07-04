"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAgentStore } from "./store/agentStore";

/**
 * useDemoMode — "Simulation Harness": to'liq foydalanuvchi sayohatini
 * avtomatik aylantiradi (tekshiruv/ko'rgazma uchun):
 *   1. biometric  — biometrik skan simulyatsiyasi
 *   2. role_detect — "Rol aniqlandi: AVTO MEXANIK"
 *   3. transform  — UI generic'dan Industrial Amber'ga morflanadi
 *   4. agent_action — hologram agent gapiradi ("Moy jadvali yangilandi")
 *   5. marketplace — "Diagnostics Plugin" avto-xarid + muvaffaqiyat animatsiyasi
 * Har bir bosqich muddati DEMO_TIMELINE'da; loop=true bo'lsa qaytadan boshlanadi.
 */

const DEMO_TIMELINE: { step: Parameters<ReturnType<typeof useAgentStore.getState>["setDemoStep"]>[0]; ms: number }[] = [
  { step: "biometric", ms: 2600 },
  { step: "role_detect", ms: 2600 },
  { step: "transform", ms: 2200 },
  { step: "agent_action", ms: 4200 },
  { step: "marketplace", ms: 3600 },
  { step: "done", ms: 2400 },
];

export function useDemoMode({ loop = false }: { loop?: boolean } = {}) {
  const [active, setActive] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const runOnce = useCallback(() => {
    const store = useAgentStore.getState();
    store.reset();
    clearTimers();

    let at = 0;
    for (const { step, ms } of DEMO_TIMELINE) {
      timers.current.push(
        window.setTimeout(() => {
          const s = useAgentStore.getState();
          s.setDemoStep(step);
          switch (step) {
            case "role_detect":
              // "Skanerlash" tugadi — hali generic
              break;
            case "transform":
              s.setRole("mechanic"); // UI Industrial Amber'ga morflanadi
              break;
            case "agent_action":
              s.speak("Moy almashtirish jadvali yangilandi. Keyingi TO: 4 200 km.");
              break;
            case "marketplace":
              s.stopSpeaking();
              s.setPurchaseSuccess(false);
              // Xarid "jarayoni" → muvaffaqiyat
              timers.current.push(
                window.setTimeout(() => useAgentStore.getState().setPurchaseSuccess(true), 1600),
              );
              break;
            case "done":
              break;
          }
        }, at),
      );
      at += ms;
    }
    return at; // umumiy davomiylik
  }, []);

  const start = useCallback(() => {
    setActive(true);
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    clearTimers();
    useAgentStore.getState().reset();
  }, []);

  useEffect(() => {
    if (!active) return;
    const total = runOnce();
    let interval: number | undefined;
    if (loop) {
      interval = window.setInterval(() => runOnce(), total + 800);
    } else {
      timers.current.push(window.setTimeout(() => setActive(false), total + 100));
    }
    return () => {
      clearTimers();
      if (interval) window.clearInterval(interval);
    };
  }, [active, loop, runOnce]);

  useEffect(() => () => clearTimers(), []);

  return { active, start, stop };
}
