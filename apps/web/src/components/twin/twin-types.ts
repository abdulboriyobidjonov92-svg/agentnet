import { Wallet, Briefcase, Users, HeartPulse, Repeat, GraduationCap, CircleDot } from "lucide-react";

export const CATEGORIES = [
  { id: "finance", icon: Wallet },
  { id: "work", icon: Briefcase },
  { id: "family", icon: Users },
  { id: "health", icon: HeartPulse },
  { id: "habits", icon: Repeat },
  { id: "education", icon: GraduationCap },
  { id: "other", icon: CircleDot },
];

export interface TwinFact {
  id: string;
  category: string;
  label: string;
  value: string;
  source: string;
}

export interface WhatIfResult {
  summary: string;
  assumptions: string[];
  timeline: { period: string; projection: string }[];
  risks: string[];
  opportunities: string[];
  recommendation: string;
  confidence: number;
  used_facts: string[];
  method: string;
}
