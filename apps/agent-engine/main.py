"""
AgentNet — Agent Engine FastAPI (to'liq versiya)
"""
import json
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

import agentos as agentos_engine
import ethics as ethics_engine
import fusion as fusion_engine
import goal_engine
import knowledge_sync
import life_twin
import supermode as supermode_engine
from agent_engine import AgentDefinition, AgentEngine, registry
from halal_filter import Action, HalalFilter
from role_detection import detect_role, domain_profile, domains_summary
from streaming import stream_agent_response

# Tool larni register qilish
from tools.islam_tools import prayer_times, quran_surah
from tools.health_tools import symptom_check, calorie_estimate
from tools.finance_tools import get_transactions
from tools.calendar_tools import get_events
from tools.messaging_tools import telegram_send
from tools.utility_tools import weather, currency_rates

halal_filter = HalalFilter()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Async tool wrapper
    import inspect

    def make_sync_wrapper(async_fn):
        def wrapper(config: dict) -> Any:
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as pool:
                        future = pool.submit(asyncio.run, async_fn(**config))
                        return future.result()
                else:
                    return loop.run_until_complete(async_fn(**config))
            except Exception as e:
                return {"xato": str(e)}
        return wrapper

    # Toollarni ro'yxatdan o'tkazish
    registry.register("islam.prayer_times",      make_sync_wrapper(prayer_times))
    registry.register("islam.quran_surah",       make_sync_wrapper(quran_surah))
    registry.register("health.symptom_check",    make_sync_wrapper(symptom_check))
    registry.register("health.calorie_estimate", make_sync_wrapper(calorie_estimate))
    registry.register("finance.get_transactions",make_sync_wrapper(get_transactions))
    registry.register("calendar.get_events",     make_sync_wrapper(get_events))
    registry.register("messaging.telegram_send", make_sync_wrapper(telegram_send))
    registry.register("finance.currency_rates",  make_sync_wrapper(currency_rates))
    registry.register("utility.weather",          make_sync_wrapper(weather))
    registry.register("knowledge.search",         make_sync_wrapper(knowledge_sync.knowledge_search_tool))

    print("✅ AgentNet Agent Engine ishga tushdi")
    print(f"   Ro'yxatdagi toollar: {registry.available()}")
    yield
    print("Agent Engine to'xtatildi")


app = FastAPI(
    title="AgentNet Agent Engine",
    description="LangGraph + Claude asosida no-code agent orchestration",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------------------------------------------
# Sxemalar
# ----------------------------------------------------------------

class RunAgentRequest(BaseModel):
    agent_definition: dict[str, Any]
    user_id: str
    message: str
    conversation_id: str | None = None
    conversation_history: list[dict] | None = None
    profession: str = ""  # halal filter chegara-holatlari uchun kontekst


class HalalCheckRequest(BaseModel):
    text: str
    agent_name: str = ""
    direction: str = "kiruvchi"


class RoleDetectRequest(BaseModel):
    text: str
    language: str = "en"  # en | ru | uz


class TwinFactIn(BaseModel):
    category: str = "other"
    label: str
    value: str


class WhatIfRequest(BaseModel):
    question: str
    facts: list[dict[str, Any]] = []
    goals: list[str] = []
    profession: str = ""
    language: str = "en"


class ExtractRequest(BaseModel):
    text: str
    language: str = "en"


class DecomposeRequest(BaseModel):
    goal_text: str
    facts: list[dict[str, Any]] = []
    profession: str = ""
    language: str = "en"


class ExecuteTaskRequest(BaseModel):
    task: dict[str, Any]
    facts: list[dict[str, Any]] = []
    goal_title: str = ""
    profession: str = ""
    language: str = "en"


class FusionRequest(BaseModel):
    problem: str
    roles: list[str] = []
    facts: list[dict[str, Any]] = []
    profession: str = ""
    language: str = "en"


class EthicsRequest(BaseModel):
    action: str
    values: dict[str, Any] | None = None
    profession: str = ""
    language: str = "en"


class KnowledgeRequest(BaseModel):
    query: str
    language: str = "en"
    city: str = "Tashkent"


class SuperModeRequest(BaseModel):
    command: str
    facts: list[dict[str, Any]] = []
    goals: list[dict[str, Any]] = []
    values: dict[str, Any] | None = None
    profession: str = ""
    city: str = "Tashkent"
    language: str = "en"


class AgentOsRequest(BaseModel):
    command: str
    org_name: str = "Company"
    org_kind: str = "company"
    industry: str = ""
    roles: list[str] | None = None
    values: dict[str, Any] | None = None
    language: str = "en"


async def _guard(text: str, agent_name: str, profession: str = "") -> None:
    """Har bir aqlli endpoint kirishi Halal Filter'dan o'tadi — istisnosiz."""
    check = await halal_filter.classify(text, agent_name=agent_name, direction="kiruvchi", profession=profession)
    if check.action == Action.BLOCK:
        raise HTTPException(
            status_code=422,
            detail={"blocked": True, "reason": check.reasoning, "category": str(check.category)},
        )


# ----------------------------------------------------------------
# Endpointlar
# ----------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "service": "agent-engine", "tools": registry.available()}


@app.post("/agents/run")
async def run_agent(req: RunAgentRequest):
    """Oddiy (bloklangan) agent ijrosi — streaming emas."""
    try:
        definition = AgentDefinition.model_validate(req.agent_definition)
        engine = AgentEngine(definition, registry)
        result = await engine.run(req.user_id, req.message)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/agents/stream")
async def stream_agent(req: RunAgentRequest):
    """SSE streaming agent ijrosi — real-time token chiqishi."""
    async def event_generator():
        try:
            async for event in stream_agent_response(
                agent_definition=req.agent_definition,
                user_id=req.user_id,
                message=req.message,
                conversation_history=req.conversation_history,
                profession=req.profession,
            ):
                yield event
        except Exception as e:
            yield json.dumps({"type": "error", "message": str(e)}, ensure_ascii=False)

    return EventSourceResponse(event_generator(), media_type="text/event-stream")


@app.post("/halal/check")
async def halal_check(req: HalalCheckRequest):
    """Matnni Halal Filter orqali tekshirish."""
    result = await halal_filter.classify(
        req.text, agent_name=req.agent_name, direction=req.direction
    )
    return {
        "category": result.category,
        "confidence": result.confidence,
        "reasoning": result.reasoning,
        "action": result.action,
        "layer": result.layer,
    }


@app.get("/tools/available")
async def list_tools():
    return {"tools": registry.available()}


# ----------------------------------------------------------------
# Adaptiv yadro: kasb-aniqlash va tavsiyalar
# ----------------------------------------------------------------


@app.post("/role/detect")
async def role_detect(req: RoleDetectRequest):
    """Onboarding matnidan kasb/soha profilini aniqlaydi.

    Kirish matni avval Halal Filter'dan o'tadi — adaptiv yadro ham
    filter qatlamini chetlab o'tmaydi.
    """
    check = await halal_filter.classify(req.text, agent_name="role-detection", direction="kiruvchi")
    if check.action == Action.BLOCK:
        raise HTTPException(
            status_code=422,
            detail={"blocked": True, "reason": check.reasoning, "category": str(check.category)},
        )
    return await detect_role(req.text, req.language)


@app.get("/role/domains")
async def role_domains():
    """Barcha soha profillari xulosasi."""
    return {"domains": domains_summary()}


@app.get("/role/domains/{slug}")
async def role_domain(slug: str, language: str = "en"):
    """Saqlangan domain uchun tavsiyalarni qayta olish."""
    return domain_profile(slug, language)


# ----------------------------------------------------------------
# WOW 1: Life Twin — raqamli egizak
# ----------------------------------------------------------------


@app.post("/twin/whatif")
async def twin_whatif(req: WhatIfRequest):
    await _guard(req.question, "life-twin", req.profession)
    return await life_twin.whatif(req.question, req.facts, req.goals, req.profession, req.language)


@app.post("/twin/extract")
async def twin_extract(req: ExtractRequest):
    # Ekstraksiya kirishi ham filtrlanadi — bloklangan matndan fakt olinmaydi
    await _guard(req.text, "life-twin-extract")
    return await life_twin.extract_facts(req.text, req.language)


# ----------------------------------------------------------------
# WOW 2: Autonomous Goal Achievement
# ----------------------------------------------------------------


@app.post("/goals/decompose")
async def goals_decompose(req: DecomposeRequest):
    await _guard(req.goal_text, "goal-engine", req.profession)
    return await goal_engine.decompose(req.goal_text, req.facts, req.profession, req.language)


@app.post("/goals/execute-task")
async def goals_execute_task(req: ExecuteTaskRequest):
    await _guard(str(req.task.get("title", "")), "goal-engine", req.profession)
    return await goal_engine.execute_task(req.task, req.facts, req.goal_title, req.profession, req.language)


# ----------------------------------------------------------------
# WOW 3: Cross-Profession Agent Fusion
# ----------------------------------------------------------------


@app.post("/fusion/run")
async def fusion_run(req: FusionRequest):
    await _guard(req.problem, "fusion", req.profession)
    roles = req.roles or fusion_engine.suggest_roles(req.problem)
    return await fusion_engine.fuse(req.problem, roles, req.facts, req.profession, req.language)


@app.get("/fusion/roles")
async def fusion_roles(language: str = "en"):
    return {"roles": fusion_engine.roles_catalog(language)}


# ----------------------------------------------------------------
# WOW 4: Ethical Decision Engine
# ----------------------------------------------------------------


@app.post("/ethics/evaluate")
async def ethics_evaluate(req: EthicsRequest):
    # Halal filter ethics.evaluate ichida chaqiriladi (1-bosqich) — bu yerda
    # takror guard qo'yilmaydi, chunki BLOCK natija REJECT verdiktga aylanadi.
    return await ethics_engine.evaluate(req.action, req.values, req.profession, req.language)


# ----------------------------------------------------------------
# WOW 5: Real-time Global Knowledge Sync
# ----------------------------------------------------------------


@app.post("/knowledge/search")
async def knowledge_search(req: KnowledgeRequest):
    await _guard(req.query, "knowledge-sync")
    return await knowledge_sync.search(req.query, req.language, req.city)


# ----------------------------------------------------------------
# "One Command" Super Mode — beshtasi birga
# ----------------------------------------------------------------


@app.post("/supermode/run")
async def supermode_run(req: SuperModeRequest):
    await _guard(req.command, "supermode", req.profession)
    return await supermode_engine.run(
        req.command, req.facts, req.goals, req.values, req.profession, req.city, req.language
    )


# ----------------------------------------------------------------
# AgentOS — korxona/enterprise orkestratori
# ----------------------------------------------------------------


@app.post("/agentos/run")
async def agentos_run(req: AgentOsRequest):
    await _guard(req.command, "agentos-orchestrator")
    return await agentos_engine.run_command(
        req.command, req.org_name, req.org_kind, req.industry, req.roles, req.values, req.language
    )


@app.get("/agentos/csuite")
async def agentos_csuite(language: str = "en"):
    return {"roles": agentos_engine.csuite_catalog(language)}


# ----------------------------------------------------------------
# Built-in agentlar uchun endpoint
# ----------------------------------------------------------------

@app.get("/agents/builtin")
async def get_builtin_agents():
    """Tayyor (built-in) agentlar — universal, kasbiy, natija beruvchi.

    Diniy/shaxsiy-ibodat agentlari yadro namoyishidan olib tashlandi:
    platforma so'zда emas, amalda ishonchli — universal Ethics Engine har
    bir amalni qadriyatlarga solishtiradi (islomiy/dunyoviy/aralash tanlab
    bo'ladi). Kerak bo'lsa foydalanuvchi maxsus agent o'zi qura oladi.
    """
    return {
        "agents": [
            {
                "id": "builtin-analyst",
                "name": "Business Analyst",
                "system_prompt": (
                    "You are a senior business analyst. Turn raw information into clear, "
                    "decision-ready analysis: market sizing, unit economics, competitor scans, "
                    "and prioritized recommendations with explicit assumptions. "
                    "Cite what needs verification. Always reply in the language the user writes in."
                ),
                "model": "claude-sonnet-4-6",
                "tools": [
                    {"tool_id": "knowledge.search", "config": {}},
                    {"tool_id": "finance.currency_rates", "config": {}},
                ],
            },
            {
                "id": "builtin-finance",
                "name": "Financial Advisor",
                "system_prompt": (
                    "You are a financial analysis assistant. Categorize transactions, model cash "
                    "flow and margins, and flag interest-bearing items so the user can choose a "
                    "compliant alternative if their declared values require it. Information, not "
                    "licensed advice. Always reply in the language the user writes in."
                ),
                "model": "claude-sonnet-4-6",
                "tools": [
                    {"tool_id": "finance.get_transactions", "config": {}},
                    {"tool_id": "finance.currency_rates", "config": {}},
                ],
            },
            {
                "id": "builtin-legal",
                "name": "Legal Assistant",
                "system_prompt": (
                    "You assist with legal drafting: contracts, letters, filings and clause review. "
                    "Cite the relevant legal concept when suggesting language. A drafting tool for "
                    "professionals, not legal advice for laypeople. Always reply in the language the user writes in."
                ),
                "model": "claude-sonnet-4-6",
                "tools": [],
            },
            {
                "id": "builtin-research",
                "name": "Research & Knowledge",
                "system_prompt": (
                    "You are a research assistant grounded in live sources. Pull current news, laws, "
                    "prices and facts, and always attribute them. Summarize clearly and mark anything "
                    "that needs verification. Always reply in the language the user writes in."
                ),
                "model": "claude-sonnet-4-6",
                "tools": [
                    {"tool_id": "knowledge.search", "config": {}},
                    {"tool_id": "utility.weather", "config": {}},
                ],
            },
            {
                "id": "builtin-ops",
                "name": "Operations Assistant",
                "system_prompt": (
                    "You are an operations assistant: plan schedules, draft communications, track "
                    "tasks and follow-ups, and keep the day moving. Clear, concise, action-oriented. "
                    "Always reply in the language the user writes in."
                ),
                "model": "claude-sonnet-4-6",
                "tools": [
                    {"tool_id": "calendar.get_events", "config": {}},
                    {"tool_id": "messaging.telegram_send", "config": {}},
                ],
            },
        ]
    }
