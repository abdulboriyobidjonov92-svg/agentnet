"""PART 1B — Platform-wide superpowers: brauzer avtomatlashtirish, muvofiqlik
paketlari, chakana savdo tahlili, biznes-operatsiyalar, transchegaraviy
savdo va GovTech.
"""
from __future__ import annotations

from fastapi import APIRouter

import automation_planner
import business_ops
import compliance_packs
import govtech as govtech_engine
import retail_forecast
import retail_intel
import trade as trade_engine
from dependencies import guard
from schemas import (
    AutomationPlanRequest,
    AutomationSummaryRequest,
    ComplianceCheckRequest,
    GovClassifyRequest,
    GovGuideRequest,
    OpsOutboundRequest,
    OpsScheduleRequest,
    RetailAssessRequest,
    RetailForecastRequest,
    TradeComplianceRequest,
    TradeDocsRequest,
    TradeTariffRequest,
)

router = APIRouter(tags=["platform"])


# --- S1: Universal App Control (Tier 1 — brauzer avtomatlashtirish) ---
# Brauzer (Playwright) NestJS bridge'da; bu endpointlar har qadam uchun
# LLM-first qaror qabul qiladi (kalitsiz — skriptli retseptlar).


@router.post("/automation/plan")
async def automation_plan(req: AutomationPlanRequest):
    if not req.history:  # maqsad faqat birinchi qadar Halal Filter'dan o'tadi
        await guard(req.goal, "browser-automation")
    return await automation_planner.plan_next_step(req.goal, req.page_state, req.history, req.language)


@router.post("/automation/summarize")
async def automation_summarize(req: AutomationSummaryRequest):
    return {"summary": await automation_planner.summarize_run(req.goal, req.steps, req.language)}


@router.get("/automation/capabilities")
async def automation_capabilities():
    return automation_planner.describe_capabilities()


# --- S3: Vertical Compliance Packs ---


@router.get("/compliance/packs")
async def compliance_list(language: str = "en"):
    return {"packs": compliance_packs.packs_summary(language)}


@router.post("/compliance/check-output")
async def compliance_check_output(req: ComplianceCheckRequest):
    return compliance_packs.check_output(req.text, req.vertical, req.language)


# --- S4: Retail Intelligence (kamera + inventar fuziyasi) ---


@router.post("/retail/assess")
async def retail_assess(req: RetailAssessRequest):
    return await retail_intel.assess(req.evidence, req.language)


@router.post("/retail/forecast")
async def retail_forecast_endpoint(req: RetailForecastRequest):
    """Hisoblangan bashorat JSON'idan qisqa, ustuvor xulosa (agent #1)."""
    return await retail_forecast.analyze(req.forecasts, req.summary, req.language)


# --- S5: Business Operations ---


@router.post("/ops/schedule")
async def ops_schedule(req: OpsScheduleRequest):
    await guard(req.instructions, "business-ops")
    return await business_ops.schedule_from_text(req.instructions, req.employees, req.week_start, req.language)


@router.post("/ops/outbound-draft")
async def ops_outbound(req: OpsOutboundRequest):
    await guard(req.purpose, "business-ops")
    return await business_ops.outbound_draft(
        req.purpose, req.audience, req.recipient_name, req.channel, req.org_name, req.context, req.language
    )


# --- S6: Cross-Border Trade ---


@router.post("/trade/customs-docs")
async def trade_docs(req: TradeDocsRequest):
    await guard(str(req.shipment.get("goods", "")), "trade")
    return await trade_engine.customs_docs(req.shipment, req.language)


@router.post("/trade/tariff")
async def trade_tariff(req: TradeTariffRequest):
    await guard(req.goods, "trade")
    return await trade_engine.tariff_lookup(req.goods, req.destination, req.language)


@router.post("/trade/compliance")
async def trade_compliance(req: TradeComplianceRequest):
    return await trade_engine.compliance_check(req.goods, req.origin, req.destination, req.counterparty, req.language)


@router.get("/trade/tracking/{tracking_number}")
async def trade_tracking(tracking_number: str):
    return trade_engine.tracking_info(tracking_number)


@router.get("/trade/fx")
async def trade_fx(base: str = "USD", symbols: str = "UZS,EUR,RUB,CNY,KZT"):
    return await trade_engine.fx(base, symbols)


# --- S7: GovTech ---


@router.post("/govtech/classify")
async def govtech_classify(req: GovClassifyRequest):
    await guard(req.text, "govtech-intake")
    return await govtech_engine.classify_request(req.text, req.language)


@router.post("/govtech/guide")
async def govtech_guide(req: GovGuideRequest):
    await guard(req.query, "govtech-navigator")
    return await govtech_engine.process_guide(req.query, req.language)


@router.get("/govtech/catalog")
async def govtech_catalog(language: str = "uz"):
    return {
        "services": govtech_engine.services_catalog(language),
        "guides": govtech_engine.guides_catalog(language),
    }
