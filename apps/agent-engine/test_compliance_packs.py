"""
Vertical Compliance Packs (S3) uchun pytest to'plami.

Bu modul LLM'siz to'liq ishlaydi (regex + majburiy disclaimer) — shuning
uchun har bir funksiya deterministik va soddagina sinaladi. Ilgari BUTUNLAY
sinovsiz edi, holbuki `check_output` chiqish-filtri (masalan "aniq tashxis"
yoki "kafolatlangan daromad" kabi da'volarni ushlash) noto'g'ri ishlasa
soha-muvofiqligi (HIPAA-uslub) jimgina buzilib qolardi.
"""

import compliance_packs as cp


def test_get_pack_malum_vertikal():
    pack = cp.get_pack("healthcare")
    assert pack is not None
    assert pack["label"]["en"] == "Healthcare compliance"


def test_get_pack_nomalum_yoki_yoq_vertikal():
    assert cp.get_pack("boshqa-narsa") is None
    assert cp.get_pack(None) is None
    assert cp.get_pack("") is None


def test_pack_for_domain_xaritalash():
    assert cp.pack_for_domain("law") == "legal"
    assert cp.pack_for_domain("logistics") == "trade"
    assert cp.pack_for_domain("transport") == "trade"
    assert cp.pack_for_domain("healthcare") == "healthcare"


def test_pack_for_domain_nomalum_yoki_yoq():
    assert cp.pack_for_domain("noma'lum-domen") is None
    assert cp.pack_for_domain(None) is None


def test_system_addendum_malum_va_nomalum():
    assert "HEALTHCARE" in cp.system_addendum("healthcare")
    assert cp.system_addendum("boshqa-narsa") == ""
    assert cp.system_addendum(None) == ""


def test_packs_summary_hamma_paketlarni_qamraydi():
    summary = cp.packs_summary("en")
    assert len(summary) == len(cp.PACKS)
    ids = {s["id"] for s in summary}
    assert ids == set(cp.PACKS.keys())
    for s in summary:
        assert s["flag_patterns"] == len(cp.PACKS[s["id"]]["output_flags"])
        assert s["disclaimer"] == cp.PACKS[s["id"]]["disclaimers"]["en"]


def test_packs_summary_tarjima_va_fallback():
    ru = cp.packs_summary("ru")
    healthcare = next(s for s in ru if s["id"] == "healthcare")
    assert healthcare["label"] == "Медицинский комплаенс"

    # Qo'llab-quvvatlanmaydigan til -> en'ga tushadi (KeyError emas)
    fr = cp.packs_summary("fr")
    assert fr[0]["label"] == cp.PACKS[fr[0]["id"]]["label"]["en"]


class TestCheckOutput:
    def test_nomalum_vertikal_bosh_natija(self):
        res = cp.check_output("Sizda aniq diabet bor", None)
        assert res == {"violations": [], "disclaimer_needed": False, "disclaimer": ""}

    def test_healthcare_aniq_tashxis_dava_ushlanadi(self):
        res = cp.check_output("Sizda aniq diabet tashxisi bor", "healthcare", "uz")
        assert len(res["violations"]) == 1
        assert res["disclaimer_needed"] is True
        assert res["disclaimer"].startswith("⚕️")

    def test_healthcare_shifokorga_borish_shart_emas_ushlanadi(self):
        res = cp.check_output("shifokorga borish shart emas, davolaning", "healthcare", "uz")
        assert len(res["violations"]) == 1

    def test_finance_kafolatlangan_daromad_ushlanadi(self):
        res = cp.check_output("Bu instrument bilan kafolatlangan daromad olasiz", "finance", "uz")
        assert len(res["violations"]) == 1
        assert res["disclaimer"].startswith("💼")

    def test_finance_ruscha_kafolat_davosi_ushlanadi(self):
        res = cp.check_output("Вы получите гарантированный доход", "finance", "ru")
        assert len(res["violations"]) == 1

    def test_government_ariza_holati_ushlanadi(self):
        res = cp.check_output("Arizangiz tasdiqlandi", "government", "uz")
        assert len(res["violations"]) == 1

    def test_legal_sudda_yutish_kafolati_ushlanadi(self):
        res = cp.check_output("You will definitely win this case", "legal", "en")
        assert len(res["violations"]) == 1

    def test_retail_mijozni_ogri_deb_atash_ushlanadi(self):
        res = cp.check_output("This customer is a thief", "retail", "en")
        assert len(res["violations"]) == 1

    def test_trade_bojxona_kafolati_ushlanadi(self):
        res = cp.check_output("Customs will definitely approve your shipment", "trade", "en")
        assert len(res["violations"]) == 1

    def test_toza_matnda_buzilish_yoq(self):
        res = cp.check_output(
            "Sizda diabet belgilari bo'lishi mumkin, aniqlik uchun shifokorga murojaat qiling.",
            "healthcare",
            "uz",
        )
        assert res["violations"] == []
        assert res["disclaimer_needed"] is True  # disclaimer hali qo'shilmagan

    def test_disclaimer_allaqachon_matnda_bolsa_qayta_sorlmaydi(self):
        text = "⚕️ Bu umumiy tibbiy ma'lumot — tashxis ham, retsept ham emas. Litsenziyali shifokorga murojaat qiling."
        res = cp.check_output(text, "healthcare", "uz")
        assert res["disclaimer_needed"] is False

    def test_tarjima_qilinmagan_til_disclaimer_en_ga_tushadi(self):
        res = cp.check_output("random text", "healthcare", "fr")
        assert res["disclaimer"] == cp.PACKS["healthcare"]["disclaimers"]["en"]

    def test_barcha_paketlarning_output_flags_haqiqiy_regex(self):
        # Har bir pattern kompilyatsiya qilinishi va hech narsaga mos kelmasligi
        # kerak bo'lgan zararsiz matnda FALSE POSITIVE bermasligi kerak.
        import re

        benign = "Bugun ob-havo yaxshi, kofe ichaylik."
        for slug, pack in cp.PACKS.items():
            for pattern in pack["output_flags"]:
                re.compile(pattern)  # yaroqli regex ekanini tasdiqlaydi
                assert not re.search(pattern, benign), f"{slug}: {pattern} zararsiz matnga mos keldi"
