import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale, LOCALES, loadDictionary } from "./dictionary";

describe("isLocale", () => {
  it("qo'llab-quvvatlanadigan uchta tilni qabul qiladi", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ru")).toBe(true);
    expect(isLocale("uz")).toBe(true);
  });

  it("boshqa qiymatlarni rad etadi", () => {
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("LOCALES / DEFAULT_LOCALE", () => {
  it("uchta til, har biri isLocale tomonidan tan olinadi", () => {
    expect(LOCALES).toHaveLength(3);
    for (const l of LOCALES) expect(isLocale(l.code)).toBe(true);
  });

  it("DEFAULT_LOCALE 'en'", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });
});

describe("loadDictionary", () => {
  it("har bir locale mos chunkni yuklaydi va bir xil kalitlar to'plamiga ega", async () => {
    const [en, ru, uz] = await Promise.all([loadDictionary("en"), loadDictionary("ru"), loadDictionary("uz")]);

    expect(Object.keys(en).length).toBeGreaterThan(0);
    expect(new Set(Object.keys(ru))).toEqual(new Set(Object.keys(en)));
    expect(new Set(Object.keys(uz))).toEqual(new Set(Object.keys(en)));
  });

  it("noma'lum/kutilmagan locale -> standart (en) chunkka tushadi", async () => {
    const fallback = await loadDictionary("fr" as never);
    const en = await loadDictionary("en");
    expect(fallback).toEqual(en);
  });
});
