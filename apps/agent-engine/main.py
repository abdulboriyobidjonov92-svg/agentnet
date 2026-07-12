"""
AgentNet — Agent Engine FastAPI (to'liq versiya)

Endpointlar routers/ paketidagi mavzu bo'yicha modullarga bo'lingan:
  - routers/core.py     — health, agent ijrosi (sync/stream), halal-check, toollar
  - routers/role.py      — kasb-aniqlash va bir-klik agent yaratish
  - routers/wow.py       — Life Twin, Goal Achievement, Fusion, Ethics, Knowledge, Super Mode, AgentOS
  - routers/platform.py  — avtomatlashtirish, muvofiqlik, retail, ops, trade, govtech
  - camera_router.py     — IP-kamera monitoring (S4)
"""
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import camera_router
import knowledge_sync
from agent_engine import registry
from routers import core, platform, role, wow

# Tool larni register qilish
from tools.islam_tools import prayer_times, quran_surah
from tools.health_tools import symptom_check, calorie_estimate
from tools.finance_tools import get_transactions
from tools.calendar_tools import get_events
from tools.messaging_tools import telegram_send
from tools.utility_tools import weather, currency_rates
from tools.automation_tools import connector_invoke, web_automate


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

# S4 qo'shimcha: haqiqiy IP-kamera monitoring (RTSP -> YOLO -> Claude Vision).
# Ilgari camera_service.py yozilgan-u hech qayerga ulanmagan edi.
app.include_router(camera_router.router)

app.include_router(core.router)
app.include_router(role.router)
app.include_router(wow.router)
app.include_router(platform.router)
