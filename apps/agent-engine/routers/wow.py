""""WOW" xususiyatlari: Life Twin, Goal Achievement, Agent Fusion, Ethics,
Knowledge Sync, Super Mode va AgentOS.
"""
from __future__ import annotations

from fastapi import APIRouter

import agentos as agentos_engine
import ethics as ethics_engine
import fusion as fusion_engine
import goal_engine
import knowledge_sync
import life_twin
import supermode as supermode_engine
from dependencies import guard
from schemas import (
    AgentOsRequest,
    DecomposeRequest,
    EthicsRequest,
    ExecuteTaskRequest,
    ExtractRequest,
    FusionRequest,
    KnowledgeRequest,
    SuperModeRequest,
    WhatIfRequest,
)

router = APIRouter(tags=["wow"])


# --- WOW 1: Life Twin — raqamli egizak ---


@router.post("/twin/whatif")
async def twin_whatif(req: WhatIfRequest):
    await guard(req.question, "life-twin", req.profession)
    return await life_twin.whatif(req.question, req.facts, req.goals, req.profession, req.language)


@router.post("/twin/extract")
async def twin_extract(req: ExtractRequest):
    # Ekstraksiya kirishi ham filtrlanadi — bloklangan matndan fakt olinmaydi
    await guard(req.text, "life-twin-extract")
    return await life_twin.extract_facts(req.text, req.language)


# --- WOW 2: Autonomous Goal Achievement ---


@router.post("/goals/decompose")
async def goals_decompose(req: DecomposeRequest):
    await guard(req.goal_text, "goal-engine", req.profession)
    return await goal_engine.decompose(req.goal_text, req.facts, req.profession, req.language)


@router.post("/goals/execute-task")
async def goals_execute_task(req: ExecuteTaskRequest):
    await guard(str(req.task.get("title", "")), "goal-engine", req.profession)
    return await goal_engine.execute_task(req.task, req.facts, req.goal_title, req.profession, req.language)


# --- WOW 3: Cross-Profession Agent Fusion ---


@router.post("/fusion/run")
async def fusion_run(req: FusionRequest):
    await guard(req.problem, "fusion", req.profession)
    roles = req.roles or fusion_engine.suggest_roles(req.problem)
    return await fusion_engine.fuse(req.problem, roles, req.facts, req.profession, req.language)


@router.get("/fusion/roles")
async def fusion_roles(language: str = "en"):
    return {"roles": fusion_engine.roles_catalog(language)}


# --- WOW 4: Ethical Decision Engine ---


@router.post("/ethics/evaluate")
async def ethics_evaluate(req: EthicsRequest):
    # Halal filter ethics.evaluate ichida chaqiriladi (1-bosqich) — bu yerda
    # takror guard qo'yilmaydi, chunki BLOCK natija REJECT verdiktga aylanadi.
    return await ethics_engine.evaluate(req.action, req.values, req.profession, req.language)


# --- WOW 5: Real-time Global Knowledge Sync ---


@router.post("/knowledge/search")
async def knowledge_search(req: KnowledgeRequest):
    await guard(req.query, "knowledge-sync")
    return await knowledge_sync.search(req.query, req.language, req.city)


# --- "One Command" Super Mode — beshtasi birga ---


@router.post("/supermode/run")
async def supermode_run(req: SuperModeRequest):
    await guard(req.command, "supermode", req.profession)
    return await supermode_engine.run(
        req.command, req.facts, req.goals, req.values, req.profession, req.city, req.language
    )


# --- AgentOS — korxona/enterprise orkestratori ---


@router.post("/agentos/run")
async def agentos_run(req: AgentOsRequest):
    await guard(req.command, "agentos-orchestrator")
    return await agentos_engine.run_command(
        req.command, req.org_name, req.org_kind, req.industry, req.roles, req.values, req.language
    )


@router.get("/agentos/csuite")
async def agentos_csuite(language: str = "en"):
    return {"roles": agentos_engine.csuite_catalog(language)}
