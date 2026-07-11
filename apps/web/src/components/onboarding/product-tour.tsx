"use client";
// MAHSULOT-TUR — yangi foydalanuvchi uchun sahifama-sahifa "keyingi → keyingi"
// tanishtiruv. Har asosiy bo'lim ustida qisqa tushuntirish qutisi. Bir marta
// ko'rilgach DB'da (User.tourCompleted) belgilanadi va qayta ochilmaydi.
// Sozlamalardan "agentnet:tour" hodisasi bilan qayta ishga tushirish mumkin.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Compass, LayoutTemplate, Plug, Gem, Sparkles, X } from "lucide-react";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

/** Sozlamalardan qo'lda ishga tushirish uchun hodisa nomi. */
export const TOUR_EVENT = "agentnet:tour";

interface Step {
  icon: React.ComponentType<{ className?: string }>;
  titleKey: string;
  bodyKey: string;
  href?: string; // "Ko'rsatish" bosilganda o'sha bo'limga o'tadi
}

const STEPS: Step[] = [
  { icon: Sparkles, titleKey: "tour.s1.title", bodyKey: "tour.s1.body" },
  { icon: Bot, titleKey: "tour.s2.title", bodyKey: "tour.s2.body", href: "/agents/new" },
  { icon: LayoutTemplate, titleKey: "tour.s3.title", bodyKey: "tour.s3.body", href: "/templates" },
  { icon: Plug, titleKey: "tour.s4.title", bodyKey: "tour.s4.body", href: "/connectors" },
  { icon: Gem, titleKey: "tour.s5.title", bodyKey: "tour.s5.body", href: "/pricing" },
  { icon: Compass, titleKey: "tour.s6.title", bodyKey: "tour.s6.body", href: "/agents/new" },
];

export function ProductTour() {
  const { t } = useT();
  const api = useApiClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [manual, setManual] = useState(false);
  const [step, setStep] = useState(0);

  // Profilni o'qiymiz — tur ko'rilmagan bo'lsa (birinchi kirish) avtomatik ochiladi
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<{ tourCompleted?: boolean }>("/users/me"),
    staleTime: 60_000,
  });

  const autoOpen = profile != null && profile.tourCompleted === false;
  const open = manual || autoOpen;

  // Sozlamalardagi "qayta ko'rish" tugmasi shu hodisani yuboradi
  useEffect(() => {
    const start = () => {
      setStep(0);
      setManual(true);
    };
    window.addEventListener(TOUR_EVENT, start);
    return () => window.removeEventListener(TOUR_EVENT, start);
  }, []);

  const finish = useCallback(async () => {
    setManual(false);
    setStep(0);
    // Faqat hali belgilanmagan bo'lsa serverga yozamiz (qayta-ko'rishda ortiqcha so'rov yo'q)
    if (profile && profile.tourCompleted === false) {
      try {
        await api.patch("/users/me", { tourCompleted: true });
        queryClient.setQueryData(["profile"], { ...profile, tourCompleted: true });
      } catch {
        // jim o'tamiz — tur majburiy emas, keyingi safar qayta ko'rsatiladi
      }
    }
  }, [api, profile, queryClient]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const total = STEPS.length;
  const dots = useMemo(() => Array.from({ length: total }, (_, i) => i), [total]);

  if (!open || !current) return null;
  const Icon = current.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("tour.aria")}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={finish} />

      <div className="liquid-glass relative z-10 w-full max-w-md rounded-3xl border border-white/[0.08] p-7 shadow-lift">
        <button
          onClick={finish}
          aria-label={t("tour.skip")}
          className="absolute right-4 top-4 text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <div
          className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{
            background: "linear-gradient(135deg, hsl(var(--vein-cyan) / 0.18), hsl(var(--vein-violet) / 0.18))",
            boxShadow: "0 0 24px hsl(var(--vein-cyan) / 0.25)",
          }}
        >
          <Icon className="h-6 w-6 text-foreground" />
        </div>

        <h2 className="mb-2 text-xl font-bold tracking-tight">{t(current.titleKey)}</h2>
        <p className="min-h-[3.5rem] text-sm leading-relaxed text-muted-foreground">{t(current.bodyKey)}</p>

        {current.href && (
          <button
            onClick={() => {
              const href = current.href!;
              void finish().then(() => router.push(href));
            }}
            className="vein-text mt-3 text-sm font-medium transition hover:opacity-80"
          >
            {t("tour.show")} →
          </button>
        )}

        <div className="mt-6 flex items-center justify-between">
          {/* Bosqich nuqtalari */}
          <div className="flex items-center gap-1.5">
            {dots.map((i) => (
              <span
                key={i}
                aria-hidden
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === step ? 18 : 6,
                  background: i === step ? "hsl(var(--vein-cyan))" : "hsl(var(--foreground) / 0.2)",
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                {t("tour.back")}
              </Button>
            )}
            {!isLast && (
              <Button variant="ghost" size="sm" onClick={finish}>
                {t("tour.skip")}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => (isLast ? void finish() : setStep((s) => s + 1))}
              className="mercury rounded-xl"
            >
              {isLast ? t("tour.done") : t("tour.next")}
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
          {t("tour.stepOf").replace("{n}", String(step + 1)).replace("{total}", String(total))}
        </p>
      </div>
    </div>
  );
}
