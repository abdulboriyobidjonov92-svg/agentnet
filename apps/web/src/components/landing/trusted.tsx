/**
 * TRUSTED BY — hamkorlar qatori.
 *
 * ⚠️ HAQIQIY LOGOTIP YO'Q va ATAYLAB QO'YILMAYDI. Google/Amazon kabi
 * belgilarni qo'yish — mavjud bo'lmagan hamkorlikni ko'rsatish demak.
 * Shuning uchun bu yerda neytral, nomsiz belgilar turadi: qator
 * kompozitsiyani ushlab turadi, lekin hech kimga tegishli emas.
 * Haqiqiy mijoz paydo bo'lganda ular shu joyni egallaydi.
 */
export function Trusted({ t }: { t: (key: string) => string }) {
  return (
    <div className="border-b border-white/[0.06]">
      <div className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8 sm:py-12">
        <p className="text-center font-mono text-[0.625rem] uppercase tracking-[0.28em] text-white/35">
          {t("trust.label")}
        </p>

        <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="flex items-center gap-2.5 opacity-45">
              {/* Neytral belgi — oltiburchak, ichida bo'sh doira */}
              <svg width="22" height="24" viewBox="0 0 22 24" aria-hidden>
                <path
                  d="M11 1 20.5 6.5v11L11 23 1.5 17.5v-11z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  className="text-white/70"
                />
                <circle cx="11" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.1" className="text-white/50" />
              </svg>
              <span className="font-display text-[0.9375rem] font-medium tracking-tight text-white/70">
                {t(`trust.p${i + 1}`)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
