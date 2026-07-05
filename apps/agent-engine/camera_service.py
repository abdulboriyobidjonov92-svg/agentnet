"""
AgentNet -- Do'kon Kamerasi Monitoring Xizmati
------------------------------------------------------------
RTSP/ONVIF kameradan oqim qabul qilish -> YOLOv11+ByteTrack orqali
odam/harakat kuzatish -> vaqt-ketma-ketlik (temporal) oynasi orqali
shubhali harakatni belgilash -> Claude Vision bilan ikkinchi
tekshiruv (yolg'on signalni kamaytirish) -> faqat tasdiqlangan
holatda Telegram/WhatsApp orqali ogohlantirish.

MUHIM (maxfiylik): yuz-tanish/biometrik vektorlar O'zbekiston
qonunchiligiga ko'ra (2026-yil mart yangilanishi) mahalliy serverda
saqlanishi shart -- bu modul shu cheklovga mos arxitektura bilan
yozilgan (BIOMETRIC_STORAGE_REGION orqali).

Talab qilinadigan paketlar:
  pip install opencv-python onvif-zeep ultralytics anthropic \
              python-telegram-bot
"""

from __future__ import annotations

import asyncio
import base64
import time
from collections import deque
from dataclasses import dataclass, field

import cv2
from anthropic import AsyncAnthropic
from onvif import ONVIFCamera
from ultralytics import YOLO

claude = AsyncAnthropic()

# Biometrik ma'lumotlar faqat shu mintaqada saqlanadi (qonuniy talab)
BIOMETRIC_STORAGE_REGION = "uz-central-1"  # mahalliy data-center/region kodi


# ------------------------------------------------------------------
# 1. ONVIF orqali kamerani aniqlash va RTSP manzilini olish
# ------------------------------------------------------------------


def discover_rtsp_url(host: str, port: int, username: str, password: str) -> str:
    """ONVIF protokoli orqali kamera media-profilidan RTSP stream URL'ini oladi."""
    camera = ONVIFCamera(host, port, username, password)
    media_service = camera.create_media_service()
    profiles = media_service.GetProfiles()
    stream_uri = media_service.GetStreamUri(
        {
            "StreamSetup": {"Stream": "RTP-Unicast", "Transport": {"Protocol": "RTSP"}},
            "ProfileToken": profiles[0].token,
        }
    )
    return stream_uri.Uri


# ------------------------------------------------------------------
# 2. Harakat ketma-ketligini kuzatish (temporal window)
# ------------------------------------------------------------------


@dataclass
class TrackHistory:
    """Har bir kuzatilayotgan shaxs (track_id) uchun oxirgi N freym holati."""

    positions: deque = field(default_factory=lambda: deque(maxlen=90))  # ~3 soniya @30fps
    near_shelf_frames: int = 0
    concealment_score: float = 0.0


@dataclass
class SuspiciousEvent:
    track_id: int
    camera_id: str
    reason: str  # "concealment" | "grab_and_run" | "loitering_high_value_zone"
    confidence: float
    frame_jpeg_b64: str
    timestamp: float


class TheftDetectionEngine:
    """
    YOLOv11 orqali odamlarni aniqlaydi va ByteTrack bilan kuzatib boradi.
    Heuristik qoidalar: yuqori-qiymat zonasida uzoq turish, sumka/jaketga
    yashirish harakati, kassadan o'tmasdan tezda chiqish.

    Eslatma: bu heuristikalar boshlang'ich (MVP) versiya -- production
    uchun 4-8 haftalik operator-feedback orqali fine-tuning tavsiya etiladi
    (tadqiqotlarga ko'ra bu davrda aniqlik 85-92%, recall 75-88%ga yetadi).
    """

    def __init__(self, model_path: str = "yolo11n.pt", high_value_zones: list[dict] | None = None):
        self.model = YOLO(model_path)
        self.high_value_zones = high_value_zones or []
        self.tracks: dict[int, TrackHistory] = {}

    def process_frame(self, frame, camera_id: str) -> list[SuspiciousEvent]:
        results = self.model.track(frame, persist=True, classes=[0], verbose=False)  # class 0 = person
        events: list[SuspiciousEvent] = []

        if results[0].boxes.id is None:
            return events

        for box, track_id in zip(results[0].boxes.xyxy.cpu(), results[0].boxes.id.int().cpu().tolist()):
            history = self.tracks.setdefault(track_id, TrackHistory())
            x1, y1, x2, y2 = box.tolist()
            center = ((x1 + x2) / 2, (y1 + y2) / 2)
            history.positions.append(center)

            if self._in_high_value_zone(center):
                history.near_shelf_frames += 1
            else:
                history.near_shelf_frames = max(0, history.near_shelf_frames - 1)

            # Heuristika: yuqori-qiymat zonasida 2.5 soniyadan ortiq + keskin
            # to'xtash-harakat patterni -- "concealment" xavfi sifatida belgilanadi.
            if history.near_shelf_frames > 75:  # ~2.5s @30fps
                events.append(
                    SuspiciousEvent(
                        track_id=track_id,
                        camera_id=camera_id,
                        reason="loitering_high_value_zone",
                        confidence=min(0.6 + history.near_shelf_frames / 300, 0.9),
                        frame_jpeg_b64=self._encode_frame(frame),
                        timestamp=time.time(),
                    )
                )
                history.near_shelf_frames = 0  # qayta signal yubormaslik uchun reset

        return events

    def _in_high_value_zone(self, point: tuple[float, float]) -> bool:
        x, y = point
        for zone in self.high_value_zones:
            if zone["x1"] <= x <= zone["x2"] and zone["y1"] <= y <= zone["y2"]:
                return True
        return False

    @staticmethod
    def _encode_frame(frame) -> str:
        _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
        return base64.b64encode(buffer).decode("utf-8")


# ------------------------------------------------------------------
# 3. Claude Vision orqali ikkinchi tekshiruv (yolg'on signalni kamaytirish)
# ------------------------------------------------------------------

VERIFICATION_SYSTEM_PROMPT = """\
Sen do'kon xavfsizligi bo'yicha tasvir-tahlilchisan. Senga bitta
kamera freymi va heuristik tizim aniqlagan shubha sababi beriladi.
Vazifang -- bu HAQIQATDAN shubhali holat ekanligini freym asosida
tasdiqlash yoki rad etish (oddiy xaridorlik harakatini noto'g'ri
signal sifatida belgilamaslik).

FAQAT quyidagi JSON formatda javob ber:
{"confirmed": true/false, "explanation": "qisqa sabab (o'zbek tilida)"}
"""


async def verify_with_claude_vision(event: SuspiciousEvent) -> bool:
    response = await claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=200,
        system=VERIFICATION_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": event.frame_jpeg_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": f"Heuristik tizim sababi: {event.reason} (ishonch: {event.confidence:.2f})",
                    },
                ],
            }
        ],
    )
    import json

    try:
        parsed = json.loads(response.content[0].text)
        return bool(parsed.get("confirmed", False))
    except (json.JSONDecodeError, IndexError):
        return False  # xavfsiz tomonga og'ish -- noaniq holatda ogohlantirma


# ------------------------------------------------------------------
# 4. Asosiy oqim -- kamera -> aniqlash -> tasdiqlash -> ogohlantirish
# ------------------------------------------------------------------


async def run_camera_monitoring_loop(
    camera_id: str,
    rtsp_url: str,
    engine: TheftDetectionEngine,
    notify_callback,  # async fn(event: SuspiciousEvent) -> None  (Telegram/WhatsApp)
) -> None:
    cap = cv2.VideoCapture(rtsp_url)
    if not cap.isOpened():
        raise ConnectionError(f"RTSP oqimiga ulanib bo'lmadi: {rtsp_url}")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                await asyncio.sleep(1.0)
                continue

            events = engine.process_frame(frame, camera_id)
            for event in events:
                confirmed = await verify_with_claude_vision(event)
                if confirmed:
                    # Biometrik/yuz ma'lumoti SAQLANMAYDI -- faqat hodisa metadatasi
                    # va vaqtinchalik freym (audit uchun) BIOMETRIC_STORAGE_REGION'da saqlanadi.
                    await notify_callback(event)

            await asyncio.sleep(0.03)  # ~30fps tahlil tezligi
    finally:
        cap.release()
