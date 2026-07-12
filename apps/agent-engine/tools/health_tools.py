"""
Sog'liq vositalari — LLM asosida triage va kaloriya hisoblash.
MUHIM: Bu vositalar tibbiy maslahat EMAS. Faqat ma'lumot beradi.
"""
import json
from anthropic import AsyncAnthropic

_client = AsyncAnthropic()

TRIAGE_PROMPT = """\
Sen sog'liq va fitnes yordamchisisan. MUHIM: Sen shifokor emassan va tibbiy tashxis qo'yolmaysan.
Foydalanuvchi simptomlarini tinglab, quyidagilarni qilasan:
1. Simptomlarning umumiy tavsifini ber
2. Shoshilinch holat belgilarini tekshir (agar bo'lsa DARHOL shifokorga borish kerakligini ayt)
3. Uy sharoitida nima qilish mumkinligini ayt
4. Shifokorga qachon murojaat qilish kerakligini ayt

Javobni quyidagi JSON formatda qaytar:
{
  "shoshilinch_daraja": "yuqori|o'rta|past",
  "asosiy_tavsif": "...",
  "uy_choralari": ["..."],
  "shifokorga_murojaat": "...",
  "ogohlantirish": "Men shifokor emasman. Bu faqat umumiy ma'lumot."
}"""

CALORIE_PROMPT = """\
Sen ovqatlanish yordamchisisan. Taqdim etilgan ovqat tavsifi yoki rasmiga qarab:
1. Taxminiy kaloriya miqdorini hisoblat
2. Asosiy makronutrientlarni ko'rsat (protein, uglevodlar, yog')
3. Qisqa tavsiya ber

Javobni quyidagi JSON formatda qaytar:
{
  "ovqat_nomi": "...",
  "taxminiy_kaloriya": 0,
  "protein_g": 0,
  "uglevod_g": 0,
  "yog_g": 0,
  "porsiya": "...",
  "tavsiya": "...",
  "aniqlik": "past|o'rta|yuqori"
}"""


async def symptom_check(simptomlar: list[str], yosh: int = 30, jinsi: str = "noma'lum") -> dict:
    """LLM asosida simptom tahlili va yo'naltirish."""
    simptomlar_str = ", ".join(simptomlar)
    prompt = f"Bemor: {yosh} yoshli, {jinsi}. Simptomlar: {simptomlar_str}"

    try:
        res = await _client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            system=TRIAGE_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = res.content[0].text.strip()
        # JSON ni ajratib olish
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end]) if start >= 0 else {"javob": raw}
    except Exception as e:
        return {
            "shoshilinch_daraja": "noma'lum",
            "xato": str(e),
            "ogohlantirish": "Iltimos, shifokorga murojaat qiling.",
        }


async def calorie_estimate(ovqat_tavsifi: str = "", rasm_base64: str = "") -> dict:
    """Ovqat tasviri yoki tavsifi asosida kaloriya hisoblash."""
    messages: list = []

    if rasm_base64:
        messages.append({
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": rasm_base64,
                    },
                },
                {"type": "text", "text": f"Bu ovqatning kaloriyasini hisoblang. Qo'shimcha tavsif: {ovqat_tavsifi}"},
            ],
        })
    else:
        messages.append({"role": "user", "content": f"Ovqat tavsifi: {ovqat_tavsifi}"})

    try:
        res = await _client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            system=CALORIE_PROMPT,
            messages=messages,
        )
        raw = res.content[0].text.strip()
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end]) if start >= 0 else {"javob": raw}
    except Exception as e:
        return {"xato": str(e), "ovqat_tavsifi": ovqat_tavsifi}
