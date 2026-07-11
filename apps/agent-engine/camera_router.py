"""S4 qo'shimcha: haqiqiy IP-kamera monitoring — /camera/* endpointlar.

camera_service.py'dagi RTSP -> YOLO+ByteTrack -> Claude Vision zanjirini
background asyncio vazifasi sifatida ishga tushiradi va tasdiqlangan
hodisalarni NestJS'ning /api/retail/internal/vision-events webhook'iga
yuboradi (xuddi /retail sahifasidagi simulyator urgan endpoint bilan bir xil).

Ilgari bu fayl mavjud emas edi -- camera_service.py yozilgan, lekin main.py'ga
hech qayerda ulanmagan va uning kutubxonalari (cv2/onvif/ultralytics)
requirements.txt'da yo'q edi, ya'ni chaqirilsa ImportError berardi.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from camera_service import SuspiciousEvent, TheftDetectionEngine, run_camera_monitoring_loop

logger = logging.getLogger("camera_router")

router = APIRouter(prefix="/camera", tags=["camera"])

_API_URL = os.getenv("API_URL", "http://localhost:3001")
_INTERNAL_TOKEN = os.getenv("INTERNAL_API_TOKEN", "agentnet-internal-dev")

# Heuristika sababi -> NestJS vision-event turi (retail.service.ts knownTypes).
# "concealment"/"grab_and_run" hozircha process_frame() da chiqarilmaydi
# (faqat "loitering_high_value_zone" ishlab chiqilgan), lekin xaritalash
# kelajakda ular qo'shilganda ham to'g'ri ishlashi uchun oldindan qo'yilgan.
_REASON_TO_TYPE = {
    "loitering_high_value_zone": "person_loitering",
    "concealment": "item_pickup",
    "grab_and_run": "item_pickup",
}


class CameraConnectRequest(BaseModel):
    camera_id: str
    rtsp_url: str
    user_id: str
    high_value_zones: list[dict] | None = None


class CameraStatusOut(BaseModel):
    camera_id: str
    status: str  # "connecting" | "running" | "error" | "stopped"
    detail: str = ""
    connected_at: float | None = None
    events_sent: int = 0


# Jarayon-ichi registr — bitta engine instansiga bog'liq (ko'p-instansli
# deploy'da har instans o'z kameralarini kuzatadi; MVP uchun yetarli).
_tasks: dict[str, asyncio.Task] = {}
_status: dict[str, CameraStatusOut] = {}


def _make_notify_callback(user_id: str, camera_id: str):
    """Har tasdiqlangan hodisani NestJS webhook'iga yuboradigan callback yasaydi."""

    async def _send(event: SuspiciousEvent) -> None:
        vision_type = _REASON_TO_TYPE.get(event.reason, "unknown")
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.post(
                    f"{_API_URL}/api/retail/internal/vision-events",
                    json={
                        "userId": user_id,
                        "camera": camera_id,
                        "type": vision_type,
                        "confidence": event.confidence,
                        "raw": {
                            "reason": event.reason,
                            "trackId": event.track_id,
                            "timestamp": event.timestamp,
                        },
                    },
                    headers={"x-internal-token": _INTERNAL_TOKEN},
                )
                res.raise_for_status()
            st = _status.get(camera_id)
            if st:
                st.events_sent += 1
        except Exception as e:
            # Webhook vaqtincha ishlamasa ham monitoring loop davom etadi --
            # keyingi tasdiqlangan hodisada qayta urinadi.
            logger.warning("vision-event yuborilmadi (camera=%s): %s", camera_id, e)

    return _send


async def _run_guarded(camera_id: str, rtsp_url: str, user_id: str, zones: list[dict] | None) -> None:
    """RTSP uzilsa/Claude Vision xato bersa ham jarayonni yiqitmaydi --
    xatoni status='error'ga yozadi va to'xtaydi (avtomatik qayta urinish
    keyingi bosqich; hozircha operator /camera/connect'ni qayta chaqiradi)."""
    engine = TheftDetectionEngine(high_value_zones=zones or [])
    notify = _make_notify_callback(user_id, camera_id)
    try:
        _status[camera_id].status = "running"
        _status[camera_id].connected_at = time.time()
        await run_camera_monitoring_loop(camera_id, rtsp_url, engine, notify)
    except asyncio.CancelledError:
        _status[camera_id].status = "stopped"
        raise
    except Exception as e:
        logger.error("Kamera monitoring xatosi (camera=%s): %s", camera_id, e)
        _status[camera_id].status = "error"
        _status[camera_id].detail = str(e)


@router.post("/connect")
async def connect(req: CameraConnectRequest):
    """Berilgan RTSP manzil uchun monitoring loop'ni background'da ishga tushiradi.

    Darhol "connecting" qaytaradi -- haqiqiy ulanish holatini /camera/status
    orqali kuzatish kerak (RTSP ulanishi va YOLO modeli yuklanishi soniyalar
    olishi mumkin).
    """
    existing = _tasks.get(req.camera_id)
    if existing and not existing.done():
        raise HTTPException(status_code=409, detail="Bu kamera allaqachon ulangan")

    _status[req.camera_id] = CameraStatusOut(camera_id=req.camera_id, status="connecting")
    task = asyncio.create_task(_run_guarded(req.camera_id, req.rtsp_url, req.user_id, req.high_value_zones))
    _tasks[req.camera_id] = task
    return {"camera_id": req.camera_id, "status": "connecting"}


@router.post("/disconnect")
async def disconnect(camera_id: str):
    task = _tasks.get(camera_id)
    if not task:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")
    task.cancel()
    return {"camera_id": camera_id, "status": "stopping"}


@router.get("/status")
async def status(camera_id: str | None = None):
    if camera_id:
        st = _status.get(camera_id)
        if not st:
            raise HTTPException(status_code=404, detail="Kamera topilmadi")
        return st
    return {"cameras": list(_status.values())}
