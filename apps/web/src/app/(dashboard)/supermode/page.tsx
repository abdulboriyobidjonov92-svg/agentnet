"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// "Super rejim" endi /fusion ichida "Kunlik boshqaruv" rejimi — eski
// bookmark/havolalar shu yerga tushib qolmasligi uchun yo'naltiriladi.
export default function SuperModeRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/fusion");
  }, [router]);
  return null;
}
