import { notFound } from "next/navigation";

/**
 * `/design-system` — ICHKI ma'lumotnoma, foydalanuvchi yuzasi emas.
 *
 * Prod'da 404: bu sahifa hech qanday maxfiy ma'lumot ko'rsatmaydi, lekin
 * u mahsulot yuzasining bir qismi EMAS — jonli saytda topilishi chalkashlik
 * (va qo'llab-quvvatlash savoli) beradi. Auth ortiga olish o'rniga butunlay
 * yopilgan: dev'da ochiq bo'lishi yetarli.
 */
export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
