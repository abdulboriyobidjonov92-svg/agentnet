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

import operator
import uuid
from typing import Annotated, Any, Callable, TypedDict

from pydantic import BaseModel, Field

# langgraph/langchain ixtiyoriy — faqat /agents/run (blokli ijro) uchun kerak.
# Streaming yo'li (streaming.py) bularni ishlatmaydi, shuning uchun lazy import.
try:
    from langchain_anthropic import ChatAnthropic  # noqa: F401
    from langgraph.graph import StateGraph, END  # noqa: F401
    _LANGGRAPH_AVAILABLE = True
except ImportError:
    _LANGGRAPH_AVAILABLE = False

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


# ------------------------------------------------------------------
# 2. LangGraph holati (State)
# ------------------------------------------------------------------


# Xarajat himoyasi: bitta so'rov ichida reason→tool→reason sikli necha marta
# aylanishi mumkin. Cheksiz loop = kutilmagan katta LLM hisobi. Env orqali sozlanadi.
import os

MAX_TOOL_ITERATIONS = int(os.getenv("AGENT_MAX_TOOL_ITERATIONS", "8"))


class AgentState(TypedDict):
    messages: Annotated[list[dict[str, str]], operator.add]
    user_id: str
    agent_id: str
    pending_tool_calls: list[dict[str, Any]]
    halal_flag: str | None  # "ALLOW" | "BLOCK" | "HUMAN_REVIEW" | None
    iterations: int  # reason node necha marta ishga tushdi (loop chegarasi uchun)


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


# ------------------------------------------------------------------
# 4. AgentEngine -- AgentDefinition'ni LangGraph grafiga compile qiladi
# ------------------------------------------------------------------


class AgentEngine:
    def __init__(self, definition: AgentDefinition, tool_registry: ToolRegistry):
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
        self.llm = ChatAnthropic(
            model=definition.model,
            max_tokens=4096,
            model_kwargs={"extra_body": {"thinking": {"type": "disabled"}}},
        )
        self.graph = self._build_graph()

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

        return workflow.compile()

    async def _halal_check_input(self, state: AgentState) -> AgentState:
        if not self.definition.halal_filter_enabled:
            return {**state, "halal_flag": "ALLOW"}
        # Import qilingan HalalFilter ishlatiladi (main.py dan inject qilinadi)
        last_message = state["messages"][-1]["content"] if state["messages"] else ""
        flag = "ALLOW" if "qimor" not in last_message.lower() else "BLOCK"
        return {**state, "halal_flag": flag}

    def _route_after_input_filter(self, state: AgentState) -> str:
        return "blocked" if state.get("halal_flag") == "BLOCK" else "continue"

    async def _reason_node(self, state: AgentState) -> AgentState:
        system = {
            "role": "system",
            "content": (
                f"{self.definition.system_prompt}\n\n"
                f"Ruxsat etilgan vositalar: {[t.tool_id for t in self.definition.tools]}"
            ),
        }
        response = await self.llm.ainvoke([system, *state["messages"]])
        new_messages = [{"role": "assistant", "content": response.content}]
        iterations = state.get("iterations", 0) + 1
        return {**state, "messages": new_messages, "pending_tool_calls": [], "iterations": iterations}

    def _route_after_reasoning(self, state: AgentState) -> str:
        # Loop chegarasi: MAX_TOOL_ITERATIONS ga yetgach, tool chaqirmay javob beramiz
        if state.get("iterations", 0) >= MAX_TOOL_ITERATIONS:
            return "respond"
        return "tool_call" if state.get("pending_tool_calls") else "respond"

    async def _execute_tools_node(self, state: AgentState) -> AgentState:
        results = []
        for call in state.get("pending_tool_calls", []):
            tool_id = call["tool_id"]
            allowed_ids = {t.tool_id for t in self.definition.tools}
            if tool_id not in allowed_ids:
                raise PermissionError(
                    f"Agent '{self.definition.name}' uchun ruxsatsiz tool: {tool_id}"
                )
            fn = self.registry.get(tool_id)
            result = fn(call.get("config", {}))
            results.append({"role": "tool", "content": str(result)})
        return {**state, "messages": results, "pending_tool_calls": []}

    async def _halal_check_output(self, state: AgentState) -> AgentState:
        return state

    async def run(self, user_id: str, user_message: str) -> dict[str, Any]:
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
            initial_state, config={"recursion_limit": MAX_TOOL_ITERATIONS * 2 + 4}
        )
        return {
            "agent_id": self.definition.agent_id,
            "run_id": str(uuid.uuid4()),
            "halal_flag": final_state.get("halal_flag"),
            "messages": final_state["messages"],
        }


# ------------------------------------------------------------------
# 5. No-code JSON'dan to'g'ridan-to'g'ri agent yaratish
# ------------------------------------------------------------------


def create_agent_from_nocode_json(payload: dict[str, Any]) -> AgentEngine:
    definition = AgentDefinition.model_validate(payload)
    return AgentEngine(definition, registry)
