"""
AgentNet — Vertical Compliance Packs (S3)
------------------------------------------
Ethical Decision Engine qadriyatlar/halal muvofiqligini tekshiradi; bu modul
esa SOHA-SPETSIFIK muvofiqlikni beradi (Hippocratic AI'ning HIPAA-by-default
yondashuvi kabi): har bir vertikal agent shabloni o'z pack'ini avtomatik yuklaydi.

Pack nima beradi:
  1. system_addendum  — agent tizim-promptiga qo'shiladigan majburiy xulq qoidalari
  2. disclaimers      — har javob oxirida bo'lishi shart bo'lgan ogohlantirish (3 til)
  3. output_flags     — chiqishda taqiqlangan da'vo naqshlari (regex) — topilsa
                        javob o'zgartirilmaydi, lekin korrektiv disclaimer majburan
                        qo'shiladi va hodisa belgilanadi
  4. data_rules       — ma'lumot bilan ishlash qoidalari (log/UI uchun)

Bu qatlam LLM'siz ham to'liq ishlaydi (regex + majburiy disclaimer).
"""

from __future__ import annotations

import re
from typing import Any

PACKS: dict[str, dict[str, Any]] = {
    "healthcare": {
        "label": {"en": "Healthcare compliance", "ru": "Медицинский комплаенс", "uz": "Tibbiy muvofiqlik"},
        "system_addendum": (
            "MANDATORY HEALTHCARE COMPLIANCE:\n"
            "- Never state a definitive diagnosis. Present possibilities and always "
            "recommend an in-person clinician for confirmation.\n"
            "- Never tell a user to start, stop or change prescription medication dosage; "
            "that decision belongs to their doctor.\n"
            "- Treat every health detail the user shares as confidential health data: do not "
            "repeat it unnecessarily, do not suggest sharing it with third parties.\n"
            "- If symptoms suggest an emergency (chest pain, stroke signs, severe bleeding, "
            "suicidal intent), tell the user to call 103 (O'zbekiston) or local emergency services FIRST.\n"
            "- End every substantive medical answer with the medical disclaimer."
        ),
        "disclaimers": {
            "en": "⚕️ This is general health information, not a diagnosis or a prescription. Consult a licensed clinician.",
            "ru": "⚕️ Это общая медицинская информация, а не диагноз и не назначение. Обратитесь к лицензированному врачу.",
            "uz": "⚕️ Bu umumiy tibbiy ma'lumot — tashxis ham, retsept ham emas. Litsenziyali shifokorga murojaat qiling.",
        },
        "output_flags": [
            # aniq tashxis da'volari
            r"(?i)\byou (definitely|certainly) have\b",
            r"(?i)\bsizda aniq .{0,30}(kasal|tashxis)",
            r"(?i)\bу вас (точно|однозначно)\b",
            r"(?i)\b(diagnoz|tashxis) aniq\b",
            r"(?i)\bno need to (see|visit) a doctor\b",
            r"(?i)\bshifokorga borish shart emas\b",
            r"(?i)\bк врачу (идти|обращаться) не (нужно|надо)\b",
        ],
        "data_rules": [
            "Health data is confidential by default (HIPAA-style handling).",
            "Never include patient identifiers in logs or shared outputs.",
            "Health facts extracted to Life Twin stay in the owner's private store.",
        ],
    },
    "finance": {
        "label": {"en": "Finance/banking compliance", "ru": "Финансовый комплаенс", "uz": "Moliya/bank muvofiqligi"},
        "system_addendum": (
            "MANDATORY FINANCE COMPLIANCE:\n"
            "- You are not a licensed financial advisor. Frame everything as information "
            "and analysis, never as guaranteed outcomes.\n"
            "- Never promise or imply guaranteed returns, 'risk-free' profits or certain "
            "market movements.\n"
            "- Flag interest-bearing (riba) instruments so the user can choose a compliant "
            "alternative if their values require it.\n"
            "- Treat transaction data as sensitive: summarize, do not re-broadcast raw records.\n"
            "- End every substantive financial answer with the finance disclaimer."
        ),
        "disclaimers": {
            "en": "💼 Information and analysis only — not licensed financial advice; returns are never guaranteed.",
            "ru": "💼 Только информация и анализ — не лицензированная финансовая консультация; доходность не гарантируется.",
            "uz": "💼 Faqat ma'lumot va tahlil — litsenziyali moliyaviy maslahat emas; daromad hech qachon kafolatlanmaydi.",
        },
        "output_flags": [
            r"(?i)\bguaranteed (return|profit|income)\b",
            r"(?i)\brisk[- ]free (profit|investment)\b",
            r"(?i)\bkafolatlangan (daromad|foyda)\b",
            r"(?i)\bгарантированн(ый|ая) (доход|прибыль)\b",
            r"(?i)\byou will (definitely|certainly) (earn|profit)\b",
            r"(?i)\baniq (boyiysiz|foyda ko'rasiz)\b",
        ],
        "data_rules": [
            "Transaction data is processed for the owner only; never shared across users.",
            "Card/account numbers must be masked in every output (only last 4 digits).",
            "Interest-bearing items are always labeled explicitly.",
        ],
    },
    "government": {
        "label": {"en": "Government/data sovereignty", "ru": "Госсектор/суверенитет данных", "uz": "Davlat sektori/ma'lumot suvereniteti"},
        "system_addendum": (
            "MANDATORY GOVERNMENT-SECTOR COMPLIANCE:\n"
            "- Citizen personal data is sovereign: it must stay within the deploying "
            "organization's storage, never sent to third-party services beyond the "
            "configured processing pipeline.\n"
            "- Follow O'zbekiston personal data law (ZRU-547): biometric and identity data "
            "are processed locally and minimally.\n"
            "- Never invent the status of a real government application; if live status "
            "requires a government API you do not have, say so explicitly.\n"
            "- Distinguish official procedure (cite the office/portal) from general guidance.\n"
            "- Keep an audit trail mindset: every recommendation should be traceable to a rule or source."
        ),
        "disclaimers": {
            "en": "🏛️ Procedural guidance, not an official government decision. Final status comes from the responsible agency.",
            "ru": "🏛️ Процедурная информация, а не официальное решение госоргана. Итоговый статус определяет ответственное ведомство.",
            "uz": "🏛️ Bu tartib-taomil bo'yicha yo'l-yo'riq — rasmiy davlat qarori emas. Yakuniy holatni mas'ul idora belgilaydi.",
        },
        "output_flags": [
            r"(?i)\byour application (is|has been) (approved|rejected)\b",
            r"(?i)\barizangiz (tasdiqlandi|rad etildi)\b",
            r"(?i)\bваша заявка (одобрена|отклонена)\b",
        ],
        "data_rules": [
            "Citizen data retention: only as long as the request lifecycle requires.",
            "Biometric data: local processing only (ZRU-547).",
            "No citizen record leaves the org's data boundary without a data-sharing agreement.",
        ],
    },
    "legal": {
        "label": {"en": "Legal compliance", "ru": "Юридический комплаенс", "uz": "Huquqiy muvofiqlik"},
        "system_addendum": (
            "MANDATORY LEGAL COMPLIANCE:\n"
            "- You are a drafting and research aid, not a lawyer; you do not create an "
            "attorney-client relationship.\n"
            "- Never guarantee the outcome of a case, dispute or filing.\n"
            "- Everything the user shares about their matter is confidential; do not reuse "
            "it outside this engagement.\n"
            "- When citing law, name the specific code/article and note that it must be "
            "verified as current.\n"
            "- End every substantive legal answer with the legal disclaimer."
        ),
        "disclaimers": {
            "en": "⚖️ Drafting/research assistance, not legal advice; verify with a licensed lawyer before acting.",
            "ru": "⚖️ Помощь в составлении/исследовании, а не юридическая консультация; перед действиями проверьте у лицензированного юриста.",
            "uz": "⚖️ Bu hujjat tayyorlash/tadqiqot yordami — yuridik maslahat emas; amal qilishdan oldin litsenziyali advokat bilan tekshiring.",
        },
        "output_flags": [
            r"(?i)\byou will (win|definitely win) (the|this) case\b",
            r"(?i)\bsud(da)? (aniq|albatta) (yutasiz|g'alaba)\b",
            r"(?i)\bвы (точно|гарантированно) выиграете\b",
            r"(?i)\bguaranteed to win\b",
        ],
        "data_rules": [
            "Matter details are confidential and scoped to this user only.",
            "Drafts carry a review-required watermark note.",
            "Cited statutes must include code + article for verification.",
        ],
    },
    "retail": {
        "label": {"en": "Retail operations", "ru": "Ритейл-операции", "uz": "Savdo operatsiyalari"},
        "system_addendum": (
            "RETAIL COMPLIANCE:\n"
            "- A camera/vision event alone NEVER proves theft. Always cross-reference POS "
            "and inventory records before alleging anything about a person.\n"
            "- Never name or describe a specific customer as a thief; report 'unmatched "
            "pickup event' with evidence instead.\n"
            "- Consumer-rights: promotions and price claims must be accurate."
        ),
        "disclaimers": {
            "en": "🛒 Vision events are signals, not proof — decisions require the cross-referenced evidence shown.",
            "ru": "🛒 События камер — это сигналы, а не доказательства; решения требуют сверенных данных.",
            "uz": "🛒 Kamera hodisalari isbot emas, signal — qaror uchun solishtirilgan dalillar kerak.",
        },
        "output_flags": [
            r"(?i)\b(this|that) (person|customer) (is a|stole)\b",
            r"(?i)\bbu (odam|mijoz) o'g'ri\b",
            r"(?i)\bэтот (человек|покупатель) (вор|украл)\b",
        ],
        "data_rules": [
            "Camera footage references stay local; only event metadata is processed.",
            "Person-level accusations are never auto-generated.",
        ],
    },
    "trade": {
        "label": {"en": "Cross-border trade compliance", "ru": "ВЭД-комплаенс", "uz": "Tashqi savdo muvofiqligi"},
        "system_addendum": (
            "TRADE COMPLIANCE:\n"
            "- Tariff/duty figures are reference estimates: always tell the user to confirm "
            "with the official customs tariff before contracting.\n"
            "- Screen goods and counterparties for restricted/dual-use categories and "
            "sanctioned destinations; if flagged, say clearly what needs a license check.\n"
            "- Customs documents you draft are templates that require broker/customs review."
        ),
        "disclaimers": {
            "en": "🚢 Reference estimates — confirm rates and restrictions with official customs sources before committing.",
            "ru": "🚢 Справочные оценки — перед сделкой подтвердите ставки и ограничения в официальных таможенных источниках.",
            "uz": "🚢 Bu ma'lumot taxminiy — bitimdan oldin stavka va cheklovlarni rasmiy bojxona manbalarida tasdiqlang.",
        },
        "output_flags": [
            r"(?i)\bno (license|permit) (is )?(needed|required)\b.{0,40}\b(weapon|dual-use)\b",
            r"(?i)\bcustoms will (definitely|certainly) (approve|clear)\b",
        ],
        "data_rules": [
            "Counterparty screening results are logged with the list version used.",
            "Draft customs documents are marked as requiring broker review.",
        ],
    },
}

# role_detection domenlari → pack sluglari
DOMAIN_TO_PACK = {
    "healthcare": "healthcare",
    "law": "legal",
    "government": "government",
    "finance": "finance",
    "retail": "retail",
    "logistics": "trade",
    "transport": "trade",
}


def get_pack(vertical: str | None) -> dict[str, Any] | None:
    if not vertical:
        return None
    return PACKS.get(vertical)


def pack_for_domain(domain: str | None) -> str | None:
    if not domain:
        return None
    return DOMAIN_TO_PACK.get(domain)


def packs_summary(language: str = "en") -> list[dict[str, Any]]:
    return [
        {
            "id": slug,
            "label": p["label"].get(language, p["label"]["en"]),
            "disclaimer": p["disclaimers"].get(language, p["disclaimers"]["en"]),
            "data_rules": p["data_rules"],
            "flag_patterns": len(p["output_flags"]),
        }
        for slug, p in PACKS.items()
    ]


def system_addendum(vertical: str | None) -> str:
    pack = get_pack(vertical)
    return pack["system_addendum"] if pack else ""


def check_output(text: str, vertical: str | None, language: str = "en") -> dict[str, Any]:
    """Chiqish matnini vertikal qoidalarga solishtiradi.

    Qaytadi: { violations: [pattern...], disclaimer_needed: bool, disclaimer: str }
    Matn o'zgartirilmaydi — chaqiruvchi disclaimer'ni qo'shadi va hodisani belgilaydi.
    """
    pack = get_pack(vertical)
    if not pack:
        return {"violations": [], "disclaimer_needed": False, "disclaimer": ""}

    violations = [pat for pat in pack["output_flags"] if re.search(pat, text)]
    disclaimer = pack["disclaimers"].get(language, pack["disclaimers"]["en"])
    # Disclaimer allaqachon javobda bo'lsa qayta qo'shilmaydi
    marker = disclaimer.split(" ")[0]  # emoji belgisi
    disclaimer_needed = marker not in text
    return {
        "violations": violations,
        "disclaimer_needed": disclaimer_needed,
        "disclaimer": disclaimer,
    }
