import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decodeSession, IMPERSONATION_TOKEN_COOKIE, SESSION_COOKIE } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const session = decodeSession(store.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/sign-in");

  // SEC-12 §18 — banner AYNAN shu yerda: impersonation dashboard yuzasida
  // kechadi, ya'ni operator ko'radigan HAR BIR sahifada u ko'rinadi.
  // Banner o'zi cookie'ni klientda o'qiydi (jonli sanoq uchun); bu bayroq
  // faqat SSR'da uni umuman render qilish/qilmaslikni hal qiladi.
  const impersonating = !!store.get(IMPERSONATION_TOKEN_COOKIE)?.value;

  // Qobiq balandligini SHU YERDA boshqaramiz: banner qo'shilganda `h-screen`
  // qobiq oynadan 58px oshib ketardi (sahifa siljib, pastki mobil navigatsiya
  // ekrandan chiqib ketardi). Flex-ustun: banner o'z balandligini oladi,
  // qobiq QOLGANINI. Banner yo'q bo'lsa qobiq baribir to'liq oynani egallaydi
  // — ya'ni impersonationSIZ ko'rinish O'ZGARMAYDI.
  return (
    <div className="flex h-screen flex-col">
      {impersonating && <ImpersonationBanner />}
      <div className="min-h-0 flex-1">
        <DashboardShell email={session.email} name={session.name}>
          {children}
        </DashboardShell>
      </div>
    </div>
  );
}
