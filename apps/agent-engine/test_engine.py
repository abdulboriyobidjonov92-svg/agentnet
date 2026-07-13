"""
Agent-engine uchun pytest to'plami (M8).

Ilgari engine'da 0 ta test bor edi — CI faqat "test topilmadi" (exit 5) ni
o'tkazib yuborardi, ya'ni regressiya jimgina chiqib ketardi. Bu fayl API
kalitisiz, deterministik yo'llarni qamraydi:
  - ichki-token auth guardi (C1 xavfsizlik tuzatmasi),
  - halal filtr lug'at (keyword) qatlami — LLM'siz ishlaydigan qatlam,
  - retail bashorat heuristikasi (sof matematik),
  - kasb/domain katalogi.
"""
from fastapi.testclient import TestClient

import main
import retail_forecast
from halal_filter import Action, keyword_layer
from role_detection import domains_summary

# ----------------------------------------------------------------
# C1: ichki-token auth guardi
# ----------------------------------------------------------------

client = TestClient(main.app)


def _dev_env(monkeypatch):
    """Prod-belgilarini olib tashlaymiz (lokal/dev holati)."""
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("RENDER", raising=False)


def test_health_ochiq_tokensiz(monkeypatch):
    _dev_env(monkeypatch)
    monkeypatch.setenv("INTERNAL_API_TOKEN", "strong-token")
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_himoyalangan_endpoint_tokensiz_401(monkeypatch):
    _dev_env(monkeypatch)
    monkeypatch.setenv("INTERNAL_API_TOKEN", "strong-token")
    assert client.get("/tools/available").status_code == 401


def test_notogri_token_401(monkeypatch):
    _dev_env(monkeypatch)
    monkeypatch.setenv("INTERNAL_API_TOKEN", "strong-token")
    r = client.get("/tools/available", headers={"x-internal-token": "wrong"})
    assert r.status_code == 401


def test_togri_token_200(monkeypatch):
    _dev_env(monkeypatch)
    monkeypatch.setenv("INTERNAL_API_TOKEN", "strong-token")
    r = client.get("/tools/available", headers={"x-internal-token": "strong-token"})
    assert r.status_code == 200


def test_prod_default_token_fail_closed(monkeypatch):
    # Prod'da commlik default token QABUL QILINMAYDI (500 — kuchli kalit majburiy).
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("INTERNAL_API_TOKEN", "agentnet-internal-dev")
    r = client.get("/tools/available", headers={"x-internal-token": "agentnet-internal-dev"})
    assert r.status_code == 500


# ----------------------------------------------------------------
# Halal filtr — lug'at qatlami (LLM'siz, deterministik)
# ----------------------------------------------------------------

def test_halal_keyword_bloklaydi_qimor():
    res = keyword_layer("Let's open a casino downtown")
    assert res is not None
    assert res.action == Action.BLOCK


def test_halal_keyword_benign_otkazadi():
    # Oddiy, ruxsat etilgan matn — lug'at qatlami hech narsa qaytarmaydi (None).
    assert keyword_layer("Bugungi namoz vaqtlari qanday?") is None


# ----------------------------------------------------------------
# Retail bashorat heuristikasi (sof matematik)
# ----------------------------------------------------------------

def test_retail_heuristic_kritik_tovarni_ustuvorlashtiradi():
    forecasts = [
        {"name": "Sut 1L", "urgency": "critical", "daysUntilStockout": 2, "recommendedOrderQty": 15},
        {"name": "Non", "urgency": "ok", "daysUntilStockout": 20, "recommendedOrderQty": 0},
    ]
    out = retail_forecast._heuristic(forecasts, {"critical": 1, "warning": 0}, "uz")
    assert out["method"] == "heuristic"
    assert out["headline"]
    # Faqat kritik/ogohlantirish + buyurtma-miqdori bor tovar ustuvorlar ro'yxatiga tushadi.
    assert any("Sut 1L" in p for p in out["priorities"])
    assert all("Non" not in p for p in out["priorities"])


# ----------------------------------------------------------------
# Kasb/domain katalogi (sof, deterministik)
# ----------------------------------------------------------------

def test_domains_summary_bosh_emas():
    domains = domains_summary()
    assert isinstance(domains, list)
    assert len(domains) > 0
