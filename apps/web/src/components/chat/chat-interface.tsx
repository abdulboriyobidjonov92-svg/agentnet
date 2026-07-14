"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, ShieldAlert, ShieldCheck, User, Bot, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { useT } from "@/lib/i18n/client";
import { useApiClient } from "@/lib/api-client";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  halalFlag?: string;
  // Engine demo rejimda javob berdi (real Claude emas) — foydalanuvchiga
  // ochiq ko'rsatiladi, pul BFF tomonidan avtomatik qaytariladi.
  demoMode?: boolean;
  timestamp: string;
}

interface ChatInterfaceProps {
  agentId: string;
  agentDefinition: any;
}

export function ChatInterface({ agentId, agentDefinition }: ChatInterfaceProps) {
  const { t } = useT();
  const api = useApiClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Kasb konteksti — halal filter chegara-holatlari uchun
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<{ professionTitle?: string | null; preferredLanguage?: string | null }>("/users/me"),
  });

  // Dashboard tezkor amalidan kelgan ?q= promptni oldindan to'ldirish
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      setInput(q);
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  /** Suhbatni serverga saqlash — birinchi xabarda conversation yaratiladi. */
  const persistExchange = async (userMsg: Message, assistantMsg: Message) => {
    try {
      let convId = conversationId;
      if (!convId) {
        const conv = await api.post<{ id: string }>("/conversations", { agentId });
        convId = conv.id;
        setConversationId(convId);
      }
      await api.post(`/conversations/${convId}/messages/bulk`, {
        messages: [userMsg, assistantMsg],
      });
    } catch {
      // Saqlash xatosi suhbatni to'xtatmasligi kerak
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          message: text,
          conversationId,
          profession: me?.professionTitle ?? "",
          // Xotira: oxirgi 20 xabar kontekst sifatida yuboriladi
          conversationHistory: messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .slice(-20)
            .map((m) => ({ role: m.role, content: m.content })),
          agentDefinition: {
            agent_id: agentDefinition.id,
            name: agentDefinition.name,
            system_prompt: agentDefinition.systemPrompt,
            model: agentDefinition.model ?? "claude-sonnet-5",
            tools: agentDefinition.toolsConfig ?? [],
            halal_filter_enabled: agentDefinition.halalFilterEnabled ?? true,
            memory_enabled: agentDefinition.memoryEnabled ?? true,
            // S3: vertikal compliance pack (engine avtomatik yuklaydi)
            vertical: agentDefinition.vertical ?? null,
            language: me?.preferredLanguage ?? "en",
          },
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Streaming javob kelmadi");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let halalFlag = "ALLOW";
      let demoMode = false;
      let newConvId = conversationId;

      // Bitta SSE `data:` satrini qayta ishlaydi.
      const handleEvent = (event: any) => {
        if (event.type === "token") {
          fullContent += event.content;
          setStreamingContent(fullContent);
        } else if (event.type === "rate_limit") {
          fullContent = `⏳ ${event.message}`;
          halalFlag = "ALLOW";
        } else if (event.type === "insufficient_balance") {
          fullContent = `💳 ${event.message}`;
          halalFlag = "ALLOW";
        } else if (event.type === "error") {
          // Engine yoki BFF xatosi (stream uzildi / to'lov tasdig'i o'tmadi).
          // Bo'sh "pufak" o'rniga xabarni ko'rsatamiz; qisman javob bo'lsa saqlaymiz.
          const note = `⚠️ ${event.message ?? "Xatolik yuz berdi — birozdan keyin urinib ko'ring."}`;
          fullContent = fullContent ? `${fullContent}\n\n${note}` : note;
          setStreamingContent(fullContent);
        } else if (event.type === "halal_block") {
          fullContent = `🚫 ${t("chat.blockedMsg")}\n\n_${event.reason}_`;
          halalFlag = "BLOCK";
        } else if (event.type === "replace") {
          // Chiqish (javob) Halal Filter tomonidan bloklandi — engine to'liq
          // matn o'rniga almashtiruv-xabar yuboradi. Oqimda ko'rsatilgan
          // matn BUTUNLAY almashtiriladi (bloklangan kontent qolmaydi).
          fullContent = `🚫 ${t("chat.blockedMsg")}`;
          halalFlag = "BLOCK";
          setStreamingContent(fullContent);
        } else if (event.type === "disclaimer") {
          // S3: vertikal compliance disclaimeri javob oxiriga ulanadi
          fullContent += `\n\n${event.content}`;
          setStreamingContent(fullContent);
        } else if (event.type === "done") {
          halalFlag = event.halal_flag ?? "ALLOW";
          if (event.demo_mode) demoMode = true;
          if (event.conversation_id) newConvId = event.conversation_id;
        }
      };

      // MUHIM: SSE eventi ikki tarmoq-chunk chegarasida bo'linishi mumkin —
      // shuning uchun to'liq satrlargina qayta ishlanadi, tugallanmagan qoldiq
      // `buffer`da saqlanib keyingi chunk bilan birlashadi (ilgari `chunk.split`
      // to'g'ridan-to'g'ri ishlangani uchun bo'lingan JSON tashlab yuborilardi —
      // token yo'qolishi / done o'tkazib yuborilishi = noto'g'ri refund).
      let buffer = "";
      const drain = (flush = false) => {
        const parts = buffer.split("\n");
        buffer = flush ? "" : parts.pop() ?? "";
        for (const line of parts) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            handleEvent(JSON.parse(raw));
          } catch {
            // yaroqsiz JSON satri — o'tkazib yuborish
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        drain();
      }
      buffer += decoder.decode(); // yakuniy flush (multibayt qoldiq)
      drain(true);

      if (newConvId) setConversationId(newConvId);

      const assistantMsg: Message = {
        role: "assistant",
        content: demoMode ? `${fullContent}\n\n_${t("chat.demoNotice")}_` : fullContent,
        halalFlag,
        demoMode,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      void persistExchange(userMsg, assistantMsg);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "system", content: `Xato: ${err.message}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full rounded-xl border bg-card overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">{agentDefinition.name}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {t("chat.emptyDesc")}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {/* Streaming */}
        {isStreaming && streamingContent && (
          <div className="flex gap-3">
            <div className="rounded-full bg-primary/10 p-2 h-8 w-8 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="rounded-2xl rounded-tl-none bg-secondary px-4 py-3 max-w-[80%]">
              <div className="text-sm prose prose-sm max-w-none">
                <ReactMarkdown>{streamingContent}</ReactMarkdown>
              </div>
              <span className="inline-block h-4 w-0.5 bg-foreground animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="flex gap-3">
            <div className="rounded-full bg-primary/10 p-2 h-8 w-8 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="rounded-2xl rounded-tl-none bg-secondary px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.placeholder")}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 overflow-hidden"
            style={{ minHeight: 44 }}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            aria-label={t("chat.send")}
            className="h-11 w-11 shrink-0"
          >
            {isStreaming ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {t("chat.halalNote")}
        </p>
      </div>
    </div>
  );
}

const TIME_LOCALES: Record<string, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" };

function MessageBubble({ message }: { message: Message }) {
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

        {/* Demo rejim belgisi — real Claude javobi emasligi ochiq ko'rsatiladi */}
        {message.demoMode && !isUser && (
          <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
            <ShieldAlert className="h-3 w-3" />
            {t("chat.demoBadge")}
          </div>
        )}

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
