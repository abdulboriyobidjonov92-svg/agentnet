"""V3-P0 · P0-8 — LangGraph checkpoint saqlagichi (API orqali).

NEGA BU MAVJUD
--------------
LangGraph grafi hozir `compile()` bilan, ya'ni checkpointer'SIZ quriladi.
Bu shuni anglatadi: ijroni to'xtatib keyin AYNAN O'SHA JOYDAN davom
ettirib bo'lmaydi — HITL tasdig'i (P0-6) va crash-recovery ikkalasi ham
shunga tayanadi.

NEGA POSTGRES'GA TO'G'RIDAN-TO'G'RI EMAS
---------------------------------------
`apps/agent-engine` da DB kutubxonasi UMUMAN yo'q va u Postgres'ga
ulanmaydi — API bilan faqat HTTP orqali gaplashadi (`connector.invoke`
ham shunday). `langgraph-checkpoint-postgres` qo'shish engine'ga DB
kredensiallarini berish bo'lardi: engine buzilsa hujumchi to'g'ridan-
to'g'ri bazaga chiqardi va Konstitutsiya #5 chegarasi ochilardi.

Shuning uchun holat AYNAN kerakli joyda — Postgres'da (Contract A10,
yagona haqiqat manbai) — lekin unga yozish API orqali. Bu sinf
`BaseCheckpointSaver` ni implement qiladi va `/internal/checkpoints`
endpointlariga boradi (`x-internal-token` bilan).

SIR QOIDASI
-----------
Checkpoint faqat ICHKI holatni saqlaydi. Xom tashqi kontent (brauzer
DOM, inbox matni) va sirlar unga TUSHMAYDI — sirlar modelga `secretRef`
sifatida beriladi (P0-9), ya'ni serializatsiya ularni ko'rmaydi
(blueprint §2.1 T5/T6).
"""

from __future__ import annotations

import base64
import logging
import os
from collections.abc import Iterator, Sequence
from typing import Any

import httpx
from langgraph.checkpoint.base import (
    BaseCheckpointSaver,
    ChannelVersions,
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
)
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer

logger = logging.getLogger(__name__)

# Bitta so'rov uchun timeout. Checkpoint yozish ijro YO'LIDA turadi —
# uzoq kutish butun javobni sekinlashtiradi.
_TIMEOUT_SEC = 5.0


def _api_base() -> str:
    return os.getenv("AGENTNET_API_URL", "http://localhost:3001").rstrip("/")


def _internal_token() -> str:
    return os.getenv("INTERNAL_API_TOKEN", "agentnet-internal-dev")


class ApiCheckpointSaver(BaseCheckpointSaver):
    """`BaseCheckpointSaver` — saqlash API orqali, Postgres'da.

    FAIL-OPEN: har HTTP xatosi yutiladi va `None`/no-op qaytariladi.
    Sabab — checkpoint QULAYLIK qatlami: u yiqilsa ijro davom etishi
    kerak (faqat resume imkoni yo'qoladi). Checkpoint xatosi tufayli
    foydalanuvchi javobini yo'qotish ancha yomonroq.
    """

    def __init__(self, client: httpx.Client | None = None) -> None:
        super().__init__(serde=JsonPlusSerializer())
        self._client = client or httpx.Client(
            base_url=_api_base(),
            timeout=_TIMEOUT_SEC,
            headers={"x-internal-token": _internal_token()},
        )

    # ---------- yordamchilar ----------

    @staticmethod
    def _thread_id(config: dict[str, Any]) -> str | None:
        return (config or {}).get("configurable", {}).get("thread_id")

    @staticmethod
    def _ns(config: dict[str, Any]) -> str:
        return (config or {}).get("configurable", {}).get("checkpoint_ns", "") or ""

    def _dumps(self, value: Any) -> str:
        """Serializator chiqishi baytlar — HTTP/JSON uchun base64."""
        _type, blob = self.serde.dumps_typed(value)
        return f"{_type}:{base64.b64encode(blob).decode('ascii')}"

    def _loads(self, packed: str) -> Any:
        type_, _, b64 = packed.partition(":")
        return self.serde.loads_typed((type_, base64.b64decode(b64)))

    def _tuple_from_payload(self, payload: dict[str, Any]) -> CheckpointTuple:
        config = {
            "configurable": {
                "thread_id": payload["threadId"],
                "checkpoint_ns": payload.get("checkpointNs", ""),
                "checkpoint_id": payload["checkpointId"],
            }
        }
        parent = payload.get("parentCheckpointId")
        parent_config = (
            {
                "configurable": {
                    "thread_id": payload["threadId"],
                    "checkpoint_ns": payload.get("checkpointNs", ""),
                    "checkpoint_id": parent,
                }
            }
            if parent
            else None
        )
        writes = [
            (w["taskId"], w["channel"], self._loads(w["blob"]))
            for w in payload.get("writes", [])
        ]
        return CheckpointTuple(
            config=config,
            checkpoint=self._loads(payload["blob"]),
            metadata=payload.get("metadata") or {},
            parent_config=parent_config,
            pending_writes=writes,
        )

    # ---------- BaseCheckpointSaver ----------

    def put(
        self,
        config: dict[str, Any],
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ) -> dict[str, Any]:
        thread_id = self._thread_id(config)
        # `thread_id` yo'q — bu graf run'ga bog'lanmagan (masalan test yoki
        # eski chaqiruv). Saqlash MA'NOSIZ, lekin ijro to'xtamasligi kerak.
        if not thread_id:
            return config

        ns = self._ns(config)
        checkpoint_id = checkpoint["id"]
        parent = (config.get("configurable") or {}).get("checkpoint_id")

        try:
            self._client.post(
                "/api/internal/checkpoints",
                json={
                    "threadId": thread_id,
                    "checkpointNs": ns,
                    "checkpointId": checkpoint_id,
                    "parentCheckpointId": parent,
                    "blob": self._dumps(checkpoint),
                    "metadata": dict(metadata) if metadata else None,
                },
            ).raise_for_status()
        except Exception as exc:  # fail-open — izohga qarang
            logger.warning("Checkpoint saqlanmadi (%s): %s", thread_id, exc)

        return {
            "configurable": {
                "thread_id": thread_id,
                "checkpoint_ns": ns,
                "checkpoint_id": checkpoint_id,
            }
        }

    def put_writes(
        self,
        config: dict[str, Any],
        writes: Sequence[tuple[str, Any]],
        task_id: str,
        task_path: str = "",
    ) -> None:
        thread_id = self._thread_id(config)
        checkpoint_id = (config.get("configurable") or {}).get("checkpoint_id")
        if not thread_id or not checkpoint_id or not writes:
            return

        try:
            self._client.post(
                "/api/internal/checkpoints/writes",
                json={
                    "threadId": thread_id,
                    "checkpointNs": self._ns(config),
                    "checkpointId": checkpoint_id,
                    "taskId": task_id,
                    "writes": [
                        {"idx": i, "channel": channel, "blob": self._dumps(value)}
                        for i, (channel, value) in enumerate(writes)
                    ],
                },
            ).raise_for_status()
        except Exception as exc:  # fail-open
            logger.warning("Checkpoint yozuvlari saqlanmadi (%s): %s", thread_id, exc)

    def get_tuple(self, config: dict[str, Any]) -> CheckpointTuple | None:
        thread_id = self._thread_id(config)
        if not thread_id:
            return None

        checkpoint_id = (config.get("configurable") or {}).get("checkpoint_id")
        params: dict[str, str] = {"checkpointNs": self._ns(config)}
        if checkpoint_id:
            params["checkpointId"] = checkpoint_id

        try:
            res = self._client.get(f"/api/internal/checkpoints/{thread_id}", params=params)
            res.raise_for_status()
            payload = res.json()
        except Exception as exc:  # fail-open
            logger.warning("Checkpoint o'qilmadi (%s): %s", thread_id, exc)
            return None

        if not payload:
            return None
        return self._tuple_from_payload(payload)

    def list(
        self,
        config: dict[str, Any] | None,
        *,
        filter: dict[str, Any] | None = None,
        before: dict[str, Any] | None = None,
        limit: int | None = None,
    ) -> Iterator[CheckpointTuple]:
        thread_id = self._thread_id(config or {})
        if not thread_id:
            return iter(())

        params: dict[str, Any] = {"checkpointNs": self._ns(config or {})}
        if before:
            before_id = (before.get("configurable") or {}).get("checkpoint_id")
            if before_id:
                params["before"] = before_id
        if limit:
            params["limit"] = limit

        try:
            res = self._client.get(f"/api/internal/checkpoints/{thread_id}/list", params=params)
            res.raise_for_status()
            payloads = res.json() or []
        except Exception as exc:  # fail-open
            logger.warning("Checkpoint tarixi o'qilmadi (%s): %s", thread_id, exc)
            return iter(())

        return iter([self._tuple_from_payload(p) for p in payloads])
