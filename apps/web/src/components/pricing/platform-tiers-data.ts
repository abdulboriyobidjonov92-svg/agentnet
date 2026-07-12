import type { ComponentType } from "react";
import { Gem, Building2, Rocket, Crown, Users2 } from "lucide-react";

export type SelfServePlan = "pro" | "max" | "max200";

// Platforma tariflari (Claude.ai uslubi) — self-serve: pro/max/max200; team/enterprise: bog'lanish.
// `features` = i18n kalitlari (har tarif nima ochishini aniq ro'yxatlaydi).
export interface PlatformTier {
  id: SelfServePlan | "team" | "enterprise";
  self: boolean;
  icon: ComponentType<{ className?: string }>;
  name: string;
  desc: string;
  features: string[];
  highlight?: boolean;
  cta?: string;
  href?: string;
}

export const PLATFORM_TIERS: PlatformTier[] = [
  {
    id: "pro",
    self: true,
    icon: Rocket,
    name: "pricing.platform.pro",
    desc: "pricing.platform.proDesc",
    features: ["pricing.pt.f.decision", "pricing.pt.f.experts", "pricing.pt.f.deep", "pricing.pt.f.standard"],
  },
  {
    id: "max",
    self: true,
    icon: Crown,
    highlight: true,
    name: "pricing.platform.max",
    desc: "pricing.platform.maxDesc",
    features: ["pricing.pt.inPro", "pricing.pt.priority"],
  },
  {
    id: "max200",
    self: true,
    icon: Gem,
    name: "pricing.pt.max200",
    desc: "pricing.pt.max200Desc",
    features: ["pricing.pt.inMax", "pricing.pt.topPriority"],
  },
  {
    id: "team",
    self: false,
    icon: Users2,
    name: "pricing.pt.team",
    desc: "pricing.pt.teamDesc",
    features: ["pricing.pt.team.f1", "pricing.pt.team.f2", "pricing.pt.team.f3"],
    cta: "pricing.platform.contactUs",
    href: "mailto:sales@agentnet.app",
  },
  {
    id: "enterprise",
    self: false,
    icon: Building2,
    name: "pricing.platform.enterprise",
    desc: "pricing.platform.enterpriseDesc",
    features: ["pricing.platform.unlimited", "pricing.pt.ent.f1", "pricing.pt.ent.f2"],
    cta: "pricing.platform.contactUs",
    href: "mailto:sales@agentnet.app",
  },
];
