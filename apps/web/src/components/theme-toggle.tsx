"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("agentnet_theme", next ? "dark" : "light");
    } catch {}
  };

  return (
    <button
      onClick={toggle}
      aria-label="Theme"
      className={
        variant === "dark"
          ? "flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 text-white/90 transition hover:bg-white/10"
          : "flex h-9 w-9 items-center justify-center rounded-xl border bg-card transition hover:bg-muted"
      }
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
