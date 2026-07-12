"use client";
import { ShieldAlert, ShieldCheck, User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { useT } from "@/lib/i18n/client";
import type { Message } from "./message-types";

const TIME_LOCALES: Record<string, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" };

export function MessageBubble({ message }: { message: Message }) {
  const { t, locale } = useT();
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2 text-sm text-destructive max-w-md text-center">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div className={cn("rounded-full p-2 h-8 w-8 flex items-center justify-center shrink-0", isUser ? "bg-primary text-primary-foreground" : "bg-secondary")}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary" />}
      </div>

      {/* Bubble */}
      <div className={cn("max-w-[75%] space-y-1", isUser && "items-end flex flex-col")}>
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm",
          isUser ? "rounded-tr-none bg-primary text-primary-foreground" : "rounded-tl-none bg-secondary",
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Halal flag */}
        {message.halalFlag && message.halalFlag !== "ALLOW" && (
          <div className={cn(
            "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
            message.halalFlag === "BLOCK" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700",
          )}>
            <ShieldAlert className="h-3 w-3" />
            {message.halalFlag === "BLOCK" ? t("chat.halalBlocked") : t("chat.halalReview")}
          </div>
        )}
        {message.halalFlag === "ALLOW" && !isUser && (
          <div className="flex items-center gap-1 text-xs px-2 py-0.5 text-primary">
            <ShieldCheck className="h-3 w-3" /> {t("chat.halalPassed")}
          </div>
        )}

        <p className={cn("text-[11px] text-muted-foreground", isUser && "text-right")}>
          {new Date(message.timestamp).toLocaleTimeString(TIME_LOCALES[locale] ?? "en-US", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
