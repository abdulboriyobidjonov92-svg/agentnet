"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataList, DataRow } from "@/components/ui/data-row";
import { RISK_TIERS, RUN_STATES, RiskBadge, StateBadge, StatusDot } from "@/components/ui/status";
import { toast } from "@/components/ui/toast";

/**
 * UI-1 — dizayn tizimi ma'lumotnomasi (ICHKI, faqat dev).
 *
 * MAQSAD: yangi P0 ekrani qurayotgan kishi komponent holatini SHU YERDAN
 * ko'chiradi — har ekranda yangidan o'ylamaydi. Storybook ATAYLAB
 * qo'shilmadi (blueprint UI-1 §3): yana bitta build zanjiri va bog'liqlik
 * solo founder uchun foyda bermaydi; bitta sahifa yetarli.
 *
 * ⚠️ Bu sahifa i18n QILINMAYDI — u foydalanuvchi yuzasi emas, ichki
 * ma'lumotnoma. Uchta lokalga texnik atamalarni ko'chirish o'lik kalit
 * yaratardi (CLAUDE.md parity qoidasi).
 */

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-border pt-8">
      <div className="space-y-1">
        <h2 className="type-h2">{title}</h2>
        {note && <p className="max-w-2xl text-sm text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="label-mono w-28 shrink-0">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export default function DesignSystemPage() {
  const [loading, setLoading] = React.useState(false);

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <header className="space-y-2">
        <p className="label-mono">AgentNet · UI-1</p>
        <h1 className="type-display">Liquid Obsidian</h1>
        <p className="max-w-2xl text-muted-foreground">
          Dizayn tizimi ma&apos;lumotnomasi. Har komponent barcha holatlari bilan — yangi ekran
          qurganda holat shu yerdan ko&apos;chiriladi, qaytadan o&apos;ylanmaydi.
        </p>
      </header>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="1 · Tugma"
        note="Besh holat. Kutish holatida matn JOYIDA qoladi (ko'rinmas bo'ladi) — tugma eni sakramaydi."
      >
        <Row label="variant">
          <Button>Saqlash</Button>
          <Button variant="outline">Bekor qilish</Button>
          <Button variant="ghost">Ko&apos;proq</Button>
          <Button variant="subtle">Ulash</Button>
          <Button variant="destructive">O&apos;chirish</Button>
        </Row>
        <Row label="size">
          <Button size="sm">Kichik</Button>
          <Button size="md">O&apos;rta</Button>
          <Button size="lg">Katta</Button>
        </Row>
        <Row label="holat">
          <Button>Odatiy</Button>
          <Button disabled>O&apos;chirilgan</Button>
          <Button loading>Saqlanmoqda</Button>
          <Button variant="destructive" loading>
            O&apos;chirilmoqda
          </Button>
        </Row>
        <Row label="jonli">
          <Button
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1600);
            }}
          >
            Bosib ko&apos;ring
          </Button>
        </Row>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="2 · Maydon"
        note="To'rt holat. Xato matni maydonga aria-describedby bilan bog'lanadi — screen-reader uni birga o'qiydi."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-mono mb-2 block">odatiy</label>
            <Input placeholder="agent nomi" />
          </div>
          <div>
            <label className="label-mono mb-2 block">to&apos;ldirilgan</label>
            <Input defaultValue="Do&apos;kon hisobotchisi" />
          </div>
          <div>
            <label className="label-mono mb-2 block">xato</label>
            <Input defaultValue="a" error="Nom kamida 2 belgidan iborat bo'lishi kerak" />
          </div>
          <div>
            <label className="label-mono mb-2 block">o&apos;chirilgan</label>
            <Input disabled defaultValue="o'zgartirib bo'lmaydi" />
          </div>
          <div className="sm:col-span-2">
            <label className="label-mono mb-2 block">textarea · xato</label>
            <Textarea rows={3} placeholder="Vazifa tavsifi" error />
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="3 · Kartochka"
        note="Uch material: oddiy karta (surface), liquid-glass (suzuvchi qatlam), vein-edge (tirik element)."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Oddiy</CardTitle>
              <CardDescription>Ro&apos;yxat va forma konteynerlari</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">bg-card + border</CardContent>
          </Card>
          <Card className="liquid-glass">
            <CardHeader>
              <CardTitle>Liquid glass</CardTitle>
              <CardDescription>Ustki qatlam, modal, panel</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">blur(40px)</CardContent>
          </Card>
          <Card className="vein-edge">
            <CardHeader>
              <CardTitle>Vein edge</CardTitle>
              <CardDescription>Tirik/faol element</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">ichki cyan qirra</CardContent>
          </Card>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="4 · Ro'yxat qatori"
        note="Bosiladigan qator klaviatura bilan ham ishlaydi (Tab + Enter). Uzun nom truncate bo'ladi — o'ngdagi metama'lumot ekrandan chiqmaydi."
      >
        <DataList>
          <DataRow
            leading={<StatusDot state="running" />}
            trailing={<span className="nums">12s</span>}
            description="Uzum Market narxlarini tekshirmoqda"
            onSelect={() => toast({ title: "Qator tanlandi" })}
          >
            Narx kuzatuvchi
          </DataRow>
          <DataRow
            leading={<StatusDot state="waiting" />}
            trailing={<RiskBadge tier="high" label="HIGH" />}
            description="3 ta mijozga SMS yuborishni so'ramoqda"
            onSelect={() => toast({ title: "Qator tanlandi" })}
          >
            Buyurtma xabarnomasi
          </DataRow>
          <DataRow
            leading={<StatusDot state="success" />}
            trailing={<span className="nums">1.2s</span>}
            description="Hisobot tayyorlandi"
            selected
          >
            Kunlik hisobot
          </DataRow>
          <DataRow
            leading={<StatusDot state="blocked" />}
            trailing={<RiskBadge tier="critical" showLabel={false} />}
            description="evil.com ruxsat etilmagan — SEC-07"
          >
            Brauzer agenti
          </DataRow>
          <DataRow
            leading={<StatusDot state="failed" />}
            description="Telegram javob bermadi (timeout)"
          >
            Bu nomi juda uzun agent bo&apos;lib, u albatta qatorni cho&apos;zishga urinadi va
            truncate ishlayotganini ko&apos;rsatadi
          </DataRow>
        </DataList>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="5 · Risk tier"
        note="Rang emas — TIRIKLIK darajasi. LOW tekis, MEDIUM qirrali, HIGH porlaydi, CRITICAL 60bpm da uradi. Har tier o'z shakli bilan ham ajraladi (rang yakka o'zi signal emas)."
      >
        <Row label="badge">
          {RISK_TIERS.map((tier) => (
            <RiskBadge key={tier} tier={tier} />
          ))}
        </Row>
        <Row label="matnsiz">
          {RISK_TIERS.map((tier) => (
            <RiskBadge key={tier} tier={tier} showLabel={false} />
          ))}
        </Row>
        <div className="grid gap-3 sm:grid-cols-4">
          {RISK_TIERS.map((tier) => (
            <div key={tier} data-risk={tier} className="risk-edge rounded-xl border p-4">
              <p className="label-mono">{tier}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tier === "low" && "o'qish, narx tekshirish"}
                {tier === "medium" && "qoralama, ichki yozuv"}
                {tier === "high" && "SMS, forma topshirish"}
                {tier === "critical" && "pul, davlat hujjati"}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="6 · Ijro holati"
        note="Faqat ikki holat harakatlanadi — running (nafas oladi) va waiting (sizdan javob kutmoqda). Tugagan holatlar ataylab qotib turadi."
      >
        <Row label="badge">
          {RUN_STATES.map((state) => (
            <StateBadge key={state} state={state} />
          ))}
        </Row>
        <Row label="nuqta">
          {RUN_STATES.map((state) => (
            <span key={state} className="flex items-center gap-2 text-xs text-muted-foreground">
              <StatusDot state={state} />
              {state}
            </span>
          ))}
        </Row>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="7 · Toast" note="Bildirishnoma root layoutdagi <Toaster /> orqali chiqadi.">
        <Row label="turlar">
          <Button
            variant="outline"
            onClick={() => toast({ title: "Saqlandi", description: "Agent sozlamalari yangilandi" })}
          >
            Muvaffaqiyat
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast({
                title: "Yuborilmadi",
                description: "Telegram javob bermadi. Qayta urinib ko'ring.",
                variant: "destructive",
              })
            }
          >
            Xato
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast({
                title: "Konnektor uzildi",
                description: "Bekor qilish uchun 5 soniya bor",
                action: { label: "Qaytarish", onClick: () => toast({ title: "Qaytarildi" }) },
              })
            }
          >
            Amal bilan
          </Button>
        </Row>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="8 · Tipografika"
        note="Bitta oila (Geist). Raqamlar har doim .nums — tabular figures bilan, aks holda jadvalda ustunlar sakraydi."
      >
        <div className="space-y-3">
          <p className="type-display">Display · 3.5rem</p>
          <p className="type-h1">H1 · sarlavha</p>
          <p className="type-h2">H2 · bo&apos;lim</p>
          <p className="type-body">Body · asosiy matn, 1rem / 1.6</p>
          <p className="type-caption text-muted-foreground">Caption · 0.75rem</p>
          <p className="label-mono">Label mono · 0.6875rem</p>
          <p className="nums text-lg">1 234 567 so&apos;m · 00:12.480</p>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        title="9 · Ritm"
        note="4px asos. Ruxsat etilgan qadamlar: 1 · 2 · 3 · 4 · 6 · 8 · 12 (Tailwind birliklari). Oraliq qiymatlar (p-5, gap-7) yangi ekranlarda ishlatilmaydi."
      >
        <div className="flex flex-wrap items-end gap-4">
          {[1, 2, 3, 4, 6, 8, 12].map((step) => (
            <div key={step} className="text-center">
              <div
                className="mx-auto bg-vein-cyan/30"
                style={{ width: step * 4, height: step * 4 }}
              />
              <p className="label-mono mt-2">{step}</p>
              <p className="text-[10px] text-muted-foreground">{step * 4}px</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section title="10 · Rang tokenlari" note="Komponentda hex/hsl yozilmaydi — faqat token.">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["--risk-low", "risk"],
            ["--risk-medium", "risk"],
            ["--risk-high", "risk"],
            ["--risk-critical", "risk"],
            ["--state-running", "state"],
            ["--state-waiting", "state"],
            ["--state-blocked", "state"],
            ["--state-success", "state"],
            ["--state-failed", "state"],
            ["--state-cancelled", "state"],
            ["--vein-cyan", "imzo"],
            ["--vein-violet", "imzo"],
          ].map(([token, group]) => (
            <div key={token} className="flex items-center gap-3 rounded-xl border p-3">
              <span
                className="h-6 w-6 shrink-0 rounded-md"
                style={{ background: `hsl(var(${token}))` }}
              />
              <span className="min-w-0">
                <span className="block truncate font-mono text-xs">{token}</span>
                <span className="text-[10px] text-muted-foreground">{group}</span>
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="11 · Badge (mavjud)" note="Umumiy yorliqlar — risk/holat uchun EMAS.">
        <Row label="variant">
          <Badge>default</Badge>
          <Badge variant="primary">primary</Badge>
          <Badge variant="outline">outline</Badge>
          <Badge variant="ok">ok</Badge>
          <Badge variant="warn">warn</Badge>
          <Badge variant="danger">danger</Badge>
        </Row>
      </Section>
    </main>
  );
}
