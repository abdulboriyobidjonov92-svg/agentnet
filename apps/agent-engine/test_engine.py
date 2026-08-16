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
import json

import pytest
from fastapi.testclient import TestClient

import agent_engine
import agent_tools
import computer_use_planner
import llm_utils
import main
import openrouter_client
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

def _spec(tool_id: str, config: dict | None = None) -> dict:
    return {"tool_id": tool_id, "config": config or {}}


def test_agent_tools_agentga_tanlangan_toollarni_beradi():
    """Agentga tanlangan HAR bir tool modelga yetib borishi shart.

    Regressiya: ilgari `build_tools` faqat 5 ta info-toolni tanir, qolganini
    JIMGINA tashlab yuborardi — UI 8 ta vosita ko'rsatsa ham modelga 3 tasi
    borardi va yon-ta'sirli toollar (telegram) hech qachon chaqirilmasdi.
    """
    defs = agent_tools.build_tools(
        [
            _spec("islam.prayer_times"),
            _spec("utility.weather"),
            _spec("messaging.telegram_send"),
            _spec("bogus.x"),
        ]
    )
    names = {d["name"] for d in defs}
    assert "islam_prayer_times" in names
    assert "utility_weather" in names
    assert "messaging_telegram_send" in names  # yon-ta'sirli, lekin TANLANGAN
    assert "bogus_x" not in names  # implementatsiyasi yo'q — chiqarilmaydi
    assert all("." not in n for n in names)  # Claude tool-nomi nuqta qabul qilmaydi


def test_agent_tools_ulangan_konnektor_tool_boladi():
    """Konnektor = bitta tool, amallari `action` enum'ida."""
    spec = _spec(
        "connector.telegram-bot",
        {
            "connector_id": "telegram-bot",
            "name": "Telegram Bot",
            "description": "Send real messages via a Telegram bot.",
            "actions": [
                {
                    "id": "send_message",
                    "description": "Sends a text message to a chat.",
                    "params": [
                        {"key": "chat_id", "type": "string", "required": True},
                        {"key": "text", "type": "string", "required": True},
                    ],
                },
                {"id": "get_updates", "description": "Reads recent messages.", "params": []},
            ],
        },
    )
    defs = agent_tools.build_tools([spec])
    assert len(defs) == 1
    tool = defs[0]
    assert tool["name"] == "connector_telegram_bot"
    assert tool["input_schema"]["properties"]["action"]["enum"] == ["send_message", "get_updates"]
    # Parametrlar tavsifga yoziladi — `params` erkin obyekt bo'lgani uchun
    # model nimani to'ldirishni faqat shu yerdan biladi.
    assert "chat_id:string" in tool["description"]
    # Ijro xaritasi build bilan BIR XIL nom qoidasidan foydalanadi.
    assert agent_tools.connector_targets([spec]) == {"connector_telegram_bot": "telegram-bot"}


def test_agent_tools_konnektor_amali_invoke_ga_ketadi(monkeypatch):
    """Model konnektor toolini chaqirsa — NestJS `internal/invoke` ga boradi."""
    seen: dict = {}

    async def fake_invoke(connector_id, action, params=None, user_id="", agent_id=""):
        seen.update(
            {"connector_id": connector_id, "action": action, "params": params,
             "user_id": user_id, "agent_id": agent_id}
        )
        return {"ok": True}

    monkeypatch.setattr(agent_tools, "connector_invoke", fake_invoke)
    out = asyncio.run(
        agent_tools.run_tool(
            "connector_telegram_bot",
            {"action": "send_message", "params": {"chat_id": "42", "text": "salom"}},
            agent_tools.ToolCtx(user_id="u1", agent_id="a1"),
            {"connector_telegram_bot": "telegram-bot"},
        )
    )
    assert out == {"ok": True}
    assert seen == {
        "connector_id": "telegram-bot",
        "action": "send_message",
        "params": {"chat_id": "42", "text": "salom"},
        "user_id": "u1",
        "agent_id": "a1",
    }


def test_agent_tools_nomalum_tool_xato_beradi():
    out = asyncio.run(agent_tools.run_tool("bogus_name", {}, agent_tools.ToolCtx()))
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


class _ToolCallingLLM:
    """Birinchi chaqiruvda tool so'raydi, ikkinchisida yakuniy matn beradi."""

    def __init__(self) -> None:
        self.calls = 0
        self.seen_messages: list = []

    def bind_tools(self, tool_defs):
        self.bound = tool_defs
        return self

    async def ainvoke(self, messages):
        self.calls += 1
        self.seen_messages = messages
        if self.calls == 1:
            return _FakeAI(
                "",
                [{"name": "connector_telegram_bot",
                  "args": {"action": "send_message", "params": {"chat_id": "42", "text": "salom"}},
                  "id": "call_1"}],
            )
        return _FakeAI("Xabar yuborildi.", [])


class _FakeAI:
    def __init__(self, text: str, tool_calls: list) -> None:
        self.content = text
        self.tool_calls = tool_calls


def _connector_definition() -> agent_engine.AgentDefinition:
    return agent_engine.AgentDefinition(
        agent_id="a1",
        name="Do'kon yordamchisi",
        system_prompt="sp",
        tools=[
            agent_engine.ToolSpec(
                tool_id="connector.telegram-bot",
                config={
                    "connector_id": "telegram-bot",
                    "name": "Telegram Bot",
                    "description": "Send real messages.",
                    "actions": [
                        {"id": "send_message", "description": "Sends a message.",
                         "params": [{"key": "chat_id", "type": "string", "required": True}]},
                    ],
                },
            )
        ],
    )


def test_langgraph_yoli_haqiqiy_tool_chaqiradi(monkeypatch):
    """REGRESSIYA: `_reason_node` ilgari `pending_tool_calls` ni DOIM bo'sh
    qaytarardi, ya'ni `execute_tools` tuguniga yo'l hech qachon ochilmasdi va
    bu yo'lda tool CHAQIRISH umuman mumkin emas edi (vositalar faqat
    system-prompt matnida sanab o'tilardi)."""
    seen: dict = {}

    async def fake_invoke(connector_id, action, params=None, user_id="", agent_id=""):
        seen.update({"connector_id": connector_id, "action": action, "params": params,
                     "user_id": user_id, "agent_id": agent_id})
        return {"ok": True, "data": {"message_id": 7}}

    monkeypatch.setattr(agent_tools, "connector_invoke", fake_invoke)

    eng = agent_engine.AgentEngine(_connector_definition(), agent_engine.registry)
    llm = _ToolCallingLLM()
    eng.llm = llm
    out = asyncio.run(eng.graph.ainvoke(_state("42 ga salom yubor")))

    # 1) Tool sxemasi modelga HAQIQATAN bog'landi (matnli ro'yxat emas).
    assert [d["name"] for d in llm.bound] == ["connector_telegram_bot"]
    # 2) Konnektor haqiqatan chaqirildi, foydalanuvchi/agent konteksti bilan.
    assert seen == {
        "connector_id": "telegram-bot",
        "action": "send_message",
        "params": {"chat_id": "42", "text": "salom"},
        "user_id": "u1",
        "agent_id": "a1",
    }
    # 3) Natija modelga qaytarildi va u yakuniy javob berdi (2 aylanish).
    assert llm.calls == 2
    assert out["messages"][-1]["content"] == "Xabar yuborildi."
    tool_msgs = [m for m in out["messages"] if m.get("role") == "tool"]
    assert len(tool_msgs) == 1
    assert tool_msgs[0]["tool_call_id"] == "call_1"
    assert "message_id" in tool_msgs[0]["content"]


def test_langgraph_yoli_ruxsatsiz_tool_ijroni_yiqitmaydi(monkeypatch):
    """Ruxsatsiz tool nomi — 500 emas, modelga qaytariladigan xato."""

    class _BadToolLLM(_ToolCallingLLM):
        async def ainvoke(self, messages):
            self.calls += 1
            if self.calls == 1:
                return _FakeAI("", [{"name": "soliq_uz_hammasi", "args": {}, "id": "c1"}])
            return _FakeAI("Kechirasiz, bunga ruxsatim yo'q.", [])

    eng = agent_engine.AgentEngine(_connector_definition(), agent_engine.registry)
    eng.llm = _BadToolLLM()
    out = asyncio.run(eng.graph.ainvoke(_state("soliq ma'lumotini ol")))

    tool_msgs = [m for m in out["messages"] if m.get("role") == "tool"]
    assert "ruxsatsiz tool" in tool_msgs[0]["content"]
    assert out["messages"][-1]["content"] == "Kechirasiz, bunga ruxsatim yo'q."


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


# ----------------------------------------------------------------
# FREE TARIF — OpenRouter ko'p-model zanjiri (2026-08-16).
#
# Bepul modellar HISOB darajasida cheklangan (20/daq, 50 yoki 1000/kun), ya'ni
# bitta model 429 berishi NORMAL holat, xato emas. Zanjir shuning uchun bor.
# ----------------------------------------------------------------



class _FakeHttpResp:
    def __init__(self, status: int, payload: dict | None = None):
        self.status_code = status
        self._payload = payload or {}

    def json(self):
        return self._payload


def _msg(content: str = "javob", tool_calls=None):
    return {
        "choices": [{"message": {"content": content, "tool_calls": tool_calls}}]
    }


class _FakeClient:
    """`httpx.AsyncClient` o'rniga — har chaqiruvda navbatdagi javobni beradi."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.models_tried: list[str] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, headers=None, json=None):
        self.models_tried.append(json["model"])
        nxt = self.responses.pop(0)
        if isinstance(nxt, Exception):
            raise nxt
        return nxt


def _patch_client(monkeypatch, client):
    monkeypatch.setattr(openrouter_client.httpx, "AsyncClient", lambda **kw: client)
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")


def test_openrouter_birinchi_ishlagan_modelda_toxtaydi(monkeypatch):
    client = _FakeClient([_FakeHttpResp(200, _msg("salom"))])
    _patch_client(monkeypatch, client)

    out = asyncio.run(openrouter_client.complete(system="s", messages=[{"role": "user", "content": "u"}]))
    assert out["text"] == "salom"
    assert out["model"] == openrouter_client.DEFAULT_FREE_MODELS[0]
    assert len(client.models_tried) == 1  # keyingilarga umuman tegilmadi


def test_openrouter_429_da_keyingi_modelga_otadi(monkeypatch):
    # 1-model 429 (kunlik/daqiqalik chegara), 2-model 503, 3-model ishlaydi.
    client = _FakeClient([_FakeHttpResp(429), _FakeHttpResp(503), _FakeHttpResp(200, _msg("uchinchidan"))])
    _patch_client(monkeypatch, client)

    out = asyncio.run(openrouter_client.complete(system="s", messages=[{"role": "user", "content": "u"}]))
    assert out["text"] == "uchinchidan"
    assert client.models_tried == openrouter_client.DEFAULT_FREE_MODELS[:3]
    assert [a.get("status") for a in out["attempts"]] == [429, 503, 200]


def test_openrouter_tarmoq_uzilishi_ham_keyingi_modelga_otadi(monkeypatch):
    client = _FakeClient([RuntimeError("timeout"), _FakeHttpResp(200, _msg("ikkinchidan"))])
    _patch_client(monkeypatch, client)

    out = asyncio.run(openrouter_client.complete(system="s", messages=[{"role": "user", "content": "u"}]))
    assert out["text"] == "ikkinchidan"
    assert out["attempts"][0]["error"] == "RuntimeError"


def test_openrouter_hamma_model_tugasa_aniq_xato(monkeypatch):
    n = len(openrouter_client.DEFAULT_FREE_MODELS)
    client = _FakeClient([_FakeHttpResp(429)] * n)
    _patch_client(monkeypatch, client)

    with pytest.raises(openrouter_client.NoFreeModelAvailable):
        asyncio.run(openrouter_client.complete(system="s", messages=[{"role": "user", "content": "u"}]))
    assert len(client.models_tried) == n


def test_openrouter_kalitsiz_darhol_xato(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(openrouter_client.NoFreeModelAvailable):
        asyncio.run(openrouter_client.complete(system="s", messages=[]))


def test_openrouter_model_royxati_env_bilan_almashadi(monkeypatch):
    monkeypatch.setenv("OPENROUTER_FREE_MODELS", "a/b:free, c/d:free")
    assert openrouter_client.free_models() == ["a/b:free", "c/d:free"]


def test_openrouter_tool_sxemasi_openai_shakliga_ogiriladi():
    anthropic_tools = agent_tools.build_tools([{"tool_id": "utility.weather", "config": {}}])
    openai_tools = openrouter_client.to_openai_tools(anthropic_tools)
    assert openai_tools[0]["type"] == "function"
    assert openai_tools[0]["function"]["name"] == "utility_weather"
    # `input_schema` -> `parameters` (nom farqi; mazmun bir xil qoladi)
    assert openai_tools[0]["function"]["parameters"] == anthropic_tools[0]["input_schema"]


def test_openrouter_buzuq_tool_argumenti_javobni_yiqitmaydi():
    """Kichik bepul modellar ba'zan yaroqsiz JSON chiqaradi — bu butun
    javobni yiqitmasligi kerak, tool o'zi 'parametr yo'q' deb javob beradi."""
    calls = openrouter_client.parse_tool_calls(
        {"tool_calls": [{"id": "c1", "function": {"name": "utility_weather", "arguments": "{buzuq"}}]}
    )
    assert calls == [{"id": "c1", "name": "utility_weather", "args": {}}]


def test_free_tarif_oqimi_konnektor_toolini_chaqiradi(monkeypatch):
    """Free tarif OpenRouter zanjiridan o'tadi VA tool-calling saqlanadi.

    Bu — mahsulotning butun qiymati: bepul foydalanuvchi ham konnektorini
    ishlata olishi kerak, aks holda free tarif faqat "chat" bo'lib qoladi.
    """
    import streaming

    calls: list[dict] = []

    async def fake_complete(*, system, messages, tools=None, max_tokens=2048, timeout=90.0):
        calls.append({"messages": list(messages), "tools": tools})
        if len(calls) == 1:
            # `complete()` Anthropic shaklini oladi va OpenAI'ga O'ZI o'giradi
            # (yagona tool-quruvchi — free va pullik tarif ajralib ketmasin).
            assert any(t["name"] == "connector_telegram_bot" for t in tools)
            return {
                "text": "Yuboraman.",
                "tool_calls": [{"id": "c1", "name": "connector_telegram_bot",
                                "args": {"action": "send_message", "params": {"chat_id": "42"}}}],
                "model": "nvidia/nemotron-3-ultra-550b-a55b:free",
                "attempts": [],
            }
        return {"text": "Yuborildi.", "tool_calls": [], "model": "x:free", "attempts": []}

    async def fake_invoke(connector_id, action, params=None, user_id="", agent_id=""):
        return {"ok": True}

    monkeypatch.setattr(streaming.openrouter_client, "complete", fake_complete)
    monkeypatch.setattr(agent_tools, "connector_invoke", fake_invoke)

    definition = {
        "agent_id": "a1",
        "name": "Do'kon",
        "system_prompt": "sp",
        "tools": [{
            "tool_id": "connector.telegram-bot",
            "config": {"connector_id": "telegram-bot", "name": "Telegram Bot", "description": "d",
                       "actions": [{"id": "send_message", "description": "s", "params": []}]},
        }],
    }

    async def run():
        return [json.loads(e) async for e in streaming.stream_agent_response(
            agent_definition=definition, user_id="u1", message="42 ga salom yubor", tier="free")]

    events = asyncio.run(run())
    kinds = [e["type"] for e in events]
    assert "tool_result" in kinds           # tool HAQIQATAN chaqirildi
    assert kinds[-1] == "done"
    assert events[-1]["demo_mode"] is False  # demo emas — real javob
    # Ikki aylanish: tool so'raldi -> natija qaytdi -> yakuniy matn
    assert len(calls) == 2
    # 2-aylanishda tool natijasi OpenAI shaklida qaytarilgan
    assert calls[1]["messages"][-1]["role"] == "tool"
    assert calls[1]["messages"][-1]["tool_call_id"] == "c1"


def test_free_tarif_hamma_model_tugasa_demo_BERMAYDI(monkeypatch):
    """Zanjir tugasa aniq xato — demo-javob emas.

    Demo javob "ishladi" degan yolg'on taassurot qoldirardi va foydalanuvchi
    qayta urinish kerakligini bilmasdi.
    """
    import streaming

    async def fake_complete(**kw):
        raise streaming.openrouter_client.NoFreeModelAvailable("hammasi 429")

    monkeypatch.setattr(streaming.openrouter_client, "complete", fake_complete)

    async def run():
        return [json.loads(e) async for e in streaming.stream_agent_response(
            agent_definition={"agent_id": "a1", "name": "A", "system_prompt": "sp", "tools": []},
            user_id="u1", message="salom", tier="free")]

    events = asyncio.run(run())
    assert events[-1]["type"] == "error"
    assert events[-1]["reason"] == "free_models_unavailable"
    assert all(e["type"] != "done" for e in events)  # "muvaffaqiyat" ko'rsatilmaydi


def test_pullik_tarif_openrouter_ga_UMUMAN_bormaydi(monkeypatch):
    """Regressiya qulfi: pullik oqim o'zgarmagan — OpenRouter chaqirilmaydi."""
    import streaming

    async def boom(**kw):
        raise AssertionError("pullik tarif OpenRouter'ga bormasligi kerak")

    monkeypatch.setattr(streaming.openrouter_client, "complete", boom)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    async def run():
        return [json.loads(e) async for e in streaming.stream_agent_response(
            agent_definition={"agent_id": "a1", "name": "A", "system_prompt": "sp", "tools": []},
            user_id="u1", message="salom", tier="paid")]

    events = asyncio.run(run())
    # Kalitsiz pullik yo'l demo rejimga tushadi (eski, o'zgarmagan xulq).
    assert events[-1]["type"] == "done"
    assert events[-1]["demo_mode"] is True
