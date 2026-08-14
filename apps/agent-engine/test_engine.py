"""
Agent-engine uchun pytest to'plami (M8).

Ilgari engine'da 0 ta test bor edi — CI faqat "test topilmadi" (exit 5) ni
o'tkazib yuborardi, ya'ni regressiya jimgina chiqib ketardi. Bu fayl API
kalitisiz, deterministik yo'llarni qamraydi:
  - ichki-token auth guardi (C1 xavfsizlik tuzatmasi),
  - halal filtr lug'at (keyword) qatlami — LLM'siz ishlaydigan qatlam,
  - retail bashorat heuristikasi (sof matematik),
  - kasb/domain katalogi.
"""
import asyncio

from fastapi.testclient import TestClient

import agent_engine
import agent_tools
import computer_use_planner
import llm_utils
import main
import retail_forecast
from halal_filter import Action, keyword_layer
from role_detection import domains_summary

# ----------------------------------------------------------------
# C1: ichki-token auth guardi
# ----------------------------------------------------------------

client = TestClient(main.app)


def _dev_env(monkeypatch):
    """Prod-belgilarini olib tashlaymiz (lokal/dev holati)."""
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("RENDER", raising=False)


def test_health_ochiq_tokensiz(monkeypatch):
    _dev_env(monkeypatch)
    monkeypatch.setenv("INTERNAL_API_TOKEN", "strong-token")
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_himoyalangan_endpoint_tokensiz_401(monkeypatch):
    _dev_env(monkeypatch)
    monkeypatch.setenv("INTERNAL_API_TOKEN", "strong-token")
    assert client.get("/tools/available").status_code == 401


def test_notogri_token_401(monkeypatch):
    _dev_env(monkeypatch)
    monkeypatch.setenv("INTERNAL_API_TOKEN", "strong-token")
    r = client.get("/tools/available", headers={"x-internal-token": "wrong"})
    assert r.status_code == 401


def test_togri_token_200(monkeypatch):
    _dev_env(monkeypatch)
    monkeypatch.setenv("INTERNAL_API_TOKEN", "strong-token")
    r = client.get("/tools/available", headers={"x-internal-token": "strong-token"})
    assert r.status_code == 200


def test_prod_default_token_fail_closed(monkeypatch):
    # Prod'da commlik default token QABUL QILINMAYDI (500 — kuchli kalit majburiy).
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("INTERNAL_API_TOKEN", "agentnet-internal-dev")
    r = client.get("/tools/available", headers={"x-internal-token": "agentnet-internal-dev"})
    assert r.status_code == 500


# ----------------------------------------------------------------
# Halal filtr — lug'at qatlami (LLM'siz, deterministik)
# ----------------------------------------------------------------

def test_halal_keyword_bloklaydi_qimor():
    res = keyword_layer("Let's open a casino downtown")
    assert res is not None
    assert res.action == Action.BLOCK


def test_halal_keyword_benign_otkazadi():
    # Oddiy, ruxsat etilgan matn — lug'at qatlami hech narsa qaytarmaydi (None).
    assert keyword_layer("Bugungi namoz vaqtlari qanday?") is None


# ----------------------------------------------------------------
# Retail bashorat heuristikasi (sof matematik)
# ----------------------------------------------------------------

def test_retail_heuristic_kritik_tovarni_ustuvorlashtiradi():
    forecasts = [
        {"name": "Sut 1L", "urgency": "critical", "daysUntilStockout": 2, "recommendedOrderQty": 15},
        {"name": "Non", "urgency": "ok", "daysUntilStockout": 20, "recommendedOrderQty": 0},
    ]
    out = retail_forecast._heuristic(forecasts, {"critical": 1, "warning": 0}, "uz")
    assert out["method"] == "heuristic"
    assert out["headline"]
    # Faqat kritik/ogohlantirish + buyurtma-miqdori bor tovar ustuvorlar ro'yxatiga tushadi.
    assert any("Sut 1L" in p for p in out["priorities"])
    assert all("Non" not in p for p in out["priorities"])


# ----------------------------------------------------------------
# Kasb/domain katalogi (sof, deterministik)
# ----------------------------------------------------------------

def test_domains_summary_bosh_emas():
    domains = domains_summary()
    assert isinstance(domains, list)
    assert len(domains) > 0


# ----------------------------------------------------------------
# #11: real-rejim tool (function-calling) registri
# ----------------------------------------------------------------

def test_agent_tools_faqat_qollab_quvvatlanadigan_info_toollarni_beradi():
    defs = agent_tools.build_tools(
        ["islam.prayer_times", "utility.weather", "messaging.telegram_send", "bogus.x"]
    )
    names = {d["name"] for d in defs}
    # Qo'llab-quvvatlanadigan info-toollar Claude uchun to'g'ri nom (nuqtasiz) oladi
    assert "islam_prayer_times" in names
    assert "utility_weather" in names
    # Yon-ta'sirli / noma'lum toollar ATAYLAB chiqarilmaydi
    assert "messaging_telegram_send" not in names
    assert all("." not in n for n in names)  # Claude tool-nomi nuqta qabul qilmaydi


def test_agent_tools_nomalum_tool_xato_beradi():
    out = asyncio.run(agent_tools.run_tool("bogus_name", {}, "en", "Tashkent"))
    assert "xato" in out


def test_agent_tools_tool_result_json_seriyalanadi():
    s = agent_tools.to_tool_result_content({"shahar": "Tashkent", "harorat_C": 20})
    assert '"Tashkent"' in s and "20" in s


# ----------------------------------------------------------------
# SEC-02: computer-use vision loop qadam-chegarasi (15 -> 10)
# ----------------------------------------------------------------

def test_computer_use_max_steps_10ga_tushirilgan():
    assert computer_use_planner.MAX_STEPS == 10


def test_computer_use_describe_capabilities_max_steps_mos():
    caps = computer_use_planner.describe_capabilities()
    assert caps["max_steps"] == 10


# ----------------------------------------------------------------
# CI-FIX (2026-08-12): mypy bloklovchi ishida topilgan IKKI HAQIQIY xato.
# Ikkalasi ham "shunchaki tip-shikoyati" emas edi — pastdagi testlar
# aynan ish-vaqti xulqini qulflaydi.
# ----------------------------------------------------------------

def test_content_to_text_oddiy_matnni_ozgartirmaydi():
    assert agent_engine._content_to_text("salom") == "salom"


def test_content_to_text_anthropic_bloklarini_birlashtiradi():
    """Anthropic kontent-BLOKLARI `list` qaytaradi — ilgari u to'g'ridan-to'g'ri
    `messages`ga yozilardi va `_halal_check_input` dagi `.lower()` ni
    `AttributeError` bilan yiqitardi."""
    blocks = [{"type": "text", "text": "Salom "}, {"type": "text", "text": "dunyo"}]
    assert agent_engine._content_to_text(blocks) == "Salom dunyo"


def test_content_to_text_matnsiz_bloklarni_otkazib_yuboradi():
    """`tool_use` blokida "text" kaliti YO'Q — u bo'sh satrga aylanadi,
    KeyError bermaydi."""
    blocks = [{"type": "text", "text": "javob"}, {"type": "tool_use", "id": "t1"}]
    assert agent_engine._content_to_text(blocks) == "javob"


def test_content_to_text_natijasi_har_doim_lower_ni_qollaydi():
    """Asosiy invariant: natija HAR DOIM `str` — ya'ni `_halal_check_input`
    dagi `.lower()` hech qachon yiqilmaydi."""
    for raw in ["A", [{"type": "text", "text": "B"}], ["C"], 42, None]:
        assert agent_engine._content_to_text(raw).lower() is not None


# --- llm_utils: provayder o'rnatilmaganda None qaytishi (mypy union-attr) ---

def test_llm_utils_anthropic_client_yoq_bolsa_none(monkeypatch):
    """`_anthropic is None` bo'lsa atributga tegilmaydi — modulning e'lon
    qilingan shartnomasi ("kalit yo'q -> None") aynan shu."""
    monkeypatch.setattr(llm_utils, "_anthropic", None)
    out = asyncio.run(llm_utils._anthropic_json("s", "u", 100, "claude-sonnet-5"))
    assert out is None


def test_llm_utils_gemini_client_yoq_bolsa_none(monkeypatch):
    monkeypatch.setattr(llm_utils, "_gemini", None)
    monkeypatch.setattr(llm_utils, "_gemini_types", None)
    out = asyncio.run(llm_utils._gemini_json("s", "u", 100))
    assert out is None


def test_llm_utils_gemini_types_yoq_bolsa_ham_none(monkeypatch):
    """`_gemini` bor, lekin `_gemini_types` yo'q — ikkalasi bitta `try` da
    o'rnatilgani uchun bu holat ham qorovuldan o'tishi kerak."""
    monkeypatch.setattr(llm_utils, "_gemini", object())
    monkeypatch.setattr(llm_utils, "_gemini_types", None)
    out = asyncio.run(llm_utils._gemini_json("s", "u", 100))
    assert out is None


def test_llm_utils_openrouter_kalit_yoq_bolsa_none(monkeypatch):
    """`OPENROUTER_API_KEY` bo'sh bo'lsa tarmoqqa umuman chiqmaydi."""
    monkeypatch.setattr(llm_utils, "OPENROUTER_API_KEY", None)
    out = asyncio.run(llm_utils._openrouter_json("s", "u", 100))
    assert out is None


def test_llm_utils_llm_json_openrouter_anthropic_dan_ustuvor(monkeypatch):
    """OpenRouter kaliti bor ekan, `_PROVIDER == "anthropic"` bo'lsa ham
    `llm_json` OpenRouter yo'liga boradi — ustuvorlik shartnomasi shu."""
    calls: list[str] = []

    async def fake_openrouter(*_a, **_kw):
        calls.append("openrouter")
        return {"ok": True}

    async def fake_anthropic(*_a, **_kw):
        calls.append("anthropic")
        return {"ok": True}

    monkeypatch.setattr(llm_utils, "_PROVIDER", "openrouter")
    monkeypatch.setattr(llm_utils, "_openrouter_json", fake_openrouter)
    monkeypatch.setattr(llm_utils, "_anthropic_json", fake_anthropic)
    out = asyncio.run(llm_utils.llm_json("s", "u"))
    assert out == {"ok": True}
    assert calls == ["openrouter"]


def test_llm_utils_gemini_endi_provider_zanjirida_yoq(monkeypatch):
    """Gemini SDK sozlangan bo'lsa ham, `_PROVIDER` unga hech qachon
    o'rnatilmaydi — u faqat `gemini_client()` orqali vision uchun ochiq."""
    monkeypatch.setattr(llm_utils, "_PROVIDER", None)
    monkeypatch.setattr(llm_utils, "_gemini", object())
    monkeypatch.setattr(llm_utils, "_gemini_types", object())
    out = asyncio.run(llm_utils.llm_json("s", "u"))
    assert out is None


# ----------------------------------------------------------------
# Phase 6 / ADR-022 — "AI Engine Dependency Upgrade" regressiya to'plami.
#
# langgraph 0.2.62 -> 1.2.11 MAJOR sakrash edi. Mavjud 50 ta test
# `StateGraph`ga UMUMAN tegmasdi (ular tool-registry, halal lug'ati va
# `_content_to_text` ni qoplaydi), ya'ni ular yashil bo'lishi major
# moslikni ISBOTLAMASDI. Quyidagilar aynan shu bo'shliqni yopadi.
# ----------------------------------------------------------------

def test_langgraph_mavjud_va_graf_compile_boladi():
    """LangGraph 1.x da `StateGraph` qurilishi va `compile()` ishlashi."""
    assert agent_engine._LANGGRAPH_AVAILABLE is True
    d = agent_engine.AgentDefinition(agent_id="a1", name="t", system_prompt="sp")
    eng = agent_engine.AgentEngine(d, agent_engine.registry)
    assert type(eng.graph).__name__ == "CompiledStateGraph"


class _FakeResp:
    """Anthropic kontent-BLOKLARI shakli (LangGraph 1.x da ham o'zgarmagan)."""

    content = [{"type": "text", "text": "javob "}, {"type": "text", "text": "matni"}]


class _FakeLLM:
    async def ainvoke(self, _messages):
        return _FakeResp()


def _engine_with_fake_llm():
    d = agent_engine.AgentDefinition(agent_id="a1", name="t", system_prompt="sp")
    eng = agent_engine.AgentEngine(d, agent_engine.registry)
    eng.llm = _FakeLLM()
    return eng


def _state(text: str):
    return {
        "messages": [{"role": "user", "content": text}],
        "user_id": "u1",
        "agent_id": "a1",
        "pending_tool_calls": [],
        "halal_flag": None,
        "iterations": 0,
    }


def test_graf_uchdan_uchga_ijro_etiladi_allow_yoli():
    """halal_check_input -> reason -> halal_check_output -> END."""
    eng = _engine_with_fake_llm()
    out = asyncio.run(eng.graph.ainvoke(_state("salom")))
    assert out["halal_flag"] == "ALLOW"
    assert out["iterations"] == 1
    # `_content_to_text` graf ICHIDA ham ishlaydi: bloklar matnga aylandi.
    assert out["messages"][-1] == {"role": "assistant", "content": "javob matni"}


def test_graf_halal_block_yolida_toxtaydi():
    """BLOCK bo'lsa `reason` tuguni UMUMAN ishlamaydi (shartli qirra)."""
    eng = _engine_with_fake_llm()
    out = asyncio.run(eng.graph.ainvoke(_state("qimor haqida")))
    assert out["halal_flag"] == "BLOCK"
    assert out["iterations"] == 0  # reason tuguniga yetib bormadi


def test_checkpoint_serializatsiyasi_round_trip():
    """`langgraph-checkpoint` 2.1.2 -> 4.2.0 MAJOR sakradi. `AgentState`
    shakli serde'dan o'zgarmasdan o'tishi kerak."""
    from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer

    ser = JsonPlusSerializer()
    state = _state("salom")
    state["halal_flag"] = "ALLOW"
    type_, blob = ser.dumps_typed(state)
    assert ser.loads_typed((type_, blob)) == state


def test_xavfsizlik_versiya_pollari():
    """SEC-15 / ADR-022: bu paketlar CVE tuzatilgan versiyadan PASTGA
    tushib qolmasin. Tushsa — shu test CI'ni qizartiradi (pip-audit'dan
    oldin va aniqroq xabar bilan)."""
    from importlib.metadata import version

    floors = {
        "langgraph": (1, 0, 10),
        "langchain-anthropic": (1, 4, 6),
        "langchain-core": (1, 2, 22),
        "langgraph-checkpoint": (4, 1, 1),
        "langgraph-sdk": (0, 3, 15),
    }
    for pkg, floor in floors.items():
        got = tuple(int(p) for p in version(pkg).split(".")[:3])
        assert got >= floor, f"{pkg} {got} < {floor} — CVE qayta ochiladi"
