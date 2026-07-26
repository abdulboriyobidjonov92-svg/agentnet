"""
main.py — ilgari sinovsiz qolgan "aqlli" endpointlar uchun API-darajasidagi
pytest to'plami (test_engine.py'ning auth/halal-lug'at/heuristika testlaridan
farqli — bu yerda HAR endpointning HTTP darajasidagi simlanishi tekshiriladi):

  - `_guard()` (halal-block -> 422 {blocked, reason, category}) endpointlar
    orasida IZCHIL ishlashi (goals/fusion/knowledge — barchasi bitta helperdan
    foydalanadi, lekin har biri alohida yo'lda chaqiriladi — regressiya har
    birini sinamasdan sezilmasligi mumkin);
  - /ethics/evaluate'ning BOSHQALARDAN FARQLI xatti-harakati: halal-BLOCK
    bo'lsa ham 422 EMAS, 200 + REJECT verdikt qaytaradi (ethics.evaluate
    halal tekshiruvini O'ZI ichida qiladi);
  - /compliance/* — LLM'siz, to'liq deterministik endpointlar.

Ishga tushirilgan LLM chaqiruvlari yo'q — halal-block yo'llar keyword
qatlami (deterministik) orqali ishlaydi; muvaffaqiyatli yo'llarda esa
pastki-daraja dvigatel funksiyalari monkeypatch qilinadi (ularning o'z
mantig'i tegishli test_*.py fayllarida allaqachon sinalgan).
"""

from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

import compliance_packs
import halal_filter
import main

client = TestClient(main.app)


def _dev_env(monkeypatch):
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.setenv("INTERNAL_API_TOKEN", "strong-token")


def _auth(monkeypatch):
    _dev_env(monkeypatch)
    return {"x-internal-token": "strong-token"}


def _allow_halal(monkeypatch) -> None:
    """`main.halal_filter.classify` (yoki `_guard()` orqali) ALLOW qaytarishga
    majburlaydi — halal-BLOKLANMAYDIGAN matn bilan sinaladigan testlar uchun,
    haqiqiy Claude tarmoq chaqiruvisiz (llm_layer aks holda chaqiriladi)."""
    allow = halal_filter.FilterResult(
        halal_filter.Category.XAVFSIZ, 0.9, "toza", halal_filter.Action.ALLOW, layer="llm",
    )
    monkeypatch.setattr(main.halal_filter, "classify", AsyncMock(return_value=allow))


# ------------------------------------------------------------------
# Auth — yangi qo'shilgan endpointlar ham himoyalanganini tasdiqlaydi
# ------------------------------------------------------------------


def test_ichki_tokensiz_yangi_endpoint_ham_401(monkeypatch):
    _dev_env(monkeypatch)
    res = client.post("/ethics/evaluate", json={"action": "test"})
    assert res.status_code == 401


# ------------------------------------------------------------------
# /role/detect — halal-block SHU YERDA aniq 422 qaytaradi
# ------------------------------------------------------------------


def test_role_detect_halal_bloklangan_matn_422(monkeypatch):
    headers = _auth(monkeypatch)
    res = client.post("/role/detect", json={"text": "Keling kazino ochamiz", "language": "uz"}, headers=headers)
    assert res.status_code == 422
    body = res.json()["detail"]
    assert body["blocked"] is True
    assert "reason" in body


def test_role_detect_toza_matn_detect_role_natijasini_qaytaradi(monkeypatch):
    headers = _auth(monkeypatch)
    _allow_halal(monkeypatch)
    canned = {"profession_title": "haydovchi", "domain": "transport", "confidence": 0.8, "method": "llm"}
    monkeypatch.setattr(main, "detect_role", AsyncMock(return_value=canned))

    res = client.post("/role/detect", json={"text": "Men taksichiman", "language": "uz"}, headers=headers)

    assert res.status_code == 200
    assert res.json() == canned


# ------------------------------------------------------------------
# /ethics/evaluate — o'zining ICHKI halal-tekshiruvi (422 EMAS, 200+REJECT)
# ------------------------------------------------------------------


def test_ethics_evaluate_halal_bloklangan_amal_200_bilan_reject_qaytaradi(monkeypatch):
    headers = _auth(monkeypatch)
    res = client.post("/ethics/evaluate", json={"action": "Keling kazino ochamiz", "language": "uz"}, headers=headers)

    assert res.status_code == 200  # boshqa "aqlli" endpointlardan FARQLI — 422 EMAS
    body = res.json()
    assert body["verdict"] == "REJECT"
    assert body["method"] == "halal_filter"


def test_ethics_evaluate_parametrlarni_togri_uzatadi(monkeypatch):
    headers = _auth(monkeypatch)
    evaluate_spy = AsyncMock(return_value={"verdict": "APPROVE", "method": "llm"})
    monkeypatch.setattr(main.ethics_engine, "evaluate", evaluate_spy)

    res = client.post(
        "/ethics/evaluate",
        json={"action": "qarz olsam bo'ladimi?", "values": {"tradition": "islamic"}, "profession": "dehqon", "language": "uz"},
        headers=headers,
    )

    assert res.status_code == 200
    evaluate_spy.assert_awaited_once_with("qarz olsam bo'ladimi?", {"tradition": "islamic"}, "dehqon", "uz")


# ------------------------------------------------------------------
# _guard() orqali himoyalangan endpointlar — barchasi bir xil 422 shaklida
# ------------------------------------------------------------------


def test_goals_decompose_halal_bloklangan_maqsad_422(monkeypatch):
    headers = _auth(monkeypatch)
    res = client.post("/goals/decompose", json={"goal_text": "Kazino ochish uchun reja tuz"}, headers=headers)
    assert res.status_code == 422
    assert res.json()["detail"]["blocked"] is True


def test_goals_decompose_toza_matn_goal_enginega_uzatadi(monkeypatch):
    headers = _auth(monkeypatch)
    _allow_halal(monkeypatch)
    decompose_spy = AsyncMock(return_value={"milestones": [], "method": "llm"})
    monkeypatch.setattr(main.goal_engine, "decompose", decompose_spy)

    res = client.post(
        "/goals/decompose",
        json={"goal_text": "Savdoni oshirish", "profession": "do'kon egasi", "language": "uz"},
        headers=headers,
    )

    assert res.status_code == 200
    assert res.json() == {"milestones": [], "method": "llm"}
    decompose_spy.assert_awaited_once_with("Savdoni oshirish", [], "do'kon egasi", "uz")


def test_fusion_run_halal_bloklangan_muammo_422(monkeypatch):
    headers = _auth(monkeypatch)
    res = client.post("/fusion/run", json={"problem": "Keling kazino ochamiz"}, headers=headers)
    assert res.status_code == 422


def test_fusion_run_roles_berilmasa_suggest_roles_ishlatiladi(monkeypatch):
    headers = _auth(monkeypatch)
    _allow_halal(monkeypatch)
    monkeypatch.setattr(main.fusion_engine, "suggest_roles", lambda problem: ["ceo", "cfo"])
    fuse_spy = AsyncMock(return_value={"synthesis": "ok"})
    monkeypatch.setattr(main.fusion_engine, "fuse", fuse_spy)

    res = client.post("/fusion/run", json={"problem": "Savdo pasaymoqda, nima qilish kerak?"}, headers=headers)

    assert res.status_code == 200
    fuse_spy.assert_awaited_once()
    assert fuse_spy.await_args.args[1] == ["ceo", "cfo"]  # suggest_roles natijasi ishlatildi


def test_fusion_run_roles_berilsa_suggest_roles_ishlatilmaydi(monkeypatch):
    headers = _auth(monkeypatch)
    _allow_halal(monkeypatch)
    suggest_spy = AsyncMock()
    monkeypatch.setattr(main.fusion_engine, "suggest_roles", suggest_spy)
    monkeypatch.setattr(main.fusion_engine, "fuse", AsyncMock(return_value={"synthesis": "ok"}))

    res = client.post(
        "/fusion/run", json={"problem": "muammo", "roles": ["cto"]}, headers=headers,
    )

    assert res.status_code == 200
    suggest_spy.assert_not_called()


def test_knowledge_search_halal_bloklangan_soroq_422(monkeypatch):
    headers = _auth(monkeypatch)
    res = client.post("/knowledge/search", json={"query": "kazino qanday ochiladi"}, headers=headers)
    assert res.status_code == 422


# ------------------------------------------------------------------
# /compliance/* — LLM'siz, to'liq deterministik
# ------------------------------------------------------------------


def test_compliance_packs_royxati_hamma_paketlarni_qaytaradi(monkeypatch):
    headers = _auth(monkeypatch)
    res = client.get("/compliance/packs", headers=headers)
    assert res.status_code == 200
    assert len(res.json()["packs"]) == len(compliance_packs.PACKS)


def test_compliance_check_output_healthcare_buzilishni_ushlaydi(monkeypatch):
    headers = _auth(monkeypatch)
    res = client.post(
        "/compliance/check-output",
        json={"text": "Sizda aniq diabet tashxisi bor", "vertical": "healthcare", "language": "uz"},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["violations"]) == 1
    assert body["disclaimer_needed"] is True


def test_compliance_check_output_vertikalsiz_bosh_natija(monkeypatch):
    headers = _auth(monkeypatch)
    res = client.post("/compliance/check-output", json={"text": "istalgan matn"}, headers=headers)
    assert res.status_code == 200
    assert res.json() == {"violations": [], "disclaimer_needed": False, "disclaimer": ""}


# ------------------------------------------------------------------
# /halal/check — Halal Filter'ning to'g'ridan-to'g'ri HTTP kirish nuqtasi
# ------------------------------------------------------------------


def test_halal_check_bloklangan_matn(monkeypatch):
    headers = _auth(monkeypatch)
    res = client.post("/halal/check", json={"text": "Let's open a casino"}, headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["action"] == "BLOCK"
    assert body["layer"] == "keyword"


def test_halal_check_zararsiz_matn_keyword_qatlamidan_otib_llm_qatlamiga_boradi(monkeypatch):
    # Keyword qatlami bu matnni o'tkazadi -> HalalFilter.classify LLM qatlamiga
    # tushadi. Haqiqiy tarmoq so'rovisiz (sekin/beqaror bo'lmasin) llm_layer
    # to'g'ridan-to'g'ri mock qilinadi (o'zi test_halal_filter.py'da sinalgan).
    headers = _auth(monkeypatch)
    allow = halal_filter.FilterResult(
        halal_filter.Category.XAVFSIZ, 0.9, "toza", halal_filter.Action.ALLOW, layer="llm",
    )
    monkeypatch.setattr(halal_filter, "llm_layer", AsyncMock(return_value=allow))

    res = client.post("/halal/check", json={"text": "Bugungi namoz vaqtlari qanday?"}, headers=headers)

    assert res.status_code == 200
    assert res.json()["action"] == "ALLOW"
