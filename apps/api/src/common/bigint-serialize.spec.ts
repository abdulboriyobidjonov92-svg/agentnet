import { installBigIntJsonSerializer } from './bigint-serialize';

/**
 * A13 — pul `BigInt` bo'lgach, HAR BIR JSON javobi shu patchga tayanadi.
 * Usiz `JSON.stringify` butun javobni TypeError bilan yiqitardi.
 */
describe('installBigIntJsonSerializer', () => {
  beforeAll(() => installBigIntJsonSerializer());

  it('BigInt JSON\'da SATR sifatida chiqadi (aniqlik yo\'qolmaydi)', () => {
    expect(JSON.stringify({ balanceTiyin: 158_920_000n })).toBe('{"balanceTiyin":"158920000"}');
  });

  it('Number.MAX_SAFE_INTEGER dan KATTA qiymat aniq saqlanadi', () => {
    // Aynan shu holat uchun `Number` emas, satr tanlangan: `Number` bo'lsa
    // bu qiymat jimgina yaxlitlanardi (Int shiftini kattaroq shift bilan
    // almashtirgan bo'lardik).
    const huge = 9_007_199_254_740_993n; // 2^53 + 1
    expect(JSON.stringify({ v: huge })).toBe('{"v":"9007199254740993"}');
    expect(BigInt(JSON.parse(JSON.stringify({ v: huge })).v)).toBe(huge);
  });

  it('manfiy qiymat (xarajat/payout) to\'g\'ri chiqadi', () => {
    expect(JSON.stringify({ amount: -79_380_000n })).toBe('{"amount":"-79380000"}');
  });

  it('nol', () => {
    expect(JSON.stringify({ v: 0n })).toBe('{"v":"0"}');
  });

  it('ichma-ich obyekt va massivda ham ishlaydi (ledger ro\'yxati)', () => {
    const page = { items: [{ amount: 1n }, { amount: 2n }], total: 3n };
    expect(JSON.stringify(page)).toBe('{"items":[{"amount":"1"},{"amount":"2"}],"total":"3"}');
  });

  it('`toJSON` enumerable EMAS — spread/for-in ga tushmaydi', () => {
    // Aks holda `{...user}` natijasiga `toJSON` kaliti qo'shilib ketardi.
    expect(Object.keys(5n as unknown as object)).toEqual([]);
    const descriptor = Object.getOwnPropertyDescriptor(BigInt.prototype, 'toJSON');
    expect(descriptor?.enumerable).toBe(false);
  });

  it('idempotent — takroriy chaqiruv xato bermaydi', () => {
    expect(() => {
      installBigIntJsonSerializer();
      installBigIntJsonSerializer();
    }).not.toThrow();
    expect(JSON.stringify({ v: 7n })).toBe('{"v":"7"}');
  });

  it('boshqa turlarga tegmaydi', () => {
    expect(JSON.stringify({ n: 1, s: 'x', b: true, nul: null })).toBe(
      '{"n":1,"s":"x","b":true,"nul":null}',
    );
  });
});
