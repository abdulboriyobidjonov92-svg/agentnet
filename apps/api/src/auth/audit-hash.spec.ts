import { AUDIT_GENESIS, canonicalJson, canonicalize, computeEntryHash } from './audit-hash';

/**
 * A17 / ADR-008 — kanonik audit-hash shartnomasi.
 *
 * Bu testlar zanjirning ISHONCH xususiyatini qulflaydi. Har biri jonli
 * bazada topilgan aniq bir muammoga javob beradi:
 *   • kalit tartibi (jsonb qayta tartiblaydi),
 *   • undefined vs null (kirish obyektida yo'q, DB'da null),
 *   • Date vs ISO satr (Prisma Date qaytaradi, JSON'da satr).
 */

const base = {
  actorId: 'u1',
  action: 'agent.create',
  resourceType: 'agent',
  resourceId: 'a1',
  createdAt: new Date('2026-08-07T10:00:00.000Z'),
  metadata: { name: 'Test', tools: ['a', 'b'] },
};

describe('canonicalize', () => {
  it('obyekt kalitlarini tartiblaydi', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('ICHKI obyekt kalitlarini ham rekursiv tartiblaydi', () => {
    expect(canonicalJson({ z: { y: 1, x: 2 } })).toBe('{"z":{"x":2,"y":1}}');
  });

  it('massiv TARTIBINI saqlaydi (massiv — tartiblangan ma\'lumot)', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
  });

  it('massiv ichidagi obyektlarni ham kanonikga keltiradi', () => {
    expect(canonicalJson([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
  });

  it('undefined -> null (JSON\'da yo\'qolib ketmaydi)', () => {
    expect(canonicalize(undefined)).toBeNull();
    expect(canonicalJson({ a: undefined })).toBe('{"a":null}');
  });

  it('null -> null', () => {
    expect(canonicalJson({ a: null })).toBe('{"a":null}');
  });

  it('Date -> ISO satr (Prisma Date qaytaradi, DB matn saqlaydi)', () => {
    expect(canonicalize(new Date('2026-08-07T10:00:00.000Z'))).toBe('2026-08-07T10:00:00.000Z');
  });

  it('primitivlar o\'zgarmaydi', () => {
    expect(canonicalJson({ s: 'x', n: 1, b: true })).toBe('{"b":true,"n":1,"s":"x"}');
  });
});

describe('computeEntryHash — determinizm', () => {
  it('bir xil kirish -> bir xil hash', () => {
    expect(computeEntryHash(AUDIT_GENESIS, base)).toBe(computeEntryHash(AUDIT_GENESIS, base));
  });

  it('metadata KALIT TARTIBI hash\'ga ta\'sir qilmaydi (jsonb qayta tartiblaydi)', () => {
    const a = computeEntryHash(AUDIT_GENESIS, { ...base, metadata: { x: 1, y: 2 } });
    const b = computeEntryHash(AUDIT_GENESIS, { ...base, metadata: { y: 2, x: 1 } });
    expect(a).toBe(b);
  });

  it('createdAt Date yoki ISO satr — farqi yo\'q', () => {
    const a = computeEntryHash(AUDIT_GENESIS, base);
    const b = computeEntryHash(AUDIT_GENESIS, { ...base, createdAt: base.createdAt.toISOString() });
    expect(a).toBe(b);
  });

  it('resourceId null va undefined bir xil natija beradi', () => {
    const a = computeEntryHash(AUDIT_GENESIS, { ...base, resourceId: null });
    const b = computeEntryHash(AUDIT_GENESIS, {
      ...base,
      resourceId: undefined as unknown as null,
    });
    expect(a).toBe(b);
  });
});

describe('computeEntryHash — buzilishni sezish', () => {
  const original = computeEntryHash('prev-hash', base);

  it.each([
    ['actorId', { actorId: 'boshqa-odam' }],
    ['action', { action: 'agent.delete' }],
    ['resourceType', { resourceType: 'user' }],
    ['resourceId', { resourceId: 'a2' }],
    ['createdAt', { createdAt: new Date('2026-08-07T10:00:01.000Z') }],
    ['metadata', { metadata: { name: 'Boshqa', tools: ['a', 'b'] } }],
  ])('%s o\'zgarsa hash O\'ZGARADI', (_field, patch) => {
    expect(computeEntryHash('prev-hash', { ...base, ...patch })).not.toBe(original);
  });

  it('prevHash o\'zgarsa hash o\'zgaradi (zanjir bog\'lanishi)', () => {
    expect(computeEntryHash('boshqa-prev', base)).not.toBe(original);
  });

  it('metadata massiv TARTIBI o\'zgarsa hash o\'zgaradi', () => {
    const swapped = computeEntryHash('prev-hash', { ...base, metadata: { name: 'Test', tools: ['b', 'a'] } });
    expect(swapped).not.toBe(original);
  });

  it('hash sha256 shaklida (64 hex belgi)', () => {
    expect(original).toMatch(/^[0-9a-f]{64}$/);
  });
});
