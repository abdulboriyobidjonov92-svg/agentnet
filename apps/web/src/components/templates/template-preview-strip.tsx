"use client";
import { useEffect, useState } from "react";
import { MessageCircle, Wrench, TrendingUp, Zap, CheckCircle2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";

/**
 * Y6: video emas — 3-4 kadrli statik "skrinshot-ketma-ketlik" (avtomatik
 * aylanadigan), shablon ma'lumotidan (tools/depth) qurilgan. Agent qanday
 * ishlashini tezkor tasavvur beradi — haqiqiy screenshot/GIF assets shart emas.
 */

interface Props {
  profession: string;
  tools: string[];
  depth: { prediction: boolean; autonomous: boolean };
}

const FRAME_MS = 1800;

export function TemplatePreviewStrip({ profession, tools, depth }: Props) {
  const { t } = useT();

  const frames = [
    { icon: MessageCircle, text: t("templates.previewAsk").replace("{profession}", profession) },
    { icon: Wrench, text: tools[0] ? `${t("templates.previewTool")}: ${tools[0]}` : t("templates.previewToolGeneric") },
    depth.prediction
      ? { icon: TrendingUp, text: t("templates.predicts") }
      : depth.autonomous
        ? { icon: Zap, text: t("templates.autonomous") }
        : { icon: Wrench, text: t("templates.previewToolGeneric") },
    { icon: CheckCircle2, text: t("templates.previewDone") },
  ];

  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((prev) => (prev + 1) % frames.length), FRAME_MS);
    return () => clearInterval(id);
  }, [frames.length]);

  const Frame = frames[i];
  const Icon = Frame.icon;

  return (
    <div className="relative mb-3 flex h-14 items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-background/40 px-3">
      <div key={i} className="flex w-full items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <p className="truncate text-xs text-muted-foreground">{Frame.text}</p>
      </div>
      <div className="absolute bottom-1 right-2 flex gap-1">
        {frames.map((_, idx) => (
          <span
            key={idx}
            className={`h-1 w-1 rounded-full transition-colors ${idx === i ? "bg-primary" : "bg-muted-foreground/30"}`}
          />
        ))}
      </div>
    </div>
  );
}
