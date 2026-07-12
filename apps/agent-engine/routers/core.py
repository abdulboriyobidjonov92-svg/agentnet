"""Asosiy endpointlar: health-check, agent ijrosi (sync/stream), halal-check, toollar."""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from agent_engine import AgentDefinition, AgentEngine, registry
from builtin_agents import BUILTIN_AGENTS
from dependencies import halal_filter
from schemas import HalalCheckRequest, RunAgentRequest
from streaming import stream_agent_response

router = APIRouter(tags=["core"])


@router.get("/health")
async def health():
    return {"status": "ok", "service": "agent-engine", "tools": registry.available()}


@router.post("/agents/run")
async def run_agent(req: RunAgentRequest):
    """Oddiy (bloklangan) agent ijrosi — streaming emas."""
    try:
        definition = AgentDefinition.model_validate(req.agent_definition)
        engine = AgentEngine(definition, registry)
        result = await engine.run(req.user_id, req.message)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/agents/stream")
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


@router.post("/halal/check")
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


@router.get("/tools/available")
async def list_tools():
    return {"tools": registry.available()}


@router.get("/agents/builtin")
async def get_builtin_agents():
    """Tayyor (built-in) agentlar — universal, kasbiy, natija beruvchi.

    Diniy/shaxsiy-ibodat agentlari yadro namoyishidan olib tashlandi:
    platforma so'zда emas, amalda ishonchli — universal Ethics Engine har
    bir amalni qadriyatlarga solishtiradi (islomiy/dunyoviy/aralash tanlab
    bo'ladi). Kerak bo'lsa foydalanuvchi maxsus agent o'zi qura oladi.
    """
    return {"agents": BUILTIN_AGENTS}
