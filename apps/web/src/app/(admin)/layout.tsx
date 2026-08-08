import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeSession, SESSION_COOKIE } from "@/lib/session";
import { AdminShell } from "@/components/admin/admin-shell";

/**
 * Phase 4 §6.2 — admin route guruhi: ALOHIDA layout, alohida sidebar,
 * doim ko'rinadigan "ADMIN REJIM" indikatori.
 *
 * BU YERDAGI TEKSHIRUV — FAQAT UX-DARVOZA (sessiya bormi). Haqiqiy
 * avtorizatsiya API tomonda: har admin endpointi `@Roles(OWNER, ADMIN,
 * SUPPORT)` + global `RolesGuard` bilan himoyalangan. Edge/layout imzoni
 * tekshira olmaydi (SEC-05 dagi mavjud naqsh, `middleware.ts` bilan bir xil)
 * — shuning uchun bu yerda rolga qarab yashirish XAVFSIZLIK CHORASI EMAS,
 * balki noto'g'ri ekranni ko'rsatmaslik uchun.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const session = decodeSession(store.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/sign-in");

  return (
    <AdminShell email={session.email} name={session.name}>
      {children}
    </AdminShell>
  );
}
