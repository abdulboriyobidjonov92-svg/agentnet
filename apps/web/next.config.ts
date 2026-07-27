import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Eslatma: web `@agentnet/shared-types` ni import qilmaydi (0 ta import), shu
  // sabab ilgari bu yerda turgan `transpilePackages` olib tashlandi — Vercel'da
  // Root Directory = apps/web bo'lganda izolyatsiyalangan build node_modules'ida
  // bu workspace paketi bo'lmaydi, keraksiz resolyutsiyani chetlab o'tamiz.
  serverExternalPackages: [],
};

export default nextConfig;
