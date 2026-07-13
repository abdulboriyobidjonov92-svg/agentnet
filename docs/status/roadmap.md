# AgentNet — "Wow" imkoniyatlar backlog'i (Part 2+)

**Sana:** 2026-07-03 (Part 1B yangilandi)
**Holat:** Part 1'da beshta flagman imkoniyat qurildi (Life Twin, Autonomous
Goals, Agent Fusion, Ethical Decision Engine, Knowledge Sync + Super Mode).
Part 1B'da qurildi: brauzer-avtomatlashtirish (Tier 1), Connector SDK (17),
Vertical Compliance Packs, Retail Intelligence, Business Operations,
Cross-Border Trade, GovTech, Marketplace bozor mexanikasi.
Quyidagilar keyingi bosqichlar uchun ustuvorlik tartibida saqlanadi.
Har birida texnik feasibility izohi bor.

---

## Tier 2: Native OS/qurilma boshqaruvi (Universal App Control davomi)

**Part 1B'da ATAYLAB qurilmadi** — bu backend-kod bilan soxtalab bo'lmaydigan
alohida muhandislik muammosi. Tier 1 (brauzer-avtomatlashtirish, Playwright)
qurildi va ishlayapti; u real biznes-vositalarning katta qismini qoplaydi
(CRM, davlat portallari, bank web-kabinetlari, e-commerce back-office).

**Native Tier 2 uchun nima kerak (halol texnik yo'l):**

1. **Desktop companion-ilova** (Windows/macOS):
   - Tauri yoki Electron shell + lokal agent-daemon
   - OS ruxsatlari: macOS'da Accessibility + Screen Recording (TCC prompt),
     Windows'da UIAutomation API — foydalanuvchi qo'lda beradi
   - Ekran-skrinshot → vision model → element topish → OS-darajali klik/klaviatura
     (Claude Computer Use'dagi kabi)
   - AgentNet serveriga xavfsiz WebSocket kanal (mutual TLS + qurilma tokeni)
2. **Mobil companion** (Android birinchi):
   - AccessibilityService API (Google Play siyosati bo'yicha alohida ko'rib chiqiladi
     — reject xavfi bor, ehtimol sideload/enterprise-kanal)
   - iOS'da tizim ekvivalenti YO'Q — faqat Shortcuts/App Intents darajasi realistik
3. **Xavfsizlik modeli:** har amal oldin Ethics Engine + amal-jurnal (screenshot proof),
   to'lov/o'chirish amallariga majburiy inson tasdig'i
4. **Risk/baholash:** desktop MVP ~4-6 hafta (1 muhandis, Tauri + Windows UIA),
   Android ~4 hafta + Play siyosati noaniqligi; vision-loop sifati uchun
   ANTHROPIC_API_KEY shart. Server-tomoni tayyor: AutomationRun modeli va
   planner endpointlari (Tier 1) qayta ishlatiladi — companion faqat yangi
   "bridge" bo'ladi.

---

## 1-daraja: mavjud poydevor ustida tez quriladi

### 1. Predictive Future Simulation (ko'p-ssenariyli)
Life Twin'ning bitta-prognoz what-if'idan farqli: bir qarorning 3-5 ta parallel
ssenariysi (optimistik/bazaviy/pessimistik + Monte-Carlo uslubidagi diapazon).
**Feasibility:** Life Twin fakt-bazasi va whatif engine allaqachon bor — bu
`life_twin.py`ga ko'p-ssenariy rejimi qo'shish + solishtirma UI. LLM kaliti
bilan sifat keskin oshadi. Tashqi qaramlik yo'q. ~1 hafta.

### 2. Agent Cloning
Foydalanuvchi mavjud agentini (prompt + tool + xotira konfiguratsiyasi bilan)
nusxalab, ozgina o'zgartirib yangi agent qiladi; marketplace'ga ham ulanadi.
**Feasibility:** Agent modeli allaqachon JSON konfiguratsiya — clone = DB copy
+ UI tugmasi. Xotira ko'chirish uchun TwinFact/Conversation bog'lash siyosati
kerak (maxfiylik: xotira default ko'chmasin). ~2-3 kun.

### 3. Collaborative Multi-User Agents (oila/kompaniya/idora)
Bitta agent bir nechta foydalanuvchiga xizmat qiladi (oila byudjeti, bo'lim
hisoboti); Org modeli allaqachon sxemada bor.
**Feasibility:** Org→Agent bog'lanish mavjud, kerakli ish: a'zolik roli bo'yicha
ruxsatlar (RBAC guard bor), umumiy conversation/twin-fakt scope'i, taklif oqimi.
Clerk organizations yoki lokal org-invite kerak. ~1-2 hafta.

### 4. Emotional & Mental Health Co-Pilot
Ruhiy holat kuzatuvi (kayfiyat jurnali → TwinFact), xavf belgilarida
mutaxassisga yo'naltirish. Mavjud "Ruhiy salomatlik" builtin agentining chuqur versiyasi.
**Feasibility:** Texnik qism oson (twin + maxsus agent + safety promptlar);
asosiy ish — klinik xavfsizlik protokoli (inqiroz resurslari ro'yxati,
eskalatsiya qoidalari) va huquqiy disclaimer'lar. LLM kaliti deyarli shart. ~1 hafta + ekspert ko'rigi.

### 5. Crisis & Emergency Mode
Favqulodda holatda (sog'liq, xavfsizlik, moliyaviy inqiroz) platforma maxsus
rejimga o'tadi: tezkor ma'lumot, kontaktlar, hujjatlar, yaqinlarga xabar.
**Feasibility:** Knowledge Sync + Telegram xabar + Twin kontaktlari bilan
quriladi. Ishonchlilik talabi yuqori (offline fallback shart — bor). Haqiqiy
qo'ng'iroq/SMS uchun Twilio yoki mahalliy SMS-gateway kerak. ~1 hafta.

## 2-daraja: tashqi API/qurilma talab qiladi

### 6. Voice + Vision + Action multimodal
Ovozli suhbat, kamera orqali do'kon/inventar tanish, video-qo'ng'iroqda yordam.
**Feasibility:** Ovoz: Web Speech API (bepul, brauzerda) + Claude; ko'rish:
Claude Vision (API kaliti shart) yoki YOLOv11 lokal (GPU tavsiya). RTSP/ONVIF
kamera oqimi uchun alohida CV mikroservis (strategiya hujjatida loyihalangan).
Video-call assist eng og'ir qism (WebRTC + real-time STT). Bosqichlab: ovoz (3 kun) →
foto-tahlil (3 kun) → kamera oqimi (2-3 hafta) → video-call (keyinroq).

### 7. Anonymous Expert Network
Foydalanuvchi murakkab savolini anonim tarzda haqiqiy mutaxassislar tarmog'iga
yuboradi; agent javoblarni jamlaydi.
**Feasibility:** Bu marketplace'ning odam-ekspert kengaytmasi: ekspert onboarding,
reputatsiya, to'lov (Payme/Stripe), anonimlashtirish qatlami. Texnik emas,
operatsion qiyinchilik — ekspertlar bazasini yig'ish. To'lov integratsiyasidan keyin. ~3-4 hafta.

### 8. Multi-Device Swarm
Bir foydalanuvchining agentlari telefon/kompyuter/planshetda sinxron ishlaydi,
vazifalarni qurilmalar bo'ylab davom ettiradi.
**Feasibility:** Hozirgi arxitektura server-markazli — sinxronlik allaqachon bor
(DB). "Swarm" hissi uchun: push (FCM), Expo mobil ilova (strategiyada bor),
real-time WebSocket holat kanali. Mobil ilova qurilishiga bog'liq. ~3-4 hafta mobil bilan birga.

### 9. AR Mode
Kamera orqali real dunyoga agent-ma'lumot qatlami (do'konda mahsulot ustiga
narx/tahlil, dalada ekin holati).
**Feasibility:** WebXR (brauzer, cheklangan iOS) yoki native ARKit/ARCore (Expo
EAS build). Vision API + geolokatsiya kerak. Katta UX ishi, alohida mobil
bosqichdan keyin. 4+ hafta, past ustuvorlik.

## 3-daraja: strategik / ekotizim

### 10. National Impact Mode (mahalla/tuman raqamlashtirish)
Davlat idoralari uchun paket: mahalla so'rovlari, hujjat oqimi, xizmat
tezlashtirish shablonlari — "digitize" goal-template'ning to'liq mahsulot versiyasi.
**Feasibility:** Goal engine'da digitize shabloni allaqachon bor. Haqiqiy versiya
uchun: davlat tizimlari bilan integratsiya (my.gov.uz API mavjudligi tekshirilsin),
compliance (shaxsiy ma'lumotlar qonuni — biometrik faqat lokal), pilot idora
hamkorligi. Texnikadan ko'ra BD ishi. Pilot bilan 4-6 hafta.

### 11. Creator Economy 2.0
Foydalanuvchi o'z ekspertizasini agentga o'rgatadi; agent kurs/kontent/maslahat
sotib, egasiga daromad keltiradi.
**Feasibility:** Marketplace + royalty sxemasi strategiyada bor. Kerak: "agent
training" oqimi (fayl/suhbat → agent bilim bazasi, RAG uchun pgvector),
to'lov split (Stripe Connect / Payme). Postgres+pgvector migratsiyasidan keyin. ~3 hafta.

### 12. Anonymous Community Intelligence
Maxfiylikni saqlagan holda agent sozlamalari/naqshlarini jamoaviy o'rganish
("sizga o'xshash fermerlar bu agentni ishlatadi").
**Feasibility:** Differential-privacy darajasidagi agregatsiya shart emas
boshida — anonim usage-statistika (domain×agent-turi) yetadi. Foydalanuvchi
soni kamida bir necha mingga yetganda ma'noli. Keyinga. ~1 hafta texnik, lekin data kerak.

### 13. Legacy & Knowledge Transfer / Memory Inheritance
Inson bilimi/xotirasini avlodga o'tkazish: ota-onaning hikoyalari, ustaning
hunar sirlari agent sifatida saqlanadi va meros qilinadi.
**Feasibility:** Texnik: TwinFact + suhbat arxivi + RAG — o'rta murakkablik.
Asosiy masalalar axloqiy-huquqiy: vafotdan keyin egalik, rozilik.
Ehtiyotkor dizayn talab qiladi. Texnik 2 hafta + huquq ko'rigi.

---

## Ustuvorlik xulosasi (tavsiya etilgan tartib)

| # | Imkoniyat | Bosqich | Bloklovchi |
|---|---|---|---|
| 1 | Predictive Future Simulation | Part 2 | yo'q (LLM kaliti sifat uchun) |
| 2 | Agent Cloning | Part 2 | yo'q |
| 3 | Collaborative Multi-User Agents | Part 2 | org-invite oqimi |
| 4 | Mental Health Co-Pilot | Part 2/3 | klinik protokol ko'rigi |
| 5 | Crisis Mode | Part 3 | SMS-gateway |
| 6 | Voice+Vision (bosqichli) | Part 3 | ANTHROPIC_API_KEY, keyin GPU/kamera |
| 7 | Creator Economy 2.0 | Part 3 | Postgres+pgvector, to'lov |
| 8 | National Impact Mode | Part 3 | davlat hamkorligi |
| 9 | Anonymous Expert Network | Part 3+ | ekspert bazasi, to'lov |
| 10 | Multi-Device Swarm | mobil bilan | Expo ilova |
| 11 | Memory Inheritance / Legacy | Part 3+ | fiqh/huquq ko'rigi |
| 12 | Community Intelligence | scale'da | foydalanuvchi soni |
| 13 | AR Mode | eng oxiri | mobil + vision |
