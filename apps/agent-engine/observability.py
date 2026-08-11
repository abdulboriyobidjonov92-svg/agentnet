"""
Phase 5 (P5.1 / P5.3) — agent-engine kuzatuv qatlami.

Uch narsa beradi, uchtasi ham SIRSIZ:
  1. Sentry (ixtiyoriy) — `SENTRY_DSN` bo'lmasa UMUMAN yoqilmaydi;
  2. redaksiya — sir/prompt/kredensial telemetriyaga chiqmaydi;
  3. request-id — NestJS API bergan `x-request-id` ni qabul qiladi,
     bo'lmasa yaratadi, javob sarlavhasiga qo'yadi va log/Sentry
     kontekstiga biriktiradi.

ENG MUHIM CHEKLOV (engine uchun o'ziga xos): bu servis PROMPT'lar bilan
ishlaydi. Prompt ichida foydalanuvchi yozgan matn (shaxsiy ma'lumot,
biznes siri) va ba'zan konnektor natijalari bo'ladi. Shuning uchun
`before_send` prompt/xabar maydonlarini BUTUNLAY olib tashlaydi —
"tozalash" emas, O'CHIRISH. Xato diagnostikasi uchun ularning uzunligi
va turi yetarli.
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

# ----------------------------------------------------------------
# Redaksiya
# ----------------------------------------------------------------

REDACTED = "[REDACTED]"

#: Qiymati telemetriyaga chiqmasligi kerak bo'lgan env kalitlari.
SECRET_ENV_KEYS: tuple[str, ...] = (
    "INTERNAL_API_TOKEN",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "DATABASE_URL",
    "REDIS_URL",
    "SENTRY_AUTH_TOKEN",
    "ENCRYPTION_KEY",
    "AUTH_JWT_SECRET",
)

#: Matn ichidagi sir SHAKLLARI (NestJS `redaction.ts` bilan bir xil ro'yxat).
_SECRET_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}"),
    re.compile(r"\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}", re.IGNORECASE),
    re.compile(r"\bsk-(?:ant-)?[A-Za-z0-9_-]{12,}"),
    re.compile(r"\bAIza[A-Za-z0-9_-]{20,}"),  # Google/Gemini kaliti
    re.compile(r"\bre_[A-Za-z0-9_-]{16,}"),
    re.compile(r"\b\d{6,12}:[A-Za-z0-9_-]{30,}\b"),
    re.compile(
        r"\b(?:postgres(?:ql)?|redis|mongodb|mysql)://[^\s'\"<>]*@[^\s'\"<>]*",
        re.IGNORECASE,
    ),
)

#: Nomi shu bo'laklarni O'Z ICHIGA OLGAN kalitlar butunlay o'chiriladi.
_SENSITIVE_KEY_PARTS: tuple[str, ...] = (
    "password",
    "secret",
    "token",
    "apikey",
    "api_key",
    "authorization",
    "cookie",
    "credential",
    "encrypted",
)

#: PROMPT/XABAR maydonlari — tozalanmaydi, BUTUNLAY olib tashlanadi.
_PROMPT_KEYS: tuple[str, ...] = (
    "prompt",
    "system_prompt",
    "message",
    "messages",
    "conversation_history",
    "content",
    "text",
    "instructions",
    "input",
    "output",
    "completion",
)


def _secret_values() -> list[str]:
    values = {
        v.strip()
        for k in SECRET_ENV_KEYS
        if (v := os.getenv(k)) and len(v.strip()) >= 8
    }
    return sorted(values, key=len, reverse=True)


def scrub_text(value: str) -> str:
    """Matndan sirlarni olib tashlaydi (xato xabari, stack, log satri)."""
    if not value:
        return value
    out = value
    for secret in _secret_values():
        if secret in out:
            out = out.replace(secret, REDACTED)
    for pattern in _SECRET_PATTERNS:
        out = pattern.sub(REDACTED, out)
    return out


def is_sensitive_key(key: str) -> bool:
    normalized = re.sub(r"[^a-z0-9_]", "", key.lower())
    return any(part.replace("_", "") in normalized.replace("_", "") for part in _SENSITIVE_KEY_PARTS)


def is_prompt_key(key: str) -> bool:
    return key.lower() in _PROMPT_KEYS


_MAX_DEPTH = 5


def scrub_value(value: Any, depth: int = 0) -> Any:
    """Obyekt daraxtini tozalaydi (nom + qiymat + prompt qatlamlari)."""
    if depth > _MAX_DEPTH:
        return "[Depth limit]"
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return scrub_text(value)
    if isinstance(value, (list, tuple)):
        return [scrub_value(item, depth + 1) for item in list(value)[:50]]
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for key, item in value.items():
            name = str(key)
            if is_prompt_key(name):
                # Prompt O'CHIRILADI — faqat "bor edi va shuncha edi".
                out[name] = f"[omitted:{type(item).__name__}:{len(str(item))}]"
            elif is_sensitive_key(name):
                out[name] = REDACTED
            else:
                out[name] = scrub_value(item, depth + 1)
        return out
    return f"[{type(value).__name__}]"


# ----------------------------------------------------------------
# Request-id (NestJS `request-id.ts` bilan AYNI shartnoma)
# ----------------------------------------------------------------

REQUEST_ID_HEADER = "x-request-id"
_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def is_valid_request_id(value: str | None) -> bool:
    return bool(value) and bool(_REQUEST_ID_RE.match(value or ""))


def generate_request_id() -> str:
    return str(uuid.uuid4())


def resolve_request_id(incoming: str | None) -> str:
    """
    Yuqori oqim (NestJS API) bergan ID formatga mos bo'lsa QABUL QILINADI —
    zanjir shu bilan uzilmaydi. Mos bo'lmasa jimgina yangisi yaratiladi;
    yaroqsiz qiymat log yoki javobga HECH QACHON tushmaydi.

    Engine ommaviy emas (SEC-10: Render private service + ichki token),
    ya'ni bu yerda "yuqori oqim" har doim bizning O'Z servisimiz.
    """
    if os.getenv("TRUST_INCOMING_REQUEST_ID") == "0":
        return generate_request_id()
    if incoming is not None and is_valid_request_id(incoming):
        return incoming
    return generate_request_id()


# ----------------------------------------------------------------
# Strukturaviy log
# ----------------------------------------------------------------

_LOG_NAME = "agentnet.engine"


class _JsonFormatter(logging.Formatter):
    """Bitta qatorli JSON — NestJS pino chiqishi bilan bir xil shakl."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname.lower(),
            "time": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created))
            + f".{int(record.msecs):03d}Z",
            "service": "agentnet-engine",
            "env": os.getenv("SENTRY_ENVIRONMENT") or os.getenv("ENV") or "development",
            "msg": scrub_text(record.getMessage()),
        }
        for key in ("reqId", "method", "url", "statusCode", "durationMs", "errType"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        if record.exc_info:
            payload["err"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else "Error",
                "message": scrub_text(str(record.exc_info[1])),
            }
        return json.dumps(payload, ensure_ascii=False)


def get_logger() -> logging.Logger:
    logger = logging.getLogger(_LOG_NAME)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(_JsonFormatter())
        logger.addHandler(handler)
        logger.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
        # Root logger'ga ko'tarilmasin (uvicorn formati bilan ikkilanmasin).
        logger.propagate = False
    return logger


# ----------------------------------------------------------------
# Sentry
# ----------------------------------------------------------------


def sentry_enabled(env: dict[str, str] | None = None) -> bool:
    """
    Uchala shart ham bajarilishi kerak. Sozlanmagan Sentry — normal holat
    (dev/test), xato emas.
    """
    source = env if env is not None else dict(os.environ)
    if not (source.get("SENTRY_DSN") or "").strip():
        return False
    if source.get("ENV", "").lower() == "test" or source.get("PYTEST_CURRENT_TEST"):
        return False
    if source.get("SENTRY_ENABLED") == "0":
        return False
    return True


def before_send(event: dict[str, Any], hint: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """
    Sentry hodisasini yuborishdan oldin tozalaydi.

    `request.headers` da `x-internal-token` bo'lishi MUMKIN (u har
    chaqiruvda keladi) — u nom bo'yicha o'chiriladi. `request.data` da
    esa prompt bo'ladi — u butunlay olib tashlanadi.
    """
    request = event.get("request")
    if isinstance(request, dict):
        headers = request.get("headers")
        if isinstance(headers, dict):
            request["headers"] = {
                name: (REDACTED if is_sensitive_key(str(name)) else scrub_text(str(value)))
                for name, value in headers.items()
            }
        if "cookies" in request:
            request["cookies"] = REDACTED
        for key in ("data", "query_string", "url"):
            if key in request:
                request[key] = scrub_value(request[key])

    for key in ("extra", "contexts", "tags"):
        if key in event:
            event[key] = scrub_value(event[key])

    exception = event.get("exception")
    if isinstance(exception, dict):
        for value in exception.get("values", []) or []:
            if isinstance(value, dict) and isinstance(value.get("value"), str):
                value["value"] = scrub_text(value["value"])
            frames = (value.get("stacktrace") or {}).get("frames") or []
            for frame in frames:
                if isinstance(frame, dict) and isinstance(frame.get("vars"), dict):
                    frame["vars"] = scrub_value(frame["vars"])

    # Foydalanuvchi — faqat `id` (engine `user_id` oladi; email/telefon YO'Q).
    user = event.get("user")
    if isinstance(user, dict):
        event["user"] = {"id": str(user["id"])} if user.get("id") else {}

    for crumb in event.get("breadcrumbs", {}).get("values", []) or []:
        if isinstance(crumb, dict):
            if isinstance(crumb.get("message"), str):
                crumb["message"] = scrub_text(crumb["message"])
            if isinstance(crumb.get("data"), dict):
                crumb["data"] = scrub_value(crumb["data"])

    return event


def init_sentry() -> bool:
    """
    SDK'ni ishga tushiradi. Sozlanmagan bo'lsa `False` qaytaradi va
    ILOVA HECH QANDAY o'zgarishsiz ishlaydi.
    """
    if not sentry_enabled():
        return False
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
    except ImportError:  # pragma: no cover — paket yo'q bo'lsa ham engine ishlaydi
        get_logger().warning("sentry-sdk o'rnatilmagan — kuzatuv o'chirilgan")
        return False

    rate_raw = os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0")
    try:
        rate = float(rate_raw)
    except ValueError:
        rate = 0.0
    if not 0.0 <= rate <= 1.0:
        rate = 0.0

    sentry_sdk.init(
        dsn=os.environ["SENTRY_DSN"].strip(),
        environment=os.getenv("SENTRY_ENVIRONMENT") or os.getenv("ENV") or "development",
        release=os.getenv("SENTRY_RELEASE") or None,
        traces_sample_rate=rate,
        # SDK IP/cookie/body'ni O'ZI qo'shmaydi — `before_send` ga
        # QO'SHIMCHA qatlam.
        send_default_pii=False,
        max_breadcrumbs=20,
        # `before_send` bu yerda ATAYLAB `dict` ustida ishlaydi (SDK'ning
        # `Event` TypedDict'i emas): u testlarda oddiy lug'at bilan
        # chaqiriladi va SDK versiyasi o'zgarganda tip nomi almashsa ham
        # redaksiya mantig'i buzilmaydi. SDK runtime'da baribir lug'at
        # uzatadi, shuning uchun bu xavfsiz.
        before_send=before_send,  # type: ignore[arg-type]
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
        ],
    )
    sentry_sdk.set_tag("service", "agentnet-engine")
    return True


# ----------------------------------------------------------------
# Middleware
# ----------------------------------------------------------------


def capture_exception(error: BaseException) -> None:
    """Sentry sozlanmagan bo'lsa JIMGINA hech narsa qilmaydi (no-op)."""
    try:
        import sentry_sdk

        sentry_sdk.capture_exception(error)
    except Exception:  # pragma: no cover — telemetriya hech qachon yiqitmaydi
        pass


def _install_error_capture(app: Any, logger: logging.Logger) -> None:
    """
    5xx xatolarni Sentry'ga BIR MARTA yuboradi.

    NEGA KERAK: engine endpointlari xatoni `except Exception -> raise
    HTTPException(500, ...)` naqshi bilan USHLAYDI (44 endpoint). Ushlangan
    xato Sentry'ning avtomatik integratsiyasiga TUSHMAYDI — ya'ni init
    qilishning o'zi engine xatolarini ko'rsatmasdi. 44 endpointni
    o'zgartirish o'rniga bitta handler qo'shiladi.

    JAVOB SHAKLI O'ZGARMAYDI: FastAPI'ning O'Z handler'i chaqiriladi va
    uning javobi o'zgarishsiz qaytariladi. `detail` (jumladan halal
    filtrning `{blocked, reason}` shakli) tegilmaydi.
    """
    from fastapi import HTTPException
    from fastapi.exception_handlers import http_exception_handler
    from starlette.exceptions import HTTPException as StarletteHTTPException

    async def handler(request: Any, exc: StarletteHTTPException) -> Any:
        if exc.status_code >= 500:
            capture_exception(exc)
            logger.error(
                "engine 5xx",
                extra={
                    "reqId": getattr(request.state, "request_id", None),
                    "method": request.method,
                    "url": str(request.url.path),
                    "statusCode": exc.status_code,
                    "errType": type(exc).__name__,
                },
            )
        return await http_exception_handler(request, exc)

    app.add_exception_handler(StarletteHTTPException, handler)
    app.add_exception_handler(HTTPException, handler)


def install_observability(app: Any) -> None:
    """
    `x-request-id` + so'rov logi middleware'ini o'rnatadi.

    ICHKI AUTH BUZILMAYDI: bu middleware `internal_token_guard` dan
    KEYIN qo'shiladi, ya'ni Starlette stack'ida undan TASHQARIDA turadi
    va faqat kuzatuv qiladi — hech qanday so'rovni o'tkazmaydi yoki
    to'xtatmaydi.
    """
    logger = get_logger()

    _install_error_capture(app, logger)

    @app.middleware("http")
    async def request_observability(request: Any, call_next: Callable[[Any], Awaitable[Any]]) -> Any:
        request_id = resolve_request_id(request.headers.get(REQUEST_ID_HEADER))
        # Keyingi qatlamlar (endpoint kodi) o'qiy olsin.
        request.state.request_id = request_id

        try:
            import sentry_sdk

            sentry_sdk.set_tag("request_id", request_id)
        except Exception:  # pragma: no cover — sentry yo'q/init qilinmagan
            pass

        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:
            duration = round((time.perf_counter() - started) * 1000)
            logger.error(
                "so'rov ishlov berishda xato",
                exc_info=True,
                extra={
                    "reqId": request_id,
                    "method": request.method,
                    "url": str(request.url.path),
                    "statusCode": 500,
                    "durationMs": duration,
                    "errType": type(exc).__name__,
                },
            )
            raise

        duration = round((time.perf_counter() - started) * 1000)
        response.headers["X-Request-Id"] = request_id
        # `/health` — orkestrator har necha soniyada so'raydi; loglanmaydi.
        if request.url.path != "/health":
            logger.info(
                "so'rov bajarildi",
                extra={
                    "reqId": request_id,
                    "method": request.method,
                    "url": str(request.url.path),
                    "statusCode": response.status_code,
                    "durationMs": duration,
                },
            )
        return response
