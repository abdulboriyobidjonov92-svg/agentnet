"use client";
// ULASHISH TUGMASI (PLG) — natijani ("bu oy do'kon tushumi") ommaviy /s/<token>
// sahifasiga snapshot qiladi va ulashish varag'ini ochadi: havolani nusxalash,
// Telegram (t.me/share deep-link), yoki qurilma ulashish varag'i (Web Share).

import { useState } from "react";
import { Share2, Copy, Check, Send, Loader2, X, ExternalLink } from "lucide-react";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

export interface ShareMetric {
  label: string;
  value: string;
  hint?: string;
}

export interface SharePayload {
  kind?: "retail_forecast" | "twin" | "goal" | "generic";
  title: string;
  subtitle?: string;
  metrics?: ShareMetric[];
  body?: string;
}

export function ShareButton({
  payload,
  variant = "outline",
  size = "sm",
  className,
}: {
  payload: SharePayload;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "md" | "icon-sm";
  className?: string;
}) {
  const { t, locale } = useT();
  const api = useApiClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const start = async () => {
    setOpen(true);
    if (url) return;
    setLoading(true);
    setError(false);
    try {
      const { token } = await api.post<{ token: string }>("/share", { ...payload, locale });
      setUrl(`${window.location.origin}/s/${token}`);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard yopiq — foydalanuvchi qo'lda nusxalaydi */
    }
  };

  const telegram = () => {
    if (!url) return;
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(payload.title)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const webShare = () => {
    if (url && typeof navigator !== "undefined" && navigator.share) {
      void navigator.share({ title: payload.title, url });
    }
  };

  const canWebShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={start}>
        <Share2 className="h-4 w-4" /> {size !== "icon-sm" && t("share.button")}
      </Button>

      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="liquid-glass relative z-10 w-full max-w-sm rounded-3xl border border-white/[0.08] p-6 shadow-lift">
            <button
              onClick={() => setOpen(false)}
              aria-label={t("common.cancel")}
              className="absolute right-4 top-4 text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="mb-1 font-semibold">{t("share.title")}</h3>
            <p className="mb-4 text-sm text-muted-foreground">{payload.title}</p>

            {loading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("share.generating")}
              </div>
            ) : error ? (
              <p className="py-4 text-sm text-destructive">{t("common.error")}</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2">
                  <span className="scroll-thin flex-1 truncate font-mono text-xs text-muted-foreground">{url}</span>
                  <button onClick={copy} aria-label={t("share.copy")} className="shrink-0 text-muted-foreground hover:text-foreground">
                    {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={telegram}>
                    <Send className="h-4 w-4" /> {t("share.telegram")}
                  </Button>
                  {canWebShare ? (
                    <Button variant="outline" size="sm" onClick={webShare}>
                      <ExternalLink className="h-4 w-4" /> {t("share.more")}
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={copy}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {t("share.copy")}
                    </Button>
                  )}
                </div>
                <p className="pt-1 text-center text-[11px] text-muted-foreground/60">{t("share.watermark")}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
