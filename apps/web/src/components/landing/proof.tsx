/**
 * RAQAMLAR — hammasi TEKSHIRILADIGAN.
 *
 * ⚠️ Referens shablon bu joyga "90% / 75% / 86%" qo'yadi va ular hech
 * narsani anglatmaydi. Bu sahifadan "1200+ agent · 99.9% uptime" bandi
 * aynan shu sababdan olib tashlangan edi; uni boshqa shaklda qaytarish
 * o'sha qarorni bekor qilardi.
 *
 * Shuning uchun bu yerdagi to'rt raqamning har biri kodda sanaladi:
 *   17 — `apps/api/src/connectors/connectors/` dagi fayllar soni
 *    6 — orbitadagi imkoniyatlar (bir xil ro'yxat, bir xil manba)
 *    8 — policy dvigatelining qaror o'lchovlari (SAFETY_POLICY_LAYER §2)
 *    0 — tasdiqsiz bajarilgan xavfli amal: policy darvozasi HIGH+ ni
 *        to'xtatadi, ya'ni bu raqam dizayn bo'yicha nol.
 * Oxirgisi eng kuchli, chunki u va'da emas — mexanizmning natijasi.
 */

const STATS = ["connectors", "capabilities", "signals", "unapproved"] as const;
const VALUES: Record<(typeof STATS)[number], string> = {
  connectors: "17",
  capabilities: "6",
  signals: "8",
  unapproved: "0",
};

export function Proof({ t }: { t: (key: string) => string }) {
  return (
    <div className="border-b border-white/[0.06] bg-[hsl(228_60%_7%/0.5)]">
      <div className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_2fr] lg:items-center lg:gap-16">
          <h2 className="font-display text-[clamp(1.5rem,2.8vw,2rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-white">
            {t("proof.title")}
          </h2>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s}>
                <dt className="sr-only">{t(`proof.${s}`)}</dt>
                <dd>
                  <p className="font-display text-[clamp(2rem,4vw,2.75rem)] font-semibold leading-none tracking-[-0.04em] text-[hsl(220_100%_82%)]">
                    {VALUES[s]}
                  </p>
                  <p className="mt-2.5 text-[0.8125rem] leading-snug text-white/50">
                    {t(`proof.${s}`)}
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
