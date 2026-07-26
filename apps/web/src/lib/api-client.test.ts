import { describe, expect, it } from "vitest";
import { apiErrorMessage, blockedMessage } from "./api-client";

const t = (key: string) => {
  const dict: Record<string, string> = {
    "common.engineUnavailable": "Agent engine hozircha ishlamayapti",
    "common.insufficientBalance": "Balansingiz yetarli emas ({price} so'm kerak)",
    "common.agentLimitReached": "Agent chegarasi ({limit}) ga yetdingiz",
    "common.error": "Xatolik yuz berdi",
    "filter.blocked": "Bloklandi",
    "filter.blockedReason": "Bloklandi: {reason}",
  };
  return dict[key] ?? key;
};

describe("apiErrorMessage", () => {
  it("reason='engine_unavailable' -> tarjima qilingan xabar (xom message'ni EMAS)", () => {
    const err = { message: "Internal server error raw", payload: { reason: "engine_unavailable" } };
    expect(apiErrorMessage(err, t)).toBe("Agent engine hozircha ishlamayapti");
  });

  it("reason='insufficient_balance' -> narxni interpolatsiya qiladi (ru-RU minglik ajratkich bilan)", () => {
    const err = { payload: { reason: "insufficient_balance", creationPriceSom: 70000 } };
    expect(apiErrorMessage(err, t)).toContain("70");
    expect(apiErrorMessage(err, t)).not.toContain("{price}");
  });

  it("reason='insufficient_balance' lekin creationPriceSom yo'q -> narx interpolatsiya qilinmaydi (xom message'ga tushadi)", () => {
    const err = { message: "balans yetarli emas", payload: { reason: "insufficient_balance" } };
    expect(apiErrorMessage(err, t)).toBe("balans yetarli emas");
  });

  it("reason='agent_limit' -> limitni interpolatsiya qiladi", () => {
    const err = { payload: { reason: "agent_limit", limit: 5 } };
    expect(apiErrorMessage(err, t)).toBe("Agent chegarasi (5) ga yetdingiz");
  });

  it("noma'lum reason -> xom message'ga tushadi", () => {
    const err = { message: "Nimadir noto'g'ri ketdi", payload: { reason: "boshqa_sabab" } };
    expect(apiErrorMessage(err, t)).toBe("Nimadir noto'g'ri ketdi");
  });

  it("message ham, payload ham yo'q -> umumiy xato xabari", () => {
    expect(apiErrorMessage(undefined, t)).toBe("Xatolik yuz berdi");
    expect(apiErrorMessage({}, t)).toBe("Xatolik yuz berdi");
  });

  it("Error instance ham ishlaydi (message maydoni bor)", () => {
    expect(apiErrorMessage(new Error("tarmoq xatosi"), t)).toBe("tarmoq xatosi");
  });
});

describe("blockedMessage", () => {
  it("reason berilsa -> sababli xabar", () => {
    expect(blockedMessage("gambling", t)).toBe("Bloklandi: gambling");
  });

  it("reason yo'q/null/undefined -> oddiy xabar", () => {
    expect(blockedMessage(null, t)).toBe("Bloklandi");
    expect(blockedMessage(undefined, t)).toBe("Bloklandi");
    expect(blockedMessage("", t)).toBe("Bloklandi");
  });

  it("maxsus kalitlar berilsa o'shalarni ishlatadi", () => {
    const custom = { plain: "custom.plain", withReason: "custom.withReason" };
    const customT = (key: string) => (key === "custom.withReason" ? "Sabab: {reason}" : key);
    expect(blockedMessage("spam", customT, custom)).toBe("Sabab: spam");
  });
});
