"""
Halal Filter (ko'p qatlamli kontent/amal filtri) uchun pytest to'plami.

Bu — platformaning moderatsiya so'nggi chizig'i (barcha agent kirish/chiqish
matni shu qatlamdan o'tadi). Ilgari FAQAT keyword qatlami (1-bosqich)
sinovdan o'tgan edi; LLM qatlami (3-bosqich — keyword ushlamagan HAMMA
narsa uchun yakuniy tekshiruv) va semantik qatlam BUTUNLAY sinovsiz edi.
"""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import numpy as np
import pytest

import halal_filter as hf
from halal_filter import Action, Category, EmbeddingProvider, FilterResult


def _fake_response(payload: dict) -> SimpleNamespace:
    return SimpleNamespace(content=[SimpleNamespace(text=json.dumps(payload))])


# ------------------------------------------------------------------
# 1-bosqich: keyword_layer
# ------------------------------------------------------------------


class TestKeywordLayer:
    @pytest.mark.parametrize(
        "text,expected_category",
        [
            ("Kelinglar kazino ochamiz", Category.QIMOR),
            ("Let's open a casino downtown", Category.QIMOR),
            ("Давайте откроем казино", Category.QIMOR),
            ("Bu yerda foizli kredit beramiz", Category.RIBO),
            ("This is an explicit video", Category.NOJOYA_KONTENT),
            ("How to sell drugs online", Category.NOJOYA_KONTENT),
            ("We need to incite religious hatred", Category.FITNA),
        ],
    )
    def test_har_toifadagi_taqiqlangan_soz_bloklanadi(self, text, expected_category):
        res = hf.keyword_layer(text)
        assert res is not None
        assert res.category == expected_category
        assert res.action == Action.BLOCK
        assert res.layer == "keyword"

    def test_katta_kichik_harf_farq_qilmaydi(self):
        assert hf.keyword_layer("LET'S GO TO THE CASINO") is not None

    def test_zararsiz_matn_otkaziladi(self):
        assert hf.keyword_layer("Bugungi namoz vaqtlari qanday?") is None
        assert hf.keyword_layer("What is the weather like today?") is None


# ------------------------------------------------------------------
# 2-bosqich: semantik qatlam
# ------------------------------------------------------------------


class TestCosineSimilarity:
    def test_bir_xil_vektorlar_1ga_teng(self):
        v = np.array([1.0, 2.0, 3.0])
        assert hf.cosine_similarity(v, v) == pytest.approx(1.0)

    def test_ortogonal_vektorlar_0ga_teng(self):
        assert hf.cosine_similarity(np.array([1.0, 0.0]), np.array([0.0, 1.0])) == pytest.approx(0.0)

    def test_qarama_qarshi_vektorlar_manfiy_1(self):
        assert hf.cosine_similarity(np.array([1.0, 0.0]), np.array([-1.0, 0.0])) == pytest.approx(-1.0)


class FakeEmbedder(EmbeddingProvider):
    def __init__(self, vec: np.ndarray):
        self._vec = vec

    async def embed(self, text: str) -> np.ndarray:
        return self._vec


class TestSemanticLayer:
    async def test_chegaradan_past_ozshashlik_none_qaytaradi(self):
        embedder = FakeEmbedder(np.array([1.0, 0.0]))
        anchors = {Category.QIMOR: [np.array([0.0, 1.0])]}  # ortogonal — 0.0 o'xshashlik
        assert await hf.semantic_layer("matn", embedder, anchors) is None

    async def test_chegaradan_yuqori_lekin_092dan_past_human_review(self):
        # SEMANTIC_THRESHOLD=0.82; cos([1,0.5],[1,0]) ≈ 0.894 — 0.82 dan yuqori,
        # 0.92 dan past oraliq.
        embedder = FakeEmbedder(np.array([1.0, 0.5]))
        anchors = {Category.QIMOR: [np.array([1.0, 0.0])]}
        res = await hf.semantic_layer("matn", embedder, anchors)
        assert res is not None
        assert res.action == Action.HUMAN_REVIEW
        assert res.layer == "semantic"
        assert res.category == Category.QIMOR

    async def test_juda_yuqori_ozshashlik_block(self):
        embedder = FakeEmbedder(np.array([1.0, 0.0]))
        anchors = {Category.QIMOR: [np.array([1.0, 0.0])]}  # aynan bir xil -> 1.0
        res = await hf.semantic_layer("matn", embedder, anchors)
        assert res.action == Action.BLOCK

    async def test_bosh_anchor_cache_none_qaytaradi(self):
        embedder = FakeEmbedder(np.array([1.0, 0.0]))
        assert await hf.semantic_layer("matn", embedder, {}) is None


# ------------------------------------------------------------------
# 3-bosqich: LLM klassifikatori
# ------------------------------------------------------------------


class TestLlmLayer:
    async def test_muvaffaqiyatli_javob_toliq_parse_qilinadi(self, monkeypatch):
        payload = {"category": "QIMOR", "confidence": 0.87, "reasoning": "garov taklifi", "action": "BLOCK"}
        create = AsyncMock(return_value=_fake_response(payload))
        monkeypatch.setattr(hf.client.messages, "create", create)

        res = await hf.llm_layer("keling pul tikaylik", agent_name="retail-bot", profession="do'kon egasi")

        assert res == FilterResult(
            category=Category.QIMOR, confidence=0.87, reasoning="garov taklifi", action=Action.BLOCK, layer="llm",
        )
        # kasb konteksti promptga qo'shilganini tasdiqlaydi (chegara-holatlar uchun muhim)
        prompt = create.call_args.kwargs["messages"][0]["content"]
        assert "do'kon egasi" in prompt
        assert "retail-bot" in prompt

    async def test_api_mavjud_emas_xavfsiz_allow_qaytaradi(self, monkeypatch):
        create = AsyncMock(side_effect=Exception("no API key"))
        monkeypatch.setattr(hf.client.messages, "create", create)

        res = await hf.llm_layer("har qanday matn")

        assert res.action == Action.ALLOW
        assert res.category == Category.XAVFSIZ
        assert res.layer == "keyword-fallback"

    async def test_json_bolmagan_javob_inson_tekshiruviga_yuboriladi(self, monkeypatch):
        bad_response = SimpleNamespace(content=[SimpleNamespace(text="men bu haqda ishonchli emasman")])
        create = AsyncMock(return_value=bad_response)
        monkeypatch.setattr(hf.client.messages, "create", create)

        res = await hf.llm_layer("noaniq matn")

        assert res.action == Action.HUMAN_REVIEW
        assert res.category == Category.NOANIQ
        assert res.layer == "llm"

    async def test_kasbsiz_chaqiruv_kontekstga_qoshilmaydi(self, monkeypatch):
        payload = {"category": "XAVFSIZ", "confidence": 0.9, "reasoning": "ok", "action": "ALLOW"}
        create = AsyncMock(return_value=_fake_response(payload))
        monkeypatch.setattr(hf.client.messages, "create", create)

        await hf.llm_layer("salom", profession="")

        prompt = create.call_args.kwargs["messages"][0]["content"]
        assert "Foydalanuvchi kasbi" not in prompt


# ------------------------------------------------------------------
# Orkestrator: HalalFilter.classify
# ------------------------------------------------------------------


class TestHalalFilterClassify:
    async def test_keyword_hit_llm_qatlamini_chetlab_otadi(self, monkeypatch):
        llm_spy = AsyncMock()
        monkeypatch.setattr(hf, "llm_layer", llm_spy)
        filt = hf.HalalFilter()

        res = await filt.classify("keling kazino ochamiz")

        assert res.layer == "keyword"
        llm_spy.assert_not_called()

    async def test_embeddersiz_kalit_soz_topilmasa_llm_qatlamiga_otadi(self, monkeypatch):
        expected = FilterResult(Category.XAVFSIZ, 0.9, "ok", Action.ALLOW, layer="llm")
        llm_spy = AsyncMock(return_value=expected)
        monkeypatch.setattr(hf, "llm_layer", llm_spy)
        filt = hf.HalalFilter()  # embedder=None -> semantik qatlam o'tkazib yuboriladi

        res = await filt.classify("bugungi ob-havo qanday")

        assert res == expected
        llm_spy.assert_awaited_once()

    async def test_semantik_qatlam_mos_kelsa_llm_chaqirilmaydi(self, monkeypatch):
        llm_spy = AsyncMock()
        monkeypatch.setattr(hf, "llm_layer", llm_spy)
        semantic_result = FilterResult(Category.QIMOR, 0.95, "semantik mos", Action.BLOCK, layer="semantic")
        monkeypatch.setattr(hf, "semantic_layer", AsyncMock(return_value=semantic_result))
        filt = hf.HalalFilter(embedder=FakeEmbedder(np.array([1.0])))

        res = await filt.classify("kalit-so'zsiz lekin semantik jihatdan shubhali matn")

        assert res.layer == "semantic"
        llm_spy.assert_not_called()

    async def test_semantik_mos_kelmasa_llm_qatlamiga_otadi(self, monkeypatch):
        expected = FilterResult(Category.XAVFSIZ, 0.9, "ok", Action.ALLOW, layer="llm")
        llm_spy = AsyncMock(return_value=expected)
        monkeypatch.setattr(hf, "llm_layer", llm_spy)
        monkeypatch.setattr(hf, "semantic_layer", AsyncMock(return_value=None))
        filt = hf.HalalFilter(embedder=FakeEmbedder(np.array([1.0])))

        res = await filt.classify("zararsiz matn")

        assert res == expected
        llm_spy.assert_awaited_once()
