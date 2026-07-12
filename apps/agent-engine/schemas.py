"""Request body schemas (Pydantic models) shared by the FastAPI routers."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


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
