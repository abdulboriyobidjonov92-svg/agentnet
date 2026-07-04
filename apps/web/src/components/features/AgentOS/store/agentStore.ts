"use client";
import { create } from "zustand";

/**
 * AgentOS "Living Interface" holati — rol, tema, inqiroz rejimi, agent nutqi
 * va demo-simulyatsiya bosqichi. Butun sahna shu store'dan boshqariladi:
 * rol o'zgarsa CSS o'zgaruvchilar, zarracha rangi/tezligi va layout morflanadi.
 */

export type UserRole = "generic" | "doctor" | "mechanic" | "president";

export interface RoleTheme {
  /** UI label */
  label: string;
  labelUz: string;
  /** Asosiy urg'u (hsl bo'laklari: "H S% L%") */
  accent: string;
  accent2: string;
  /** Fon toni */
  bgTint: string;
  /** three.js zarracha ranglari (hex) */
  particleColor: string;
  particleColor2: string;
  /** Zarracha harakati: 0.2 sokin — 2.0 xaotik */
  particleSpeed: number;
  /** Hologram agent nomi va namunaviy nutqi */
  agentName: string;
  agentLine: string;
}

export const ROLE_THEMES: Record<UserRole, RoleTheme> = {
  generic: {
    label: "Explorer",
    labelUz: "Foydalanuvchi",
    accent: "220 15% 75%",
    accent2: "190 80% 60%",
    bgTint: "230 15% 4%",
    particleColor: "#7fb8cc",
    particleColor2: "#3d5a66",
    particleSpeed: 0.35,
    agentName: "ARIA · Universal Agent",
    agentLine: "Rolingizni aniqlash uchun demo rejimni ishga tushiring.",
  },
  doctor: {
    label: "Doctor",
    labelUz: "Shifokor",
    accent: "190 95% 62%",
    accent2: "0 0% 98%",
    bgTint: "200 30% 5%",
    particleColor: "#38ddff",
    particleColor2: "#e8fbff",
    particleSpeed: 0.3,
    agentName: "MEDIS · Clinical Copilot",
    agentLine: "Bemor navbati sinxronlandi. Bugungi 12 qabul rejalashtirilgan.",
  },
  mechanic: {
    label: "Car Mechanic",
    labelUz: "Avto mexanik",
    accent: "38 95% 55%",
    accent2: "20 10% 12%",
    bgTint: "30 20% 4%",
    particleColor: "#f5a623",
    particleColor2: "#4a3010",
    particleSpeed: 0.8,
    agentName: "TORQUE · Diagnostics Agent",
    agentLine: "Moy almashtirish jadvali yangilandi. Keyingi TO: 4 200 km.",
  },
  president: {
    label: "President",
    labelUz: "Prezident",
    accent: "225 60% 55%",
    accent2: "42 88% 58%",
    bgTint: "228 40% 4%",
    particleColor: "#3b5bdb",
    particleColor2: "#f0b429",
    particleSpeed: 0.45,
    agentName: "ATLAS · Strategic Command",
    agentLine: "Global monitoring faol. 3 mintaqadan yangi hisobot keldi.",
  },
};

export type DemoStep =
  | "idle"
  | "biometric"
  | "role_detect"
  | "transform"
  | "agent_action"
  | "marketplace"
  | "done";

interface AgentOSState {
  role: UserRole;
  /** Inqiroz rejimi — zarrachalar tez va xaotik */
  crisis: boolean;
  /** Agent "gapiryapti" — waveform + zarracha pulsi */
  speaking: boolean;
  /** Ayni paytdagi nutq matni (subtitr) */
  speechText: string;
  demoStep: DemoStep;
  purchaseSuccess: boolean;

  setRole: (r: UserRole) => void;
  setCrisis: (c: boolean) => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  setDemoStep: (s: DemoStep) => void;
  setPurchaseSuccess: (v: boolean) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentOSState>((set) => ({
  role: "generic",
  crisis: false,
  speaking: false,
  speechText: "",
  demoStep: "idle",
  purchaseSuccess: false,

  setRole: (role) => set({ role }),
  setCrisis: (crisis) => set({ crisis }),
  speak: (speechText) => set({ speaking: true, speechText }),
  stopSpeaking: () => set({ speaking: false }),
  setDemoStep: (demoStep) => set({ demoStep }),
  setPurchaseSuccess: (purchaseSuccess) => set({ purchaseSuccess }),
  reset: () =>
    set({
      role: "generic",
      crisis: false,
      speaking: false,
      speechText: "",
      demoStep: "idle",
      purchaseSuccess: false,
    }),
}));
