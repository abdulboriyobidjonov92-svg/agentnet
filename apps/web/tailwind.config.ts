import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Uch rol, uch oila — `layout.tsx` ga qarang.
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // Yuza qatlamlari (elevation) — chuqurlik glow bilan emas, qatlamlar bilan
        surface: {
          1: "hsl(var(--surface-1))",
          2: "hsl(var(--surface-2))",
          3: "hsl(var(--surface-3))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        // Yagona imzo urg'usi — faqat ingichka chiziq (Filament) sifatida ishlatiladi
        line: "hsl(var(--accent-line))",
        // Bioluminessent venalar — Liquid Obsidian imzo juftligi
        vein: {
          cyan: "hsl(var(--vein-cyan))",
          violet: "hsl(var(--vein-violet))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // Asosiy amal rangi — Violet Signal (`cta` to'ldirish, `cta-strong` qirra)
        cta: {
          DEFAULT: "hsl(var(--cta))",
          strong: "hsl(var(--cta-strong))",
        },
        // Eskirgan: gold endi neytral urg'u (lingering markup buzilmasin)
        gold: {
          DEFAULT: "hsl(var(--accent-gold))",
          foreground: "hsl(var(--accent-gold-foreground))",
        },
        ok: "hsl(var(--ok))",
        warn: "hsl(var(--warn))",
        danger: "hsl(var(--danger))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        xl: "calc(var(--radius) + 6px)",
        "2xl": "calc(var(--radius) + 12px)",
      },
      // Qat'iy 4px shkala (ad-hoc qiymatlar o'rniga)
      spacing: {
        "4.5": "1.125rem",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
