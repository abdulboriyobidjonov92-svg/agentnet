"use client";
import { useState } from "react";
import { ShieldCheck, ChevronDown, ChevronUp, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { ROLE_ICON, ROLE_COLOR, type Dept } from "./agentos-utils";

export function DeptCard({ dept }: { dept: Dept }) {
  const [open, setOpen] = useState(true);
  const Icon = ROLE_ICON[dept.role] ?? Cpu;
  return (
    <div className={cn("rounded-2xl border bg-card/60 p-4 backdrop-blur", ROLE_COLOR[dept.role])}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2">
        <Icon className="h-5 w-5" />
        <span className="flex-1 text-left">
          <span className="block text-sm font-bold">{dept.label}</span>
          <span className="block text-xs text-muted-foreground">{dept.title}</span>
        </span>
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
            dept.ethics.verdict === "APPROVE" && "bg-primary/15 text-primary",
            dept.ethics.verdict === "CAUTION" && "bg-gold/15 text-gold",
            dept.ethics.verdict === "REJECT" && "bg-destructive/15 text-destructive",
          )}
        >
          <ShieldCheck className="h-3 w-3" /> {dept.ethics.verdict}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="prose prose-sm mt-3 max-w-none border-t border-white/5 pt-3 text-xs dark:prose-invert">
          <ReactMarkdown>{dept.output}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
