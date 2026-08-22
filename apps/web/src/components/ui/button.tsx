import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Yagona tugma primitivi — Obsidian v3 tokenlari asosida.
 * Padding suzishi (py-2.5/3/3.5) o'rniga qat'iy sm/md/lg shkala.
 * Fokus halqasi globals.css'dagi Filament tizimidan keladi (lokal ring yo'q).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-soft hover:brightness-110",
        outline: "border bg-card shadow-soft hover:bg-muted",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        subtle: "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
        destructive: "bg-destructive text-destructive-foreground shadow-soft hover:brightness-110",
        "destructive-ghost": "text-destructive hover:bg-destructive/10",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-5 text-base",
        icon: "h-10 w-10 hit-target",
        "icon-sm": "h-9 w-9 hit-target",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Kutish holati (UI-1: tugmaning beshinchi holati).
   *
   * NEGA TUGMA ICHIDA: ilgari har ekran o'zicha `disabled={saving}` +
   * matnni "Saqlanmoqda..." ga almashtirar edi — natijada har joyda
   * boshqacha ko'rinardi va tugma ENI SAKRARDI. Bu yerda matn JOYIDA
   * qoladi (faqat ko'rinmas bo'ladi), spinner ustiga chiziladi —
   * layout siljimaydi.
   */
  loading?: boolean;
}

/** Bitta spinner — barcha kutish holatlari uchun (SVG, qo'shimcha kutubxonasiz). */
function Spinner() {
  return (
    <svg
      className="absolute h-4 w-4 animate-spin"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    // `asChild` da bola YAGONA element bo'lishi shart (Radix Slot talabi) —
    // shuning uchun spinner qatlami faqat oddiy tugmada qo'shiladi.
    if (asChild) {
      return (
        <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
          {children}
        </Comp>
      );
    }
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), loading && "relative", className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Spinner />}
        {/* Matn o'chirilmaydi — yashiriladi. Tugma eni o'zgarmaydi. */}
        <span className={cn("contents", loading && "invisible")}>{children}</span>
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
