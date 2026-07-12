"use client";
import { Send, Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { useT } from "@/lib/i18n/client";
import { MessageBubble } from "./message-bubble";
import { useChatStream } from "./use-chat-stream";

interface ChatInterfaceProps {
  agentId: string;
  agentDefinition: any;
}

export function ChatInterface({ agentId, agentDefinition }: ChatInterfaceProps) {
  const { t } = useT();
  const {
    messages,
    input,
    setInput,
    isStreaming,
    streamingContent,
    bottomRef,
    inputRef,
    sendMessage,
    handleKeyDown,
  } = useChatStream(agentId, agentDefinition);

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
