"""V3-P0 · P0-8 — checkpoint saqlagichi testlari.

Diqqat markazi ikkita:
  1. Saqlagich API bilan TO'G'RI gaplashadimi (round-trip).
  2. Xatolar ijroni YIQITMAYDIMI (fail-open) — checkpoint qulaylik
     qatlami, uning yo'qligi agentni to'xtatmasligi kerak.
"""

from __future__ import annotations

import base64
from typing import Any

import httpx
import pytest

import agent_engine
from api_checkpointer import ApiCheckpointSaver


def _saver(handler) -> ApiCheckpointSaver:
    """Soxta API bilan ulangan saqlagich."""
    transport = httpx.MockTransport(handler)
    client = httpx.Client(transport=transport, base_url="http://api.test")
    return ApiCheckpointSaver(client=client)


def _config(thread_id: str | None = "run1", checkpoint_id: str | None = None) -> dict[str, Any]:
    conf: dict[str, Any] = {}
    if thread_id is not None:
        conf["thread_id"] = thread_id
    if checkpoint_id:
        conf["checkpoint_id"] = checkpoint_id
    return {"configurable": conf}


CHECKPOINT: dict[str, Any] = {
    "v": 1,
    "id": "cp-1",
    "ts": "2026-08-17T12:00:00+00:00",
    "channel_values": {"messages": ["salom"]},
    "channel_versions": {},
    "versions_seen": {},
}


# ---------------------------------------------------------------- put


def test_put_api_ga_yozadi_va_yangi_config_qaytaradi():
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["json"] = request.read().decode()
        return httpx.Response(201, json={"checkpointId": "cp-1"})

    out = _saver(handler).put(_config(), CHECKPOINT, {"source": "loop"}, {})

    assert "/api/internal/checkpoints" in seen["url"]
    assert "run1" in seen["json"]
    # Qaytgan config keyingi qadam uchun `checkpoint_id` bilan boyitiladi.
    assert out["configurable"]["checkpoint_id"] == "cp-1"
    assert out["configurable"]["thread_id"] == "run1"


def test_put_thread_id_yoq_bolsa_HECH_NARSA_yubormaydi():
    called = False

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        return httpx.Response(201, json={})

    out = _saver(handler).put(_config(thread_id=None), CHECKPOINT, {}, {})

    assert called is False
    # Config o'zgarishsiz qaytadi — ijro davom etadi.
    assert out == _config(thread_id=None)


def test_put_API_YIQILSA_ijro_toxtamaydi():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "db down"})

    # Throw QILMAYDI — fail-open.
    out = _saver(handler).put(_config(), CHECKPOINT, {}, {})
    assert out["configurable"]["checkpoint_id"] == "cp-1"


def test_put_tarmoq_uzilsa_ham_yiqilmaydi():
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("tarmoq yo'q")

    out = _saver(handler).put(_config(), CHECKPOINT, {}, {})
    assert out["configurable"]["thread_id"] == "run1"


# ---------------------------------------------------------------- get


def test_get_tuple_round_trip():
    """Yozilgan checkpoint AYNAN o'sha holda qaytib kelishi shart."""
    saver = _saver(lambda r: httpx.Response(200, json={}))
    packed = saver._dumps(CHECKPOINT)

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "threadId": "run1",
                "checkpointNs": "",
                "checkpointId": "cp-1",
                "parentCheckpointId": None,
                "blob": packed,
                "metadata": {"source": "loop"},
                "writes": [],
            },
        )

    tup = _saver(handler).get_tuple(_config())

    assert tup is not None
    assert tup.checkpoint["id"] == "cp-1"
    assert tup.checkpoint["channel_values"]["messages"] == ["salom"]
    assert tup.config["configurable"]["thread_id"] == "run1"


def test_get_tuple_checkpoint_yoq_bolsa_None():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=None)

    assert _saver(handler).get_tuple(_config()) is None


def test_get_tuple_API_yiqilsa_None_qaytaradi_throw_QILMAYDI():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={})

    assert _saver(handler).get_tuple(_config()) is None


def test_get_tuple_thread_id_yoq_bolsa_sorov_yubormaydi():
    called = False

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        return httpx.Response(200, json=None)

    assert _saver(handler).get_tuple(_config(thread_id=None)) is None
    assert called is False


def test_get_tuple_yozuvlarni_ham_qaytaradi():
    saver = _saver(lambda r: httpx.Response(200, json={}))

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "threadId": "run1",
                "checkpointNs": "",
                "checkpointId": "cp-1",
                "parentCheckpointId": None,
                "blob": saver._dumps(CHECKPOINT),
                "metadata": None,
                "writes": [{"taskId": "t1", "idx": 0, "channel": "messages", "blob": saver._dumps("javob")}],
            },
        )

    tup = _saver(handler).get_tuple(_config())
    assert tup is not None
    assert tup.pending_writes == [("t1", "messages", "javob")]


# ---------------------------------------------------------------- list


def test_list_tarixni_qaytaradi():
    saver = _saver(lambda r: httpx.Response(200, json={}))

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=[
                {
                    "threadId": "run1", "checkpointNs": "", "checkpointId": f"cp-{i}",
                    "parentCheckpointId": None, "blob": saver._dumps(CHECKPOINT),
                    "metadata": None, "writes": [],
                }
                for i in (2, 1)
            ],
        )

    out = list(_saver(handler).list(_config()))
    assert [t.config["configurable"]["checkpoint_id"] for t in out] == ["cp-2", "cp-1"]


def test_list_API_yiqilsa_BOSH_iterator():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={})

    assert list(_saver(handler).list(_config())) == []


# ---------------------------------------------------------------- put_writes


def test_put_writes_tartibni_saqlaydi():
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = request.read().decode()
        return httpx.Response(201, json={"written": 2})

    _saver(handler).put_writes(
        _config(checkpoint_id="cp-1"),
        [("messages", "birinchi"), ("messages", "ikkinchi")],
        task_id="task-1",
    )

    assert '"idx":0' in seen["body"].replace(" ", "")
    assert '"idx":1' in seen["body"].replace(" ", "")
    assert "task-1" in seen["body"]


def test_put_writes_checkpoint_id_yoq_bolsa_yubormaydi():
    called = False

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        return httpx.Response(201, json={})

    _saver(handler).put_writes(_config(), [("messages", "x")], task_id="t")
    assert called is False


# ---------------------------------------------------------------- serializatsiya


def test_blob_base64_va_qayta_oqiladi():
    saver = _saver(lambda r: httpx.Response(200, json={}))
    packed = saver._dumps({"a": [1, 2], "b": "matn"})

    type_, _, b64 = packed.partition(":")
    assert type_  # tip belgisi saqlanadi
    base64.b64decode(b64)  # yaroqli base64

    assert saver._loads(packed) == {"a": [1, 2], "b": "matn"}


# ---------------------------------------------------------------- graf ulanishi


def test_default_checkpointer_off_bolsa_None(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AGENT_CHECKPOINTS", "off")
    assert agent_engine._default_checkpointer() is None


def test_checkpointer_None_berilsa_graf_saqlamaydi():
    """`checkpointer=None` — ATAYLAB o'chirish; `_UNSET` dan farq qiladi."""
    d = agent_engine.AgentDefinition(
        agent_id="a1", name="Test", system_prompt="x", model="claude-sonnet-5", tools=[]
    )
    eng = agent_engine.AgentEngine(d, agent_engine.registry, checkpointer=None)
    assert eng.checkpointer is None
