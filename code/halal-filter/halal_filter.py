"""
AgentNet -- Halal Filter (ko'p qatlamli kontent/amal filtri)
------------------------------------------------------------
Uch bosqich:
  1. Tezkor regex/lug'at-asoslangan bloklash (qimor, riba, fitna so'zlari)
  2. Embedding-asoslangan semantik o'xshashlik (haram toifalar vektoriga)
  3. Past ishonch holatlarida Claude orqali qat'iy JSON-formatdagi
     yakuniy klassifikatsiya

MUHIM: Bu texnik vosita -- rasmiy diniy fatvo manbai emas.
Production'ga chiqishdan oldin Shariah kengashi tomonidan
toifalar va chegara-holatlar tasdiqlanishi shart.

Talab qilinadigan paketlar:
  pip install anthropic numpy pydantic
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from enum import Enum

import numpy as np
from anthropic import AsyncAnthropic

client = AsyncAnthropic()  # ANTHROPIC_API_KEY env'dan o'qiladi


class Category(str, Enum):
    QIMOR = "QIMOR"
    RIBO = "RIBO"
    NOJOYA_KONTENT = "NOJOYA_KONTENT"
    FITNA = "FITNA"
    XAVFSIZ = "XAVFSIZ"
    NOANIQ = "NOANIQ"


class Action(str, Enum):
    BLOCK = "BLOCK"
    ALLOW = "ALLOW"
    HUMAN_REVIEW = "HUMAN_REVIEW"


@dataclass
class FilterResult:
    category: Category
    confidence: float
    reasoning: str
    action: Action
    layer: str  # "keyword" | "semantic" | "llm" -- qaysi bosqichda aniqlangan


# ------------------------------------------------------------------
# 1-bosqich: Lug'at-asoslangan tezkor bloklash
# ------------------------------------------------------------------

# Eslatma: bu ro'yxat namuna -- production uchun Shariah maslahatchi
# bilan kengaytirilgan, ko'p tilli (uz/ru/en/ar) lug'at kerak.
BLOCKLIST: dict[Category, list[str]] = {
    Category.QIMOR: [
        r"\bkazino\b", r"\blotereya\b", r"\bbukmeker\b", r"\bbahs\s+tikish\b",
        r"\bgambling\b", r"\bcasino\b", r"\bbetting\b",
    ],
    Category.RIBO: [
        r"\bfoizli\s+kredit\b", r"\briba\b", r"\busury\b", r"\binterest\s+rate\s+loan\b",
    ],
    Category.NOJOYA_KONTENT: [
        r"\bexplicit\b",  # to'liq lug'at production'da kengaytiriladi
    ],
    Category.FITNA: [
        r"\bnifoq\b", r"\bjangari\s+da'vat\b",
    ],
}

_COMPILED: dict[Category, list[re.Pattern]] = {
    cat: [re.compile(p, re.IGNORECASE) for p in patterns]
    for cat, patterns in BLOCKLIST.items()
}


def keyword_layer(text: str) -> FilterResult | None:
    for category, patterns in _COMPILED.items():
        for pattern in patterns:
            if pattern.search(text):
                return FilterResult(
                    category=category,
                    confidence=0.95,
                    reasoning=f"Lug'at qoidasiga mos keldi: '{pattern.pattern}'",
                    action=Action.BLOCK,
                    layer="keyword",
                )
    return None


# ------------------------------------------------------------------
# 2-bosqich: Semantik (embedding) o'xshashlik
# ------------------------------------------------------------------

# Har bir haram toifa uchun "ankor" iboralar -- bular embedding qilinib,
# foydalanuvchi matni bilan cosine-similarity orqali solishtiriladi.
CATEGORY_ANCHORS: dict[Category, list[str]] = {
    Category.QIMOR: ["pul tikish o'yini", "garov asosidagi o'yin", "omadga asoslangan daromad"],
    Category.RIBO: ["foiz asosida qarz berish", "kechiktirilgan to'lov jarimasi (foiz)"],
    Category.NOJOYA_KONTENT: ["odob-axloq doirasidan tashqari material"],
    Category.FITNA: ["diniy guruhlar orasida nifoq tarqatish"],
}

SEMANTIC_THRESHOLD = 0.82


class EmbeddingProvider:
    """Haqiqiy tizimda: voyage-3 yoki OpenAI text-embedding-3 ishlatiladi."""

    async def embed(self, text: str) -> np.ndarray:
        raise NotImplementedError("Real embedding modeliga ulang (masalan, Voyage AI)")


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))


async def semantic_layer(
    text: str, embedder: EmbeddingProvider, anchor_cache: dict[Category, list[np.ndarray]]
) -> FilterResult | None:
    text_vec = await embedder.embed(text)
    best_category: Category | None = None
    best_score = 0.0

    for category, anchor_vecs in anchor_cache.items():
        for anchor_vec in anchor_vecs:
            score = cosine_similarity(text_vec, anchor_vec)
            if score > best_score:
                best_score, best_category = score, category

    if best_category and best_score >= SEMANTIC_THRESHOLD:
        return FilterResult(
            category=best_category,
            confidence=round(best_score, 2),
            reasoning=f"Semantik o'xshashlik {best_score:.2f} ({best_category.value} ankoriga)",
            action=Action.HUMAN_REVIEW if best_score < 0.92 else Action.BLOCK,
            layer="semantic",
        )
    return None


# ------------------------------------------------------------------
# 3-bosqich: Claude orqali yakuniy klassifikatsiya (past ishonch holatida)
# ------------------------------------------------------------------

HALAL_CLASSIFIER_SYSTEM_PROMPT = """\
Sen AgentNet platformasidagi Halal Filter tizimisan. Vazifang --
foydalanuvchi xabari yoki agent javobini Islomiy me'yorlar nuqtai
nazaridan tasniflash, FATWO CHIQARISH EMAS.

Tekshiruv toifalari:
1. QIMOR -- bahs, lotereya, kazino, spekulyativ "garov" taklifi
2. RIBO -- foiz asosida kredit/qarz tavsiyasi yoki targ'iboti
3. NOJOYA_KONTENT -- explicit/zo'ravon/odob doirasidan tashqari material
4. FITNA -- diniy/millatlar/guruhlar orasida nifoq qo'zg'ovchi kontent
5. XAVFSIZ -- yuqoridagilarning hech biriga to'g'ri kelmaydi

Qoidalar:
- Faqat aniq belgilar asosida bahola; shubhali bo'lsa "NOANIQ" deb
  belgila va inson-tekshiruviga yubor (taxmin qilma).
- Diniy hukm chiqarma -- faqat tasniflash, sabab-izoh ber.
- Javobni FAQAT quyidagi JSON formatda qaytar, boshqa matn yozma:

{"category": "...", "confidence": 0.0, "reasoning": "...", "action": "BLOCK|ALLOW|HUMAN_REVIEW"}
"""


async def llm_layer(text: str, agent_name: str = "", direction: str = "kiruvchi") -> FilterResult:
    user_prompt = (
        f"Quyidagi matnni tasniflang:\n---\n{text}\n---\n"
        f"Kontekst: bu matn '{agent_name}' agenti orqali {direction} sifatida ishlov berilmoqda."
    )

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        system=HALAL_CLASSIFIER_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw = response.content[0].text
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # LLM format buzilsa -- xavfsiz tomonga og'ish: inson tekshiruviga yuborish
        return FilterResult(
            category=Category.NOANIQ,
            confidence=0.0,
            reasoning="LLM javobi JSON formatida emas -- xavfsizlik uchun inson tekshiruvi.",
            action=Action.HUMAN_REVIEW,
            layer="llm",
        )

    return FilterResult(
        category=Category(parsed["category"]),
        confidence=float(parsed["confidence"]),
        reasoning=parsed["reasoning"],
        action=Action(parsed["action"]),
        layer="llm",
    )


# ------------------------------------------------------------------
# Orkestrator -- uchta bosqichni ketma-ket qo'llaydi
# ------------------------------------------------------------------


class HalalFilter:
    def __init__(self, embedder: EmbeddingProvider | None = None):
        self.embedder = embedder
        self._anchor_cache: dict[Category, list[np.ndarray]] | None = None

    async def classify(
        self, text: str, *, agent_name: str = "", direction: str = "kiruvchi"
    ) -> FilterResult:
        # 1) Tezkor lug'at tekshiruvi (eng arzon, eng tez)
        result = keyword_layer(text)
        if result:
            await self._audit(text, result)
            return result

        # 2) Semantik tekshiruv (agar embedder ulangan bo'lsa)
        if self.embedder:
            result = await semantic_layer(text, self.embedder, self._anchor_cache or {})
            if result:
                await self._audit(text, result)
                return result

        # 3) LLM-asoslangan yakuniy tekshiruv
        result = await llm_layer(text, agent_name=agent_name, direction=direction)
        await self._audit(text, result)
        return result

    async def _audit(self, text: str, result: FilterResult) -> None:
        """Har bir qaror sababi bilan audit-log'ga yoziladi (shaffoflik uchun)."""
        # Haqiqiy tizimda: AuditLogService.record(...) ga ulanadi (auth.service.ts dagi kabi)
        print(
            f"[HALAL_FILTER_AUDIT] layer={result.layer} category={result.category} "
            f"action={result.action} confidence={result.confidence} text_preview={text[:50]!r}"
        )
