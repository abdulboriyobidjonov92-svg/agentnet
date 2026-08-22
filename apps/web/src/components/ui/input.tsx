import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Yagona input primitivi. Fokus stili globals.css'dagi Filament
 * (focus-visible border + 1px hairline) orqali — lokal ring yo'q.
 *
 * UI-1: to'rt holat — default · focus · **error** · disabled.
 * `error` holati ilgari yo'q edi: har forma o'zicha qizil border
 * yopishtirardi va xato matni turli joyda turardi.
 */

/** Xato holatining yagona ko'rinishi — ikkala primitiv ham shundan oladi. */
const errorRing =
  "border-destructive/70 focus-visible:!border-destructive focus-visible:!shadow-[0_0_0_1px_hsl(var(--destructive)/0.55)]";

interface FieldProps {
  /**
   * Xato bo'lsa `true` yoki xato MATNI. Matn berilsa u maydon ostida
   * ko'rsatiladi va `aria-describedby` bilan bog'lanadi — screen-reader
   * xatoni maydon bilan birga o'qiydi.
   */
  error?: boolean | string;
}

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & FieldProps
>(({ className, error, id, ...props }, ref) => {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const message = typeof error === "string" ? error : null;
  const errorId = message ? `${fieldId}-error` : undefined;

  return (
    <>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          "flex h-11 w-full rounded-xl border bg-background px-4 text-sm outline-none transition placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          error && errorRing,
          className,
        )}
        {...props}
      />
      {message && (
        <p id={errorId} className="mt-1.5 text-xs text-destructive">
          {message}
        </p>
      )}
    </>
  );
});
Input.displayName = "Input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps
>(({ className, error, id, ...props }, ref) => {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const message = typeof error === "string" ? error : null;
  const errorId = message ? `${fieldId}-error` : undefined;

  return (
    <>
      <textarea
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          "flex w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          error && errorRing,
          className,
        )}
        {...props}
      />
      {message && (
        <p id={errorId} className="mt-1.5 text-xs text-destructive">
          {message}
        </p>
      )}
    </>
  );
});
Textarea.displayName = "Textarea";

export { Input, Textarea };
