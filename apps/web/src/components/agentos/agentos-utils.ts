import { Crown, Wallet, Megaphone, Scale, Cpu } from "lucide-react";

export function ops(base: number, seed: number, n = 20) {
  const out: number[] = [];
  let v = base * 0.6;
  for (let i = 0; i < n; i++) { v = v * (1 + Math.sin(i / 3 + seed) * 0.08) + base / n; out.push(Math.round(v)); }
  return out;
}

export const ROLE_ICON: Record<string, any> = { ceo: Crown, cfo: Wallet, cmo: Megaphone, clo: Scale, cto: Cpu };
export const ROLE_COLOR: Record<string, string> = {
  ceo: "text-gold border-gold/40",
  cfo: "text-emeraldx border-emerald-400/30",
  cmo: "text-violetx border-violet-400/30",
  clo: "text-neon border-cyan-400/30",
  cto: "text-blue-400 border-blue-400/30",
};

export interface Dept {
  role: string;
  label: string;
  title: string;
  output: string;
  ethics: { verdict: string; reasoning: string };
}

export interface CommandResult {
  command: string;
  departments: Dept[];
  report: string;
  ethics_summary: Record<string, number>;
  method: string;
}
