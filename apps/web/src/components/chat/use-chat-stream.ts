"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useT } from "@/lib/i18n/client";
import { useApiClient } from "@/lib/api-client";
import type { Message } from "./message-types";

/** Bir agent bilan suhbat: SSE streaming, xotira konteksti, serverga saqlash. */
export function useChatStream(agentId: string, agentDefinition: any) {
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
            model: agentDefinition.model ?? "claude-sonnet-4-6",
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
      let newConvId = conversationId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const event = JSON.parse(raw);
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
            } else if (event.type === "disclaimer") {
              // S3: vertikal compliance disclaimeri javob oxiriga ulanadi
              fullContent += `\n\n${event.content}`;
              setStreamingContent(fullContent);
            } else if (event.type === "done") {
              halalFlag = event.halal_flag ?? "ALLOW";
              if (event.conversation_id) newConvId = event.conversation_id;
            }
          } catch {
            // invalid JSON satri — o'tkazib yuborish
          }
        }
      }

      if (newConvId) setConversationId(newConvId);

      const assistantMsg: Message = {
        role: "assistant",
        content: fullContent,
        halalFlag,
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

  return {
    messages,
    input,
    setInput,
    isStreaming,
    streamingContent,
    bottomRef,
    inputRef,
    sendMessage,
    handleKeyDown,
  };
}
