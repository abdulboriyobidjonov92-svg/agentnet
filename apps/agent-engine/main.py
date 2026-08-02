"""
AgentNet — Agent Engine FastAPI (to'liq versiya)
"""
import hmac
import json
import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

import agent_composer
import agentos as agentos_engine
import automation_planner
import business_ops
import compliance_packs
import computer_use_planner
import ethics as ethics_engine
import fusion as fusion_engine
import goal_engine
import govtech as govtech_engine
import knowledge_sync
import life_twin
import retail_forecast
import retail_intel
import supermode as supermode_engine
import trade as trade_engine
from agent_engine import AgentDefinition, AgentEngine, registry
from halal_filter import Action, HalalFilter
from role_detection import detect_role, domain_profile, domains_summary
from streaming import stream_agent_response
from tools.automation_tools import connector_invoke, web_automate
from tools.calendar_tools import get_events
from tools.finance_tools import get_transactions
from tools.health_tools import calorie_estimate, symptom_check

# Tool larni register qilish
from tools.islam_tools import prayer_times, quran_surah
from tools.messaging_tools import telegram_send
from tools.utility_tools import currency_rates, weather

halal_filter = HalalFilter()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Async tool wrapper

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
    registry.register("web.automate",             make_sync_wrapper(web_automate))
    registry.register("connector.invoke",         make_sync_wrapper(connector_invoke))

    print("AgentNet Agent Engine ishga tushdi")
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
# Ichki (server-to-server) auth — engine faqat platformaning o'z servislari
# (NestJS API va Next.js BFF) tomonidan chaqirilishi kerak. Ilgari HECH QANDAY
# auth yo'q edi: Render'da `type: web` bo'lgani uchun engine ommaviy URL'da
# ochiq turardi, ya'ni istalgan odam /agents/stream ni chaqirib ANTHROPIC
# kalitini bepul sarflashi va halal/billing/limit qatlamlarini butunlay
# chetlab o'tishi mumkin edi. Endi har so'rov `x-internal-token` bilan
# tekshiriladi (NestJS'dagi InternalTokenGuard bilan bir xil siyosat).
#
# /health — Render healthcheck uchun ochiq (token talab qilinmaydi).
_PUBLIC_DEV_DEFAULT = "agentnet-internal-dev"
_OPEN_PATHS = {"/health"}


def _is_production() -> bool:
    # Render `ENV=production` (render.yaml) yoki umumiy RENDER belgisidan
    # foydalanamiz — ikkalasidan biri bo'lsa prod deb hisoblanadi (fail-closed).
    return os.getenv("ENV", "").lower() == "production" or os.getenv("RENDER") == "true"


@app.middleware("http")
async def internal_token_guard(request: Request, call_next):
    path = request.url.path
    if request.method == "OPTIONS" or path in _OPEN_PATHS:
        return await call_next(request)

    configured = os.getenv("INTERNAL_API_TOKEN")

    # Prod'da commlik default yoki bo'sh token — fail-closed (kuchli kalit majburiy).
    if _is_production() and (not configured or configured == _PUBLIC_DEV_DEFAULT):
        return JSONResponse(
            status_code=500,
            content={"detail": "INTERNAL_API_TOKEN production uchun kuchli qiymatga sozlanishi shart"},
        )

    expected = configured or _PUBLIC_DEV_DEFAULT
    provided = request.headers.get("x-internal-token", "")
    if not hmac.compare_digest(provided, expected):
        return JSONResponse(
            status_code=401,
            content={"detail": "Faqat ichki (server-to-server) chaqiruv ruxsat etiladi"},
        )

    return await call_next(request)


# S4 qo'shimcha: haqiqiy IP-kamera monitoring (RTSP -> YOLO -> Claude Vision).
# MUHIM (M5): camera_router og'ir CV-kutubxonalarni (cv2/torch/ultralytics/onvif)
# import qiladi. Ilgari bu top-level `import camera_router` edi — shu paketlardan
# BIRORTASI o'rnatilmagan/buzilgan bo'lsa BUTUN engine ishga tushmasdi (barcha
# chat o'lardi), garchi kameradan deyarli hech kim foydalanmasa ham. Endi import
# himoyalangan: CV-stack bo'lmasa faqat /camera/* endpointlari o'chadi, engine
# (chat, halal, intellekt modullari) baribir to'liq ishga tushadi.
try:
    import camera_router

    app.include_router(camera_router.router)
    print("Kamera monitoring endpointlari ulandi (/camera/*)")
except Exception as exc:  # ImportError yoki CV-init xatosi
    print(f"Kamera moduli o'chirilgan (CV kutubxonalari yo'q/buzilgan): {exc}")


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


class ComposeAgentRequest(BaseModel):
    # Y9: tabiiy tildagi tavsif → bitta tayyor agent taklifi
    description: str
    language: str = "en"  # en | ru | uz
    profession: str = ""  # ixtiyoriy kontekst (foydalanuvchi profilidan)


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


# --- Part 1B sxemalari ---

class AutomationPlanRequest(BaseModel):
    goal: str
    page_state: dict[str, Any] | None = None
    history: list[dict[str, Any]] = []
    language: str = "en"


class AutomationSummaryRequest(BaseModel):
    goal: str
    steps: list[dict[str, Any]] = []
    language: str = "en"


class ComputerUseRequest(BaseModel):
    goal: str
    screenshot: str | None = None  # base64 (data-URL yoki xom)
    screen: dict[str, int] | None = None  # {"width":..,"height":..}
    history: list[dict[str, Any]] = []
    language: str = "en"


class ComplianceCheckRequest(BaseModel):
    text: str
    vertical: str | None = None
    language: str = "en"


class RetailAssessRequest(BaseModel):
    evidence: dict[str, Any]
    language: str = "uz"


class RetailForecastRequest(BaseModel):
    forecasts: list[dict[str, Any]] = []
    summary: dict[str, Any] = {}
    language: str = "uz"


class OpsScheduleRequest(BaseModel):
    instructions: str
    employees: list[dict[str, Any]] = []
    week_start: str | None = None
    language: str = "en"


class OpsOutboundRequest(BaseModel):
    purpose: str
    audience: str = "client"
    recipient_name: str = ""
    channel: str = "telegram"
    org_name: str = ""
    context: str = ""
    language: str = "en"


class TradeDocsRequest(BaseModel):
    shipment: dict[str, Any]
    language: str = "en"


class TradeTariffRequest(BaseModel):
    goods: str
    destination: str = "Uzbekistan"
    language: str = "en"


class TradeComplianceRequest(BaseModel):
    goods: str
    origin: str = ""
    destination: str = ""
    counterparty: str = ""
    language: str = "en"


class GovClassifyRequest(BaseModel):
    text: str
    language: str = "uz"


class GovGuideRequest(BaseModel):
    query: str
    language: str = "uz"


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
# Y9: Bir-klik agent yaratish — tabiiy til → tayyor agent taklifi
# ----------------------------------------------------------------


@app.post("/agents/compose")
async def agents_compose(req: ComposeAgentRequest):
    """Foydalanuvchi tabiiy tilda nima kerakligini yozadi → bitta tayyor,
    moslashtirilgan agent taklifi (nom, system-prompt, tool'lar, murakkablik).

    Kirish avval Halal Filter'dan o'tadi — bir-klik oqim ham filtr qatlamini
    chetlab o'tmaydi. Agent YARATILMAYDI; NestJS narxni qo'shib taklifni qaytaradi.
    """
    await _guard(req.description, "agent-composer", req.profession)
    return await agent_composer.compose(req.description, req.language, req.profession)


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


# ================================================================
# PART 1B — Platform-wide superpowers
# ================================================================

# --- S1: Universal App Control (Tier 1 — brauzer avtomatlashtirish) ---
# Brauzer (Playwright) NestJS bridge'da; bu endpointlar har qadam uchun
# LLM-first qaror qabul qiladi (kalitsiz — skriptli retseptlar).


@app.post("/automation/plan")
async def automation_plan(req: AutomationPlanRequest):
    if not req.history:  # maqsad faqat birinchi qadar Halal Filter'dan o'tadi
        await _guard(req.goal, "browser-automation")
    return await automation_planner.plan_next_step(req.goal, req.page_state, req.history, req.language)


@app.post("/automation/summarize")
async def automation_summarize(req: AutomationSummaryRequest):
    return {"summary": await automation_planner.summarize_run(req.goal, req.steps, req.language)}


@app.get("/automation/capabilities")
async def automation_capabilities():
    return automation_planner.describe_capabilities()


# --- BOSQICH 2: Kompyuter-agent (computer-use, vision) ---
# Skrinshot -> vision LLM -> piksel-harakat. Companion (foydalanuvchi mashinasi)
# bajaradi; server faqat reja beradi. DevicePermission API tomonda cheklaydi.


@app.post("/computer-use/plan")
async def computer_use_plan(req: ComputerUseRequest):
    if not req.history:
        await _guard(req.goal, "computer-use")
    return await computer_use_planner.plan_computer_step(
        req.goal, req.screenshot, req.screen, req.history, req.language
    )


@app.get("/computer-use/capabilities")
async def computer_use_capabilities():
    return computer_use_planner.describe_capabilities()


# --- S3: Vertical Compliance Packs ---


@app.get("/compliance/packs")
async def compliance_list(language: str = "en"):
    return {"packs": compliance_packs.packs_summary(language)}


@app.post("/compliance/check-output")
async def compliance_check_output(req: ComplianceCheckRequest):
    return compliance_packs.check_output(req.text, req.vertical, req.language)


# --- S4: Retail Intelligence (kamera + inventar fuziyasi) ---


@app.post("/retail/assess")
async def retail_assess(req: RetailAssessRequest):
    return await retail_intel.assess(req.evidence, req.language)


@app.post("/retail/forecast")
async def retail_forecast_endpoint(req: RetailForecastRequest):
    """Hisoblangan bashorat JSON'idan qisqa, ustuvor xulosa (agent #1)."""
    return await retail_forecast.analyze(req.forecasts, req.summary, req.language)


# --- S5: Business Operations ---


@app.post("/ops/schedule")
async def ops_schedule(req: OpsScheduleRequest):
    await _guard(req.instructions, "business-ops")
    return await business_ops.schedule_from_text(req.instructions, req.employees, req.week_start, req.language)


@app.post("/ops/outbound-draft")
async def ops_outbound(req: OpsOutboundRequest):
    await _guard(req.purpose, "business-ops")
    return await business_ops.outbound_draft(
        req.purpose, req.audience, req.recipient_name, req.channel, req.org_name, req.context, req.language
    )


# --- S6: Cross-Border Trade ---


@app.post("/trade/customs-docs")
async def trade_docs(req: TradeDocsRequest):
    await _guard(str(req.shipment.get("goods", "")), "trade")
    return await trade_engine.customs_docs(req.shipment, req.language)


@app.post("/trade/tariff")
async def trade_tariff(req: TradeTariffRequest):
    await _guard(req.goods, "trade")
    return await trade_engine.tariff_lookup(req.goods, req.destination, req.language)


@app.post("/trade/compliance")
async def trade_compliance(req: TradeComplianceRequest):
    return await trade_engine.compliance_check(req.goods, req.origin, req.destination, req.counterparty, req.language)


@app.get("/trade/tracking/{tracking_number}")
async def trade_tracking(tracking_number: str):
    return trade_engine.tracking_info(tracking_number)


@app.get("/trade/fx")
async def trade_fx(base: str = "USD", symbols: str = "UZS,EUR,RUB,CNY,KZT"):
    return await trade_engine.fx(base, symbols)


# --- S7: GovTech ---


@app.post("/govtech/classify")
async def govtech_classify(req: GovClassifyRequest):
    await _guard(req.text, "govtech-intake")
    return await govtech_engine.classify_request(req.text, req.language)


@app.post("/govtech/guide")
async def govtech_guide(req: GovGuideRequest):
    await _guard(req.query, "govtech-navigator")
    return await govtech_engine.process_guide(req.query, req.language)


@app.get("/govtech/catalog")
async def govtech_catalog(language: str = "uz"):
    return {
        "services": govtech_engine.services_catalog(language),
        "guides": govtech_engine.guides_catalog(language),
    }


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
                "model": "claude-sonnet-5",
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
                "model": "claude-sonnet-5",
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
                "model": "claude-sonnet-5",
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
                "model": "claude-sonnet-5",
                "tools": [
                    {"tool_id": "knowledge.search", "config": {}},
                    {"tool_id": "utility.weather", "config": {}},
                ],
            },
            {
                "id": "builtin-trade",
                "name": "Cross-Border Trade Agent",
                "system_prompt": (
                    "You are an import/export specialist for Central Asian businesses: customs "
                    "documentation checklists, HS/tariff reference lookups, multi-currency math and "
                    "trade-compliance screening. Duty figures are reference estimates — always tell "
                    "the user to confirm with official customs sources. Always reply in the language the user writes in."
                ),
                "model": "claude-sonnet-5",
                "vertical": "trade",
                "tools": [
                    {"tool_id": "knowledge.search", "config": {}},
                    {"tool_id": "finance.currency_rates", "config": {}},
                ],
            },
            {
                "id": "builtin-govtech",
                "name": "GovTech Navigator",
                "system_prompt": (
                    "You help citizens and mahalla/district staff navigate Uzbek government services: "
                    "classify requests, route them to the responsible office, and walk people through "
                    "multi-step processes (passport, propiska, YaTT, pension...). Procedural guidance "
                    "only — final decisions belong to the responsible agency. Always reply in the language the user writes in."
                ),
                "model": "claude-sonnet-5",
                "vertical": "government",
                "tools": [{"tool_id": "knowledge.search", "config": {}}],
            },
            {
                "id": "builtin-web-operator",
                "name": "Web Operator",
                "system_prompt": (
                    "You operate web applications on the user's behalf through a real browser: open "
                    "sites, read data, fill forms. Never submit payments or send messages unless the "
                    "user explicitly asked. Report exactly what you did and what you found. "
                    "Always reply in the language the user writes in."
                ),
                "model": "claude-sonnet-5",
                "tools": [{"tool_id": "web.automate", "config": {}}],
            },
            {
                "id": "builtin-ops",
                "name": "Operations Assistant",
                "system_prompt": (
                    "You are an operations assistant: plan schedules, draft communications, track "
                    "tasks and follow-ups, and keep the day moving. Clear, concise, action-oriented. "
                    "Always reply in the language the user writes in."
                ),
                "model": "claude-sonnet-5",
                "tools": [
                    {"tool_id": "calendar.get_events", "config": {}},
                    {"tool_id": "messaging.telegram_send", "config": {}},
                ],
            },
        ]
    }
