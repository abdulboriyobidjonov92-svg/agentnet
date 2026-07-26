"""
Role Detection & Adaptive Profiling (role_detection.py) uchun pytest to'plami.

Onboarding'ning yuragi: erkin matndan kasb/domenni aniqlash (LLM-first,
keyword fallback — demo rejimda ham to'liq ishlashi SHART). Ilgari faqat
`domains_summary()` bitta testda tekshirilgan edi; aniqlash mantig'ining
o'zi (LLM va keyword ikkalasi ham) butunlay sinovsiz edi.
"""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

import role_detection as rd


def _fake_response(payload: dict) -> SimpleNamespace:
    return SimpleNamespace(content=[SimpleNamespace(text=json.dumps(payload))])


# ------------------------------------------------------------------
# Keyword fallback
# ------------------------------------------------------------------


class TestDetectWithKeywords:
    def test_hech_qanday_keyword_mos_kelmasa_general(self):
        profile = rd._detect_with_keywords("xyz qwerty 12345", "en")
        assert profile.domain == "general"
        assert profile.confidence == 0.3
        assert profile.method == "keyword"
        assert profile.profession_title == "Not specified"

    def test_bitta_keyword_mos_kelsa_ishonch_06(self):
        profile = rd._detect_with_keywords("I run a small shop", "en")
        assert profile.domain == "retail"
        assert profile.confidence == pytest.approx(0.6)

    def test_kop_keyword_mos_kelsa_ishonch_oshadi_lekin_085da_cheklanadi(self):
        text = "I run a shop, manage a store, track inventory and sales for my customers"
        profile = rd._detect_with_keywords(text, "en")
        assert profile.domain == "retail"
        assert profile.confidence == 0.85  # 0.5 + 0.1*hits > 0.85 -> cheklanadi

    def test_eng_kop_mos_kelgan_domen_gʻalaba_qiladi(self):
        # "clinic"/"patient" (healthcare, 2 hits) vs "shop" (retail, 1 hit) -> healthcare
        text = "I work at a clinic and see many patients, also visited a shop once"
        profile = rd._detect_with_keywords(text, "en")
        assert profile.domain == "healthcare"

    def test_nomalum_til_reasoning_english_ga_tushadi(self):
        profile = rd._detect_with_keywords("random text", "fr")
        assert profile.reasoning == rd._REASONING_BY_LANG["en"]
        assert profile.profession_title == rd._UNKNOWN_TITLE["en"]

    def test_uzbek_va_rus_tillarida_ham_ishlaydi(self):
        uz = rd._detect_with_keywords("Men shifokorman", "uz")
        assert uz.domain == "healthcare"

        ru = rd._detect_with_keywords("Я работаю врачом в клинике", "ru")
        assert ru.domain == "healthcare"


class TestExtractTitle:
    def test_mos_kelgan_sozni_qoshimchasi_bilan_oladi(self):
        title = rd._extract_title("I'm a farmer's assistant", ["farmer"])
        assert title == "farmer's"

    def test_hech_narsa_topilmasa_none(self):
        assert rd._extract_title("boshqa matn", ["topilmaydigan-soz"]) is None


# ------------------------------------------------------------------
# LLM-asoslangan aniqlash
# ------------------------------------------------------------------


class TestDetectWithLlm:
    async def test_muvaffaqiyatli_javob_toliq_parse_qilinadi(self, monkeypatch):
        payload = {
            "profession_title": "kardiolog",
            "domain": "healthcare",
            "confidence": 0.92,
            "reasoning": "Kasb aniq aytilgan",
            "goals": ["bemorlar bilan ishlash", "klinik yordam"],
        }
        create = AsyncMock(return_value=_fake_response(payload))
        monkeypatch.setattr(rd._client.messages, "create", create)

        profile = await rd._detect_with_llm("Men Samarqandda kardiologman")

        assert profile.profession_title == "kardiolog"
        assert profile.domain == "healthcare"
        assert profile.confidence == 0.92
        assert profile.goals == ["bemorlar bilan ishlash", "klinik yordam"]
        assert profile.method == "llm"

    async def test_royxatda_bolmagan_domen_generalga_tushadi(self, monkeypatch):
        payload = {"profession_title": "kim oshdi savdo dilleri", "domain": "auctioneering", "confidence": 0.7}
        monkeypatch.setattr(rd._client.messages, "create", AsyncMock(return_value=_fake_response(payload)))

        profile = await rd._detect_with_llm("matn")
        assert profile.domain == "general"

    async def test_ishonch_01_oraligiga_qisqartiriladi(self, monkeypatch):
        payload = {"profession_title": "x", "domain": "general", "confidence": 5.0}
        monkeypatch.setattr(rd._client.messages, "create", AsyncMock(return_value=_fake_response(payload)))

        profile = await rd._detect_with_llm("matn")
        assert profile.confidence == 1.0

    async def test_bosh_profession_title_em_tire_bolib_qoladi(self, monkeypatch):
        payload = {"profession_title": "  ", "domain": "general", "confidence": 0.5}
        monkeypatch.setattr(rd._client.messages, "create", AsyncMock(return_value=_fake_response(payload)))

        profile = await rd._detect_with_llm("matn")
        assert profile.profession_title == "—"

    async def test_api_xato_bersa_none(self, monkeypatch):
        monkeypatch.setattr(rd._client.messages, "create", AsyncMock(side_effect=Exception("no key")))
        assert await rd._detect_with_llm("matn") is None

    async def test_json_topilmasa_none(self, monkeypatch):
        bad = SimpleNamespace(content=[SimpleNamespace(text="men ishonchli emasman")])
        monkeypatch.setattr(rd._client.messages, "create", AsyncMock(return_value=bad))
        assert await rd._detect_with_llm("matn") is None

    async def test_goals_4tadan_ortiq_bolsa_qisqartiriladi(self, monkeypatch):
        payload = {
            "profession_title": "x", "domain": "general", "confidence": 0.5,
            "goals": ["a", "b", "c", "d", "e", "f"],
        }
        monkeypatch.setattr(rd._client.messages, "create", AsyncMock(return_value=_fake_response(payload)))

        profile = await rd._detect_with_llm("matn")
        assert profile.goals == ["a", "b", "c", "d"]


# ------------------------------------------------------------------
# Umumiy kirish nuqtasi
# ------------------------------------------------------------------


class TestDetectRole:
    async def test_llm_muvaffaqiyatli_bolsa_keyword_ishlatilmaydi(self, monkeypatch):
        llm_profile = rd.RoleProfile(
            profession_title="haydovchi", domain="transport", confidence=0.8, reasoning="x", method="llm",
        )
        monkeypatch.setattr(rd, "_detect_with_llm", AsyncMock(return_value=llm_profile))

        res = await rd.detect_role("istalgan matn", "uz")
        assert res["method"] == "llm"
        assert res["domain"] == "transport"

    async def test_llm_none_qaytarsa_keyword_fallbackga_tushadi(self, monkeypatch):
        monkeypatch.setattr(rd, "_detect_with_llm", AsyncMock(return_value=None))

        res = await rd.detect_role("I run a shop", "en")
        assert res["method"] == "keyword"
        assert res["domain"] == "retail"


# ------------------------------------------------------------------
# Domen katalogi
# ------------------------------------------------------------------


class TestDomainsCatalog:
    def test_domains_summary_hamma_domenlarni_qamraydi(self):
        summary = rd.domains_summary()
        assert len(summary) == len(rd.DOMAINS)
        slugs = {d["slug"] for d in summary}
        assert slugs == set(rd.DOMAINS.keys())
        assert "general" in slugs

    def test_domain_profile_malum_slug(self):
        res = rd.domain_profile("retail", "en")
        assert res["domain"] == "retail"
        assert res["confidence"] == 1.0
        assert res["method"] == "stored"
        assert len(res["recommended_agents"]) == len(rd.DOMAINS["retail"]["agents"])

    def test_domain_profile_nomalum_slug_generalga_tushadi(self):
        res = rd.domain_profile("noma'lum-domen", "en")
        assert res["domain"] == "general"


class TestRoleProfileToResponse:
    def test_recommended_agents_va_dashboard_tuzilishi(self):
        profile = rd.RoleProfile(
            profession_title="Do'kon egasi", domain="retail", confidence=0.777, reasoning="test",
        )
        res = profile.to_response("uz")

        assert res["confidence"] == 0.78  # 2 xonagacha yaxlitlanadi
        assert res["domain_label"] == rd.DOMAINS["retail"]["label"]
        agent = res["recommended_agents"][0]
        assert set(agent.keys()) == {"name", "description", "system_prompt", "tools"}
        assert agent["tools"][0] == {"tool_id": rd.DOMAINS["retail"]["agents"][0]["tools"][0], "config": {}}
        assert res["dashboard"]["widgets"] == rd.DOMAINS["retail"]["widgets"]
        assert res["dashboard"]["quick_actions"] == rd.DOMAINS["retail"]["quick_actions"]

    def test_nomalum_domen_general_konfiguratsiyaga_tushadi(self):
        profile = rd.RoleProfile(profession_title="x", domain="shunday-domen-yoq", confidence=0.5, reasoning="x")
        res = profile.to_response("en")
        assert res["dashboard"]["widgets"] == rd.DOMAINS["general"]["widgets"]
