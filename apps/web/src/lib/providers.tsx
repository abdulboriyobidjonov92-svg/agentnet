"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { LanguageProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/dictionary";
import { Toaster } from "@/components/ui/toast";

export function Providers({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider initialLocale={initialLocale}>
        {children}
        <Toaster />
      </LanguageProvider>
    </QueryClientProvider>
  );
}
