"""Shared FastAPI dependencies: the single Halal Filter instance and its guard."""
from __future__ import annotations

from fastapi import HTTPException

from halal_filter import Action, HalalFilter

halal_filter = HalalFilter()


async def guard(text: str, agent_name: str, profession: str = "") -> None:
    """Har bir aqlli endpoint kirishi Halal Filter'dan o'tadi — istisnosiz."""
    check = await halal_filter.classify(text, agent_name=agent_name, direction="kiruvchi", profession=profession)
    if check.action == Action.BLOCK:
        raise HTTPException(
            status_code=422,
            detail={"blocked": True, "reason": check.reasoning, "category": str(check.category)},
        )
