import { divideTiyin, somToTiyin, tiyinToSom } from './money';

/**
 * A13 — pul konvertatsiyasi. Bu funksiyalar butun UI'dagi summalarni
 * belgilaydi, shuning uchun yaxlitlash xulqi ilgarigi `Math.round(x / 100)`
 * bilan AYNAN bir xil bo'lishi kerak (regressiya bo'lmasin).
 */
describe('tiyinToSom', () => {
  it('aniq bo\'linadigan qiymat', () => {
    expect(tiyinToSom(158_920_000n)).toBe(1_589_200);
  });

  it('yarim-yuqoriga yaxlitlaydi (Math.round bilan bir xil)', () => {
    expect(tiyinToSom(150n)).toBe(2); // 1.5 -> 2
    expect(tiyinToSom(149n)).toBe(1); // 1.49 -> 1
  });

  it('manfiy qiymat (xarajat) — kattalik bo\'yicha yaxlitlanadi', () => {
    expect(tiyinToSom(-150n)).toBe(-2);
    expect(tiyinToSom(-149n)).toBe(-1);
    expect(tiyinToSom(-79_380_000n)).toBe(-793_800);
  });

  it('nol', () => expect(tiyinToSom(0n)).toBe(0));

  it('Int shiftidan (21.4 mln so\'m) KATTA qiymat — A13 aynan shu uchun', () => {
    // 2^31-1 tiyin = 21 474 836 so'm edi. Endi chegara yo'q.
    expect(tiyinToSom(500_000_000_000n)).toBe(5_000_000_000);
  });
});

describe('somToTiyin', () => {
  it('so\'m -> tiyin', () => expect(somToTiyin(5000)).toBe(500_000n));
  it('kasr so\'m yaxlitlanadi', () => expect(somToTiyin(10.994)).toBe(1099n));
  it('nol', () => expect(somToTiyin(0)).toBe(0n));
});

describe('somToTiyin -> tiyinToSom aylanma', () => {
  it.each([0, 1, 500, 5000, 1_589_200])('%s so\'m aylanib qaytadi', (som) => {
    expect(tiyinToSom(somToTiyin(som))).toBe(som);
  });
});

describe('divideTiyin', () => {
  it('nechta xabar qolgani', () => expect(divideTiyin(158_920_000n, 50_000n)).toBe(3178));
  it('butun bo\'lish — qoldiq tashlanadi', () => expect(divideTiyin(99n, 50n)).toBe(1));
  it('narx 0 yoki manfiy -> 0 (nolga bo\'lish yo\'q)', () => {
    expect(divideTiyin(100n, 0n)).toBe(0);
    expect(divideTiyin(100n, -5n)).toBe(0);
  });
  it('balans narxdan kam -> 0', () => expect(divideTiyin(10n, 50n)).toBe(0));
});
