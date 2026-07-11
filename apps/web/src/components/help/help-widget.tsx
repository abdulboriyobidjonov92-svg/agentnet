"use client";
// YORDAM WIDGETI — har sahifada ko'rinadigan suzuvchi tugma. Ochilganda ikki tab:
//  • Savol-javob (FAQ) — tez-tez so'raladigan savollar (akkordeon)
//  • Fikr bildirish — taklif/shikoyat/savol -> POST /feedback (admin panelga tushadi)

import { useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, X, ChevronDown, Lightbulb, Bug, MessageCircleQuestion, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

type Tab = "faq" | "feedback";
type Kind = "suggestion" | "bug" | "question";

const FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5"] as const;
const KINDS: { id: Kind; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "suggestion", icon: Lightbulb },
  { id: "bug", icon: Bug },
  { id: "question", icon: MessageCircleQuestion },
];

export function HelpWidget() {
  const { t, locale } = useT();
  const api = useApiClient();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("faq");
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("suggestion");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (message.trim().length < 3) return;
    setSending(true);
    try {
      await api.post("/feedback", { kind, message: message.trim(), page: pathname, locale });
      setSent(true);
      setMessage("");
      setTimeout(() => setSent(false), 3500);
    } catch {
      // Xato — foydalanuvchini bloklamaymiz; qayta urinishi mumkin
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Suzuvchi tugma */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("help.button")}
        className="mercury fixed bottom-5 right-5 z-[90] flex h-12 w-12 items-center justify-center rounded-full shadow-lift lg:bottom-6 lg:right-6"
      >
        {open ? <X className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-[90] w-[min(92vw,22rem)] lg:bottom-24 lg:right-6">
          <div className="liquid-glass flex max-h-[70vh] flex-col overflow-hidden rounded-3xl border border-white/[0.08] shadow-lift">
            {/* Sarlavha + tablar */}
            <div className="border-b border-white/[0.06] p-4">
              <h3 className="mb-3 font-semibold">{t("help.title")}</h3>
              <div className="inline-flex gap-1 rounded-xl border border-white/[0.06] bg-black/20 p-1">
                {(["faq", "feedback"] as Tab[]).map((id) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                      tab === id ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(id === "faq" ? "help.tabFaq" : "help.tabFeedback")}
                  </button>
                ))}
              </div>
            </div>

            <div className="scroll-thin overflow-y-auto p-4">
              {tab === "faq" ? (
                <div className="space-y-2">
                  {FAQ_KEYS.map((q) => {
                    const isOpen = openFaq === q;
                    return (
                      <div key={q} className="rounded-xl border border-white/[0.06]">
                        <button
                          onClick={() => setOpenFaq(isOpen ? null : q)}
                          aria-expanded={isOpen}
                          className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm font-medium"
                        >
                          {t(`help.faq.${q}`)}
                          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
                        </button>
                        {isOpen && (
                          <p className="px-3.5 pb-3 text-sm leading-relaxed text-muted-foreground">
                            {t(`help.faq.a_${q}`)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : sent ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Check className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{t("help.fb.thanks")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-1.5">
                    {KINDS.map(({ id, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => setKind(id)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs transition",
                          kind === id
                            ? "border-primary/50 bg-primary/5 text-foreground"
                            : "border-white/[0.06] text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {t(`help.fb.kind.${id}`)}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("help.fb.placeholder")}
                    rows={4}
                    className="text-sm"
                  />
                  <Button onClick={submit} disabled={sending || message.trim().length < 3} className="w-full">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("help.fb.submit")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
