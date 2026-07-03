"use client";
import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { create } from "zustand";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Toast tizimi — zustand store + Radix Toast.
 * toast({...}) istalgan joydan chaqiriladi; undo'li destruktiv amallar uchun
 * action tugmasi bilan. <Toaster /> root layoutda bir marta o'rnatiladi.
 */

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  /** Undo kabi amal tugmasi */
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (t: Omit<ToastItem, "id">) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (t) => {
    const id = Math.random().toString(36).slice(2, 9);
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(t: Omit<ToastItem, "id">) {
  return useToastStore.getState().add(t);
}

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          duration={t.duration ?? 5000}
          onOpenChange={(open) => !open && dismiss(t.id)}
          className={cn(
            "flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-lift animate-in-up",
            t.variant === "destructive" && "border-destructive/30",
          )}
        >
          <div className="min-w-0 flex-1">
            {t.title && (
              <ToastPrimitive.Title
                className={cn("text-sm font-semibold", t.variant === "destructive" && "text-destructive")}
              >
                {t.title}
              </ToastPrimitive.Title>
            )}
            {t.description && (
              <ToastPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">
                {t.description}
              </ToastPrimitive.Description>
            )}
          </div>
          {t.action && (
            <ToastPrimitive.Action altText={t.action.label} asChild>
              <Button variant="outline" size="sm" onClick={t.action.onClick}>
                {t.action.label}
              </Button>
            </ToastPrimitive.Action>
          )}
          <ToastPrimitive.Close
            aria-label="Close"
            className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  );
}
