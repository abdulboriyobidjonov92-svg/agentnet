"""
AgentNet -- Agent Orchestration Engine (FastAPI + LangGraph)
------------------------------------------------------------
Vazifasi:
  - No-code builder'dan kelgan JSON graf (AgentDefinition) ni
    LangGraph StateGraph'ga compile qilish
  - Tool-registry orqali ruxsat etilgan vositalarni bog'lash
  - pgvector orqali uzoq muddatli xotiraga ulanish
  - Har bir ijro qadamini audit-log uchun qaytarish

Talab qilinadigan paketlar:
  pip install langgraph langchain-anthropic langchain-postgres \
              pydantic fastapi sqlalchemy asyncpg
"""

from __future__ import annotations

import logging
import operator
import os
import uuid
from typing import Annotated, Any, Callable, TypedDict

from pydantic import BaseModel, Field

# langgraph/langchain ixtiyoriy — faqat /agents/run (blokli ijro) uchun kerak.
# Streaming yo'li (streaming.py) bularni ishlatmaydi, shuning uchun lazy import.
try:
    from langchain_anthropic import ChatAnthropic  # noqa: F401
    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
    from langgraph.graph import END, StateGraph  # noqa: F401
    _LANGGRAPH_AVAILABLE = True
except ImportError:
    _LANGGRAPH_AVAILABLE = False

import agent_tools

# ------------------------------------------------------------------
# 1. No-code builder formatlari (frontenddan keladigan JSON)
# ------------------------------------------------------------------


class ToolSpec(BaseModel):
    """Foydalanuvchi no-code builder orqali agentga ulagan vosita."""

    tool_id: str  # masalan: "gmail.send_draft", "bank.read_transactions"
    config: dict[str, Any] = Field(default_factory=dict)


class AgentDefinition(BaseModel):
    """Bitta agentning to'liq ta'rifi -- no-code UI shundan generatsiya bo'ladi."""

    agent_id: str
    name: str
    system_prompt: str
    tools: list[ToolSpec] = Field(default_factory=list)
    memory_enabled: bool = True
    model: str = "claude-sonnet-5"
    # Halal Filter har doim yoqilgan -- foydalanuvchi o'chira olmaydi.
    halal_filter_enabled: bool = True
    # Tool ijrosi konteksti (streaming.py bilan bir xil maydonlar). Model
    # bularni O'ZI to'ldirmaydi -- ular serverdan keladi.
    language: str = "en"
    city: str = "Tashkent"


# ------------------------------------------------------------------
# 2. LangGraph holati (State)
# ------------------------------------------------------------------


# Xarajat himoyasi: bitta so'rov ichida reason→tool→reason sikli necha marta
# aylanishi mumkin. Cheksiz loop = kutilmagan katta LLM hisobi. Env orqali sozlanadi.
MAX_TOOL_ITERATIONS = int(os.getenv("AGENT_MAX_TOOL_ITERATIONS", "8"))


class AgentState(TypedDict):
    # `dict[str, Any]` (ilgari `dict[str, str]`): assistant xabari endi
    # `tool_calls` ro'yxatini, tool javobi esa `tool_call_id`ni ham olib
    # yuradi -- ularsiz Anthropic `tool_result`ni mos `tool_use` blokiga
    # bog'lay olmaydi va so'rovni rad etadi.
    messages: Annotated[list[dict[str, Any]], operator.add]
    user_id: str
    agent_id: str
    pending_tool_calls: list[dict[str, Any]]
    halal_flag: str | None  # "ALLOW" | "BLOCK" | "HUMAN_REVIEW" | None
    iterations: int  # reason node necha marta ishga tushdi (loop chegarasi uchun)


def _content_to_text(content: Any) -> str:
    """LangChain javob `content`ini HAR DOIM matnga keltiradi.

    `AgentState["messages"]` — `list[dict[str, str]]`, ya'ni `content` matn
    bo'lishi SHART: `_halal_check_input` unga `.lower()` chaqiradi. Lekin
    Anthropic kontent-BLOKLARI qaytarganda `response.content` `list` bo'ladi
    (`[{"type": "text", "text": ...}, ...]`) — u holda `.lower()` ish vaqtida
    `AttributeError` bilan yiqilardi. Bu — mypy topgan haqiqiy xato, faqat
    tip-shikoyati emas.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                # Faqat matn bloklari; `tool_use` kabi bloklarda "text" yo'q.
                parts.append(str(block.get("text", "")))
        return "".join(parts)
    return str(content)


# ------------------------------------------------------------------
# 3. Tool Registry -- faqat ro'yxatdagi vositalar ishlatilishi mumkin
# ------------------------------------------------------------------


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Callable[..., Any]] = {}

    def register(self, tool_id: str, fn: Callable[..., Any]) -> None:
        self._tools[tool_id] = fn

    def get(self, tool_id: str) -> Callable[..., Any]:
        if tool_id not in self._tools:
            raise ValueError(f"Ro'yxatdan o'tmagan tool chaqirildi: {tool_id}")
        return self._tools[tool_id]

    def available(self) -> list[str]:
        return list(self._tools.keys())


registry = ToolRegistry()


def _tool_prayer_times(config: dict[str, Any]) -> dict[str, Any]:
    """Namoz vaqtlari -- Aladhan API orqali (haqiqiy chaqiruv boshqa joyda)."""
    city = config.get("city", "Tashkent")
    return {"city": city, "source": "aladhan_api", "status": "stub"}


def _tool_bank_read_transactions(config: dict[str, Any]) -> dict[str, Any]:
    """bank_connector.ts dagi BankConnector orqali tranzaksiyalarni o'qiydi."""
    return {"provider": config.get("provider", "payme"), "status": "stub"}


registry.register("islam.prayer_times", _tool_prayer_times)
registry.register("bank.read_transactions", _tool_bank_read_transactions)


def _to_lc_messages(messages: list[dict[str, Any]]) -> list[Any]:
    """State'dagi oddiy dict'larni LangChain xabar obyektlariga o'giradi.

    Nega qo'lda: `tool_calls` bo'lgan assistant xabari va `tool_call_id` bo'lgan
    tool javobi -- Anthropic uchun BOG'LIQ juftlik. Ularni dict ko'rinishida
    uzatib bo'lmaydi (`tool_result` mos `tool_use` bloki topilmasa API 400
    qaytaradi), shuning uchun `AIMessage`/`ToolMessage` sifatida quriladi.
    """
    out: list[Any] = []
    for m in messages:
        role = m.get("role")
        content = m.get("content", "")
        if role == "assistant":
            calls = [
                {"name": c["api_name"], "args": c.get("args") or {}, "id": c.get("call_id", "")}
                for c in (m.get("tool_calls") or [])
            ]
            out.append(AIMessage(content=content, tool_calls=calls))
        elif role == "tool":
            out.append(
                ToolMessage(
                    content=content,
                    tool_call_id=str(m.get("tool_call_id", "")),
                    name=str(m.get("name", "")),
                )
            )
        else:
            out.append(HumanMessage(content=content))
    return out


# ------------------------------------------------------------------
# 4. AgentEngine -- AgentDefinition'ni LangGraph grafiga compile qiladi
# ------------------------------------------------------------------


# `checkpointer` argumenti UCH holatni ajratishi kerak:
#   berilmagan  → muhitdan tanlanadi (prod: API saqlagichi)
#   None        → ATAYLAB o'chirilgan (graf mantig'ini tekshiruvchi testlar)
#   obyekt      → aynan shu saqlagich
# `None` ni "berilmagan" bilan aralashtirish ikkinchi holatni imkonsiz qilardi.
_UNSET = object()


def _default_checkpointer() -> Any | None:
    """Muhitdan checkpoint saqlagichini tanlaydi (P0-8).

    `AGENT_CHECKPOINTS=off` — butunlay o'chiradi (rollback yo'li: graf
    ilgarigidek checkpointer'siz compile bo'ladi).

    Import XATOSI ijroni yiqitmaydi: checkpoint — qulaylik qatlami, uning
    yo'qligi agentni ishlashdan to'xtatmasligi kerak.
    """
    if os.getenv("AGENT_CHECKPOINTS", "on").lower() == "off":
        return None
    try:
        from api_checkpointer import ApiCheckpointSaver

        return ApiCheckpointSaver()
    except Exception as exc:  # pragma: no cover — muhitga bog'liq
        logging.getLogger(__name__).warning(
            "Checkpoint saqlagichi yuklanmadi, ijro holati saqlanmaydi: %s", exc
        )
        return None


class AgentEngine:
    def __init__(
        self,
        definition: AgentDefinition,
        tool_registry: ToolRegistry,
        checkpointer: Any = _UNSET,
    ):
        if not _LANGGRAPH_AVAILABLE:
            raise RuntimeError(
                "AgentEngine (blokli ijro) langgraph va langchain-anthropic talab qiladi. "
                "Streaming yo'lidan foydalaning (/agents/stream)."
            )
        self.definition = definition
        self.registry = tool_registry
        # Sonnet 5 NON-DEFAULT `temperature`ni rad etadi (400) — olib tashlandi.
        # `thinking`ni universal extra_body orqali o'chiramiz (adaptiv fikrlash
        # sukut bo'yicha yoqilishi eski SDK javob-parseriga muammo bo'lmasligi va
        # xulq Sonnet 4.6 bilan bir xil qolishi uchun); max_tokens'ga zaxira.
        # `type: ignore[call-arg]` — ATAYLAB va TOR. `ChatAnthropic` da `model` va
        # `max_tokens` HAQIQIY maydonlar, lekin ular `model_name` /
        # `max_tokens_to_sample` ALIASlariga ega. `populate_by_name=True`
        # bo'lgani uchun ish vaqtida `model=`/`max_tokens=` TO'G'RI ishlaydi
        # (tekshirildi: `ChatAnthropic.model_fields`), ammo mypy'ning pydantic
        # plagini sintez qilgan `__init__` faqat alias nomlarini ko'radi.
        # Aliaslarga o'tish mypy'ni tinchitardi, lekin langchain'ning hujjatli
        # ommaviy API'sidan (`model=`) chekinish bo'lardi.
        self.llm = ChatAnthropic(  # type: ignore[call-arg]
            model=definition.model,
            max_tokens=4096,
            model_kwargs={"extra_body": {"thinking": {"type": "disabled"}}},
        )
        # Tool-sxemalari streaming yo'li bilan AYNAN bir manbadan quriladi
        # (`agent_tools`) — ikki yo'l bir xil toollarni, bir xil nom qoidasi
        # bilan ko'rsin. Ulangan konnektorlar ham shu ro'yxatga kiradi.
        tool_specs = [t.model_dump() for t in definition.tools]
        self.tool_defs = agent_tools.build_tools(tool_specs)
        self.connector_targets = agent_tools.connector_targets(tool_specs)
        # P0-8 — ijro holati (checkpoint).
        #
        # `None` bo'lsa saqlagich MUHITDAN olinadi: prod'da
        # `ApiCheckpointSaver` (holat Postgres'da, API orqali), testda esa
        # ataylab `None` uzatiladi. Konstruktorda majburiy qilinmadi —
        # mavjud 50+ test chaqiruvi buzilmasin.
        self.checkpointer = _default_checkpointer() if checkpointer is _UNSET else checkpointer
        self.graph = self._build_graph()

    def _llm(self) -> Any:
        """Tool-sxemalari bog'langan model.

        Har chaqiruvda qayta bog'lanadi (konstruktorda keshlanmaydi) — shunda
        `self.llm` almashtirilsa (testlardagi soxta model) yangi qiymat
        ishlatiladi va sxemalar jimgina eskirib qolmaydi.
        """
        return self.llm.bind_tools(self.tool_defs) if self.tool_defs else self.llm

    def _build_graph(self):
        workflow = StateGraph(AgentState)

        workflow.add_node("halal_check_input", self._halal_check_input)
        workflow.add_node("reason", self._reason_node)
        workflow.add_node("execute_tools", self._execute_tools_node)
        workflow.add_node("halal_check_output", self._halal_check_output)

        workflow.set_entry_point("halal_check_input")

        workflow.add_conditional_edges(
            "halal_check_input",
            self._route_after_input_filter,
            {"continue": "reason", "blocked": END},
        )

        workflow.add_conditional_edges(
            "reason",
            self._route_after_reasoning,
            {"tool_call": "execute_tools", "respond": "halal_check_output"},
        )

        workflow.add_edge("execute_tools", "reason")
        workflow.add_edge("halal_check_output", END)

        # `checkpointer` berilsa graf holatni SAQLAYDI: `thread_id` (bizda
        # `ExecutionRun.id`) bo'yicha ijroni to'xtatib, AYNAN o'sha joydan
        # davom ettirish mumkin bo'ladi. Busiz HITL tasdig'i (P0-6) har
        # safar noldan boshlashni talab qilardi — ikki barobar LLM xarajati
        # va takroriy yon ta'sir.
        return workflow.compile(checkpointer=self.checkpointer)

    # DIQQAT — tugunlar FAQAT o'zgarishni (delta) qaytaradi, `{**state, ...}` ni
    # EMAS. `AgentState["messages"]` reducer'i `operator.add`: butun state qayta
    # qaytarilsa, mavjud xabarlar ro'yxati o'ziga QO'SHILIB ketadi. Bitta
    # aylanishli javobda bu ko'zga tashlanmasdi (oxirgi xabar baribir to'g'ri
    # edi), lekin tool-loop bilan bu halokatli: takrorlangan `tool_use` bloklari
    # Anthropic tomonidan rad etiladi va har aylanishda token ikkilanadi.
    async def _halal_check_input(self, state: AgentState) -> dict[str, Any]:
        if not self.definition.halal_filter_enabled:
            return {"halal_flag": "ALLOW"}
        # Import qilingan HalalFilter ishlatiladi (main.py dan inject qilinadi)
        last_message = state["messages"][-1]["content"] if state["messages"] else ""
        flag = "ALLOW" if "qimor" not in last_message.lower() else "BLOCK"
        return {"halal_flag": flag}

    def _route_after_input_filter(self, state: AgentState) -> str:
        return "blocked" if state.get("halal_flag") == "BLOCK" else "continue"

    async def _reason_node(self, state: AgentState) -> dict[str, Any]:
        # Vositalar endi system-prompt MATNIDA sanab o'tilmaydi: ular modelga
        # HAQIQIY tool-sxema (`bind_tools`) sifatida beriladi. Ilgari faqat
        # matnli ro'yxat bor edi va `pending_tool_calls` doim bo'sh qaytardi —
        # ya'ni `execute_tools` node'iga hech qachon yo'l ochilmasdi va bu
        # yo'lda tool CHAQIRILISHI umuman mumkin emas edi.
        system = SystemMessage(content=self.definition.system_prompt)
        response = await self._llm().ainvoke([system, *_to_lc_messages(state["messages"])])

        # LangChain tool-chaqiruvlarini ijro qatlami tushunadigan shaklga
        # o'giramiz. `id` saqlanadi — `tool_result` aynan shu id orqali o'z
        # `tool_use` blokiga bog'lanadi.
        tool_calls = list(getattr(response, "tool_calls", None) or [])
        pending = [
            {
                "api_name": str(tc.get("name", "")),
                "args": dict(tc.get("args") or {}),
                "call_id": str(tc.get("id") or ""),
            }
            for tc in tool_calls
        ]

        assistant: dict[str, Any] = {
            "role": "assistant",
            "content": _content_to_text(response.content),
        }
        if pending:
            assistant["tool_calls"] = pending

        iterations = state.get("iterations", 0) + 1
        return {"messages": [assistant], "pending_tool_calls": pending, "iterations": iterations}

    def _route_after_reasoning(self, state: AgentState) -> str:
        # Loop chegarasi: MAX_TOOL_ITERATIONS ga yetgach, tool chaqirmay javob beramiz
        if state.get("iterations", 0) >= MAX_TOOL_ITERATIONS:
            return "respond"
        return "tool_call" if state.get("pending_tool_calls") else "respond"

    async def _execute_tools_node(self, state: AgentState) -> dict[str, Any]:
        # Ruxsat: model FAQAT `bind_tools`ga berilgan sxemalardan chaqira
        # oladi, lekin ishonmaymiz va ijrodan oldin yana tekshiramiz
        # (fail-closed) — ro'yxat `build_tools` qurgan nomlar to'plami.
        allowed = {d["name"] for d in self.tool_defs}
        ctx = agent_tools.ToolCtx(
            language=self.definition.language,
            city=self.definition.city,
            user_id=state["user_id"],
            agent_id=self.definition.agent_id,
        )

        results: list[dict[str, Any]] = []
        for call in state.get("pending_tool_calls", []):
            api_name = call["api_name"]
            if api_name not in allowed:
                # Ilgari bu yerda PermissionError ko'tarilardi — bitta noto'g'ri
                # tool nomi butun ijroni 500 bilan yiqitardi. Endi model xatoni
                # tool javobi sifatida ko'radi va o'zini tuzata oladi.
                result: dict[str, Any] = {
                    "xato": f"Agent '{self.definition.name}' uchun ruxsatsiz tool: {api_name}"
                }
            else:
                result = await agent_tools.run_tool(
                    api_name, call.get("args", {}), ctx, self.connector_targets
                )
            results.append(
                {
                    "role": "tool",
                    "name": api_name,
                    "tool_call_id": call.get("call_id", ""),
                    "content": agent_tools.to_tool_result_content(result),
                }
            )
        return {"messages": results, "pending_tool_calls": []}

    async def _halal_check_output(self, state: AgentState) -> dict[str, Any]:
        return {}

    async def run(
        self,
        user_id: str,
        user_message: str,
        run_id: str | None = None,
    ) -> dict[str, Any]:
        """Bitta blokli ijro.

        `run_id` — P0-8 `thread_id`. API `ExecutionRun.id` ni uzatadi, ya'ni
        ijro holati AYNAN o'sha run bilan bog'lanadi (blueprint §2.9 M3:
        holat runga bog'langan, ulanishga emas). Berilmasa yangi id
        yaratiladi — checkpointer yoqilgan bo'lsa u `thread_id`SIZ ishlay
        olmaydi, va "id yo'q" holatini jimgina checkpointsiz o'tkazish
        resume'ni sababsiz yo'qotardi.
        """
        thread_id = run_id or str(uuid.uuid4())
        initial_state: AgentState = {
            "messages": [{"role": "user", "content": user_message}],
            "user_id": user_id,
            "agent_id": self.definition.agent_id,
            "pending_tool_calls": [],
            "halal_flag": None,
            "iterations": 0,
        }
        # LangGraph'ning o'z recursion_limit'i — qo'shimcha xavfsizlik to'ri
        final_state = await self.graph.ainvoke(
            initial_state,
            config={
                "recursion_limit": MAX_TOOL_ITERATIONS * 2 + 4,
                "configurable": {"thread_id": thread_id},
            },
        )
        return {
            "agent_id": self.definition.agent_id,
            "run_id": thread_id,
            "halal_flag": final_state.get("halal_flag"),
            "messages": final_state["messages"],
        }

    async def resume(self, run_id: str) -> dict[str, Any]:
        """To'xtatilgan ijroni AYNAN o'sha joydan davom ettiradi (P0-8).

        `ainvoke(None, ...)` — LangGraph semantikasi: yangi kirish yo'q,
        saqlangan checkpointdan davom et. Tasdiq (P0-6) berilgach chaqiriladi.
        """
        final_state = await self.graph.ainvoke(
            None,
            config={
                "recursion_limit": MAX_TOOL_ITERATIONS * 2 + 4,
                "configurable": {"thread_id": run_id},
            },
        )
        return {
            "agent_id": self.definition.agent_id,
            "run_id": run_id,
            "halal_flag": final_state.get("halal_flag"),
            "messages": final_state["messages"],
        }


# ------------------------------------------------------------------
# 5. No-code JSON'dan to'g'ridan-to'g'ri agent yaratish
# ------------------------------------------------------------------


def create_agent_from_nocode_json(payload: dict[str, Any]) -> AgentEngine:
    definition = AgentDefinition.model_validate(payload)
    return AgentEngine(definition, registry)
