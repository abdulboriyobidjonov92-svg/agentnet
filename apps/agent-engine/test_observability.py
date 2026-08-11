"""
Phase 5 (P5.1 / P5.3) — agent-engine kuzatuv qatlami testlari.

Ikki da'voni isbotlaydi:
  1. Sentry ixtiyoriy — sozlanmagan bo'lsa engine hech qanday farqsiz ishlaydi;
  2. hech qanday sir/prompt/kredensial telemetriyaga chiqmaydi.
"""
from fastapi.testclient import TestClient

import main
import observability
from observability import (
    REDACTED,
    before_send,
    generate_request_id,
    is_valid_request_id,
    resolve_request_id,
    scrub_text,
    scrub_value,
    sentry_enabled,
)

client = TestClient(main.app)


# ----------------------------------------------------------------
# Redaksiya — qiymat va shakl
# ----------------------------------------------------------------

def test_internal_token_matndan_olib_tashlanadi(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_TOKEN", "engine-internal-token-secret")
    out = scrub_text("guard xatosi: token=engine-internal-token-secret")
    assert "engine-internal-token-secret" not in out
    assert REDACTED in out


def test_anthropic_kaliti_olib_tashlanadi(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-api03-REALVALUE12345678")
    out = scrub_text("anthropic chaqiruvi: sk-ant-api03-REALVALUE12345678 bilan")
    assert "REALVALUE12345678" not in out


def test_gemini_kaliti_shakl_boyicha_olinadi():
    out = scrub_text("key=AIzaSyD-ABCDEFGHIJKLMNOPQRSTUVWXYZ123")
    assert "AIzaSyD-ABCDEFGHIJKLMNOPQRSTUVWXYZ123" not in out


def test_jwt_olib_tashlanadi():
    jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.AbCdEfGhIjKlMnOpQrSt"
    assert jwt not in scrub_text(f"authorization: {jwt}")


def test_ulanish_satri_olib_tashlanadi():
    out = scrub_text("postgresql://agentnet:hunter2@db:5432/agentnet")
    assert "hunter2" not in out


def test_qisqa_env_qiymati_qidirilmaydi(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_TOKEN", "dev")
    assert scrub_text("development rejimi") == "development rejimi"


# ----------------------------------------------------------------
# Redaksiya — obyekt va PROMPT
# ----------------------------------------------------------------

def test_sir_kalitlar_ochiriladi():
    out = scrub_value({"api_key": "k", "password": "p", "keep": "ok"})
    assert out["api_key"] == REDACTED
    assert out["password"] == REDACTED
    assert out["keep"] == "ok"


def test_prompt_maydonlari_BUTUNLAY_olib_tashlanadi():
    """Prompt tozalanmaydi — o'chiriladi (foydalanuvchi matni va biznes siri)."""
    out = scrub_value(
        {
            "message": "Mening bank hisobim 8600 1234 5678 9012, shu bo'yicha hisobot qil",
            "system_prompt": "Sen halal moliyaviy yordamchisan",
            "conversation_history": [{"role": "user", "content": "maxfiy"}],
            "user_id": "u_123",
        }
    )
    serialized = str(out)
    assert "8600" not in serialized
    assert "halal moliyaviy yordamchisan" not in serialized
    assert "maxfiy" not in serialized
    # Diagnostika uchun tur va uzunlik qoladi.
    assert out["message"].startswith("[omitted:str:")
    # Prompt bo'lmagan maydon saqlanadi.
    assert out["user_id"] == "u_123"


def test_chuqurlik_chegarasidan_song_qiymat_sizmaydi():
    deep = {"password": "leak"}
    for _ in range(10):
        deep = {"nested": deep}
    serialized = str(scrub_value(deep))
    assert "leak" not in serialized
    assert "Depth limit" in serialized


# ----------------------------------------------------------------
# Sentry — ixtiyoriylik va hodisa tozalash
# ----------------------------------------------------------------

def test_sentry_dsn_siz_ochirilgan():
    assert sentry_enabled({}) is False


def test_sentry_test_muhitida_ochirilgan():
    assert sentry_enabled({"SENTRY_DSN": "https://k@o1.ingest.sentry.io/1", "ENV": "test"}) is False


def test_sentry_env_ochirgichi_ishlaydi():
    assert (
        sentry_enabled(
            {"SENTRY_DSN": "https://k@o1.ingest.sentry.io/1", "SENTRY_ENABLED": "0", "ENV": "production"}
        )
        is False
    )


def test_sentry_prod_da_yoqiladi():
    assert (
        sentry_enabled({"SENTRY_DSN": "https://k@o1.ingest.sentry.io/1", "ENV": "production"}) is True
    )


def test_init_sentry_dsn_siz_False_qaytaradi_va_tashlamaydi(monkeypatch):
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    assert observability.init_sentry() is False


def test_capture_exception_sozlanmagan_holatda_tashlamaydi():
    observability.capture_exception(ValueError("test"))


def test_before_send_internal_tokenni_ochiradi(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_TOKEN", "internal-token-value-secret")
    event = {
        "request": {
            "headers": {
                "x-internal-token": "internal-token-value-secret",
                "authorization": "Bearer abcdefghijklmnop",
                "x-request-id": "abc-1234-5678",
            },
            "data": {"message": "foydalanuvchi maxfiy matni", "user_id": "u1"},
        }
    }
    out = before_send(event)
    headers = out["request"]["headers"]
    assert headers["x-internal-token"] == REDACTED
    assert headers["authorization"] == REDACTED
    # Sir bo'lmagan sarlavha qoladi (korrelyatsiya kerak).
    assert headers["x-request-id"] == "abc-1234-5678"
    assert "maxfiy matni" not in str(out["request"]["data"])


def test_before_send_prompt_bilan_exception_matnini_tozalaydi(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-api03-LEAKEDKEY12345678")
    event = {
        "exception": {
            "values": [
                {
                    "value": "anthropic 401: sk-ant-api03-LEAKEDKEY12345678",
                    "stacktrace": {"frames": [{"vars": {"api_key": "sk-ant-x", "n": 3}}]},
                }
            ]
        }
    }
    out = before_send(event)
    value = out["exception"]["values"][0]
    assert "LEAKEDKEY12345678" not in value["value"]
    assert value["stacktrace"]["frames"][0]["vars"]["api_key"] == REDACTED
    assert value["stacktrace"]["frames"][0]["vars"]["n"] == 3


def test_before_send_foydalanuvchidan_faqat_id_qoldiradi():
    out = before_send({"user": {"id": "u_1", "email": "a@b.uz", "ip_address": "10.0.0.1"}})
    assert out["user"] == {"id": "u_1"}


# ----------------------------------------------------------------
# Request-id
# ----------------------------------------------------------------

def test_yaratilgan_id_formatga_mos():
    assert is_valid_request_id(generate_request_id())


def test_yaroqsiz_id_lar_rad_etiladi():
    assert not is_valid_request_id("")
    assert not is_valid_request_id("short")
    assert not is_valid_request_id("a" * 65)
    assert not is_valid_request_id("bo'sh joy bor")
    assert not is_valid_request_id("inject\nlog")


def test_yaroqli_id_propagatsiya_qilinadi():
    supplied = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    assert resolve_request_id(supplied) == supplied


def test_yaroqsiz_id_yangisi_bilan_almashtiriladi():
    out = resolve_request_id("bad value")
    assert out != "bad value"
    assert is_valid_request_id(out)


def test_haddan_uzun_id_rad_etiladi():
    out = resolve_request_id("x" * 100000)
    assert len(out) <= 64


def test_ishonch_ochirilganda_yaroqli_id_ham_qabul_qilinmaydi(monkeypatch):
    monkeypatch.setenv("TRUST_INCOMING_REQUEST_ID", "0")
    supplied = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    assert resolve_request_id(supplied) != supplied


# ----------------------------------------------------------------
# HTTP integratsiyasi — mavjud xulq buzilmaganini isbotlaydi
# ----------------------------------------------------------------

def test_health_ishlaydi_va_request_id_qaytaradi():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert is_valid_request_id(res.headers.get("X-Request-Id"))


def test_yuqori_oqim_bergan_request_id_saqlanadi():
    supplied = "chain-1234-5678-abcd"
    res = client.get("/health", headers={"x-request-id": supplied})
    assert res.headers["X-Request-Id"] == supplied


def test_yaroqsiz_request_id_javobga_TUSHMAYDI():
    res = client.get("/health", headers={"x-request-id": "bad value <script>"})
    assert res.headers["X-Request-Id"] != "bad value <script>"
    assert is_valid_request_id(res.headers["X-Request-Id"])


def test_ichki_token_guardi_HAMON_ishlaydi(monkeypatch):
    """Kuzatuv qatlami qo'shilgandan keyin ham auth BUZILMAGAN."""
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.setenv("INTERNAL_API_TOKEN", "correct-token-value")
    res = client.post("/halal/check", json={"text": "salom"}, headers={"x-internal-token": "wrong"})
    assert res.status_code == 401


def test_401_javobida_sir_yoq(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_TOKEN", "correct-token-value")
    res = client.post("/halal/check", json={"text": "salom"}, headers={"x-internal-token": "wrong"})
    assert "correct-token-value" not in res.text
