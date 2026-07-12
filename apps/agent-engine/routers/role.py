"""Adaptiv yadro: kasb-aniqlash, tavsiyalar va bir-klik agent yaratish (Y9)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

import agent_composer
from dependencies import guard, halal_filter
from halal_filter import Action
from role_detection import detect_role, domain_profile, domains_summary
from schemas import ComposeAgentRequest, RoleDetectRequest

router = APIRouter(tags=["role"])


@router.post("/role/detect")
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


@router.get("/role/domains")
async def role_domains():
    """Barcha soha profillari xulosasi."""
    return {"domains": domains_summary()}


@router.get("/role/domains/{slug}")
async def role_domain(slug: str, language: str = "en"):
    """Saqlangan domain uchun tavsiyalarni qayta olish."""
    return domain_profile(slug, language)


@router.post("/agents/compose")
async def agents_compose(req: ComposeAgentRequest):
    """Foydalanuvchi tabiiy tilda nima kerakligini yozadi → bitta tayyor,
    moslashtirilgan agent taklifi (nom, system-prompt, tool'lar, murakkablik).

    Kirish avval Halal Filter'dan o'tadi — bir-klik oqim ham filtr qatlamini
    chetlab o'tmaydi. Agent YARATILMAYDI; NestJS narxni qo'shib taklifni qaytaradi.
    """
    await guard(req.description, "agent-composer", req.profession)
    return await agent_composer.compose(req.description, req.language, req.profession)
