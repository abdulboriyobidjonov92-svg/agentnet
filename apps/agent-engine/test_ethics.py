"""
Ethical Decision Engine (ethics.py) uchun pytest to'plami.

Ikki bosqichni sinaydi: (1) Halal Filter qayta ishlatilishi — BLOCK bo'lsa
darhol REJECT, LLM'ga UMUMAN chiqilmaydi; (2) qadriyatlar qatlami —
LLM-first, keyword-qoida fallback. Ilgari BUTUNLAY sinovsiz edi.
"""

from unittest.mock import AsyncMock

import pytest

import ethics
import halal_filter as hf
from halal_filter import Action, Category, FilterResult


@pytest.fixture(autouse=True)
def _halal_allows_by_default(monkeypatch):
    """Halal Filter'ning LLM qatlamini xavfsiz ALLOW bilan javob berishga
    majburlaydi — bu fixture faqat halal-BLOCK bo'lmagan testlar uchun
    (haqiqiy tarmoq chaqiruvisiz), ethics'ning O'Z LLM/heuristik mantig'ini
    izolyatsiya qilib sinash uchun."""
    allow = FilterResult(Category.XAVFSIZ, 0.9, "toza", Action.ALLOW, layer="llm")
    monkeypatch.setattr(hf, "llm_layer", AsyncMock(return_value=allow))


class TestHalalBlockShortCircuit:
    async def test_halal_bloklagan_amal_darhol_reject(self, monkeypatch):
        llm_json_spy = AsyncMock()
        monkeypatch.setattr(ethics, "llm_json", llm_json_spy)

        res = await ethics.evaluate("Keling kazino ochamiz", values=None, language="uz")

        assert res["verdict"] == "REJECT"
        assert res["method"] == "halal_filter"
        assert res["value_alignment"] == []
        assert res["safeguards"] == []
        assert res["halal"]["action"] == "BLOCK"
        llm_json_spy.assert_not_called()  # qadriyatlar qatlamiga UMUMAN chiqilmaydi

    async def test_halal_block_xabari_tilga_qarab_tarjima_qilinadi(self):
        res_en = await ethics.evaluate("Let's open a casino", values=None, language="en")
        res_ru = await ethics.evaluate("Let's open a casino", values=None, language="ru")

        assert "Blocked by the Halal Filter" in res_en["reasoning"]
        assert "Заблокировано Halal Filter" in res_ru["reasoning"]


class TestLlmVerdictPassthrough:
    async def test_llm_qadriyat_baholovi_ozgarishsiz_qaytariladi(self, monkeypatch):
        llm_result = {
            "verdict": "CAUTION",
            "reasoning": "Foizsiz ekanini tekshiring",
            "value_alignment": [{"value": "halollik", "status": "neutral", "note": ""}],
            "safeguards": ["Shartnomani yozma tasdiqlang"],
        }
        monkeypatch.setattr(ethics, "llm_json", AsyncMock(return_value=llm_result))

        res = await ethics.evaluate("Do'kon uchun kredit olsam bo'ladimi?", values={"tradition": "islamic"}, language="uz")

        assert res["verdict"] == "CAUTION"
        assert res["reasoning"] == "Foizsiz ekanini tekshiring"
        assert res["method"] == "llm"
        assert res["halal"]["action"] == "ALLOW"  # halal-payload baribir qo'shiladi

    async def test_llm_notogri_verdict_qaytarsa_heuristikaga_tushadi(self, monkeypatch):
        # LLM "verdict" maydonini kutilmagan qiymat bilan qaytarsa (yoki umuman yo'q) —
        # xavfsizlik uchun fallback ishga tushishi kerak, xato emas.
        monkeypatch.setattr(ethics, "llm_json", AsyncMock(return_value={"verdict": "MAYBE"}))

        res = await ethics.evaluate("oddiy savol", values=None, language="en")

        assert res["method"] == "heuristic"

    async def test_llm_none_qaytarsa_heuristikaga_tushadi(self, monkeypatch):
        monkeypatch.setattr(ethics, "llm_json", AsyncMock(return_value=None))

        res = await ethics.evaluate("oddiy savol", values=None, language="en")

        assert res["method"] == "heuristic"


class TestHeuristicFallback:
    @pytest.fixture(autouse=True)
    def _llm_unavailable(self, monkeypatch):
        monkeypatch.setattr(ethics, "llm_json", AsyncMock(return_value=None))

    @pytest.mark.parametrize(
        "action,expected_verdict,expected_key",
        [
            # "interest loan" (halal BLOCKLIST'dagi "\binterest\s+rate\s+loan\b"dan farqli —
            # keyword-qatlamda BLOKLANMAYDI, shu bilan ethics'ning O'Z riba-qoidasi sinaladi)
            ("Should I take an interest loan for my business?", "REJECT", "riba"),
            ("Mijozdan haqiqatni yashirish kerakmi?", "REJECT", "deception"),
            ("Litsenziya uchun amaldorga pora berish kerakmi?", "REJECT", "corruption"),
            ("Biznes uchun bank orqali qarz olsam bo'ladimi?", "CAUTION", "debt"),
            ("Ishchini ishdan bo'shatish kerakmi?", "CAUTION", "impact_on_others"),
            ("Bu investitsiya juda tavakkalli", "CAUTION", "risk"),
            ("Bugun kofe ichsam bo'ladimi?", "APPROVE", "ok"),
        ],
    )
    async def test_qoida_asoslangan_verdiktlar(self, action, expected_verdict, expected_key):
        res = await ethics.evaluate(action, values=None, language="en")

        assert res["verdict"] == expected_verdict
        assert res["reasoning"] == ethics._REASON_TEXT[expected_key]["en"]
        assert res["method"] == "heuristic"

    async def test_birinchi_mos_kelgan_qoida_ustunlik_qiladi(self):
        # RIBO qoidasi RISK'dan OLDIN ro'yxatlangan — ikkalasi ham mos kelsa RIBO g'alaba qiladi.
        res = await ethics.evaluate("This interest loan seems risky", values=None, language="en")
        assert res["reasoning"] == ethics._REASON_TEXT["riba"]["en"]

    async def test_royxatga_olingan_qadriyatlar_moslikda_aks_etadi(self):
        values = {"statements": ["halollik", "adolat", "shaffoflik"]}
        res = await ethics.evaluate("Mijozdan haqiqatni yashirish kerakmi?", values=values, language="en")

        assert len(res["value_alignment"]) == 3
        assert all(a["status"] == "conflict" for a in res["value_alignment"])  # REJECT -> hammasi conflict

    async def test_apruvda_qadriyatlar_neutral_deb_belgilanadi(self):
        values = {"statements": ["halollik"]}
        res = await ethics.evaluate("Bugun kofe ichsam bo'ladimi?", values=values, language="en")
        assert res["value_alignment"] == [{"value": "halollik", "status": "neutral", "note": ""}]

    async def test_besh_tadan_ortiq_bayonot_qisqartiriladi(self):
        values = {"statements": [f"qadriyat-{i}" for i in range(10)]}
        res = await ethics.evaluate("oddiy savol", values=values, language="en")
        assert len(res["value_alignment"]) == 5

    async def test_qollab_quvvatlanmaydigan_til_english_ga_tushadi(self):
        res = await ethics.evaluate("oddiy savol", values=None, language="fr")
        assert res["reasoning"] == ethics._REASON_TEXT["ok"]["en"]

    async def test_values_none_bolsa_yiqilmaydi(self):
        res = await ethics.evaluate("oddiy savol", values=None, language="en")
        assert res["verdict"] == "APPROVE"
        assert res["value_alignment"] == []

    async def test_bosh_statements_royxati_yiqilmaydi(self):
        res = await ethics.evaluate("oddiy savol", values={"statements": ["", None]}, language="en")
        assert res["value_alignment"] == []
