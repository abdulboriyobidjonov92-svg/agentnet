/**
 * P0-6 — tasdiqlangan amalni tekshirish.
 *
 * ⚠️ BU IMTIYOZ OSHIRISH YUZASI. Tasdiq oynasida foydalanuvchi bitta
 * amalni ko'radi; agar tahrirlashda boshqasiga almashtirib yuborsa,
 * policy engine bergan qaror BOSHQA amalga ko'chirilardi. Shu fayldagi
 * testlar aynan shuni qulflaydi.
 */

import { BadRequestException } from '@nestjs/common';
import { parseProposedAction, resolveApprovedAction } from './approved-action';

const PROPOSED = {
  connector: 'telegram-bot',
  action: 'send_message',
  params: { chat_id: '111', text: 'salom' },
};

describe('parseProposedAction', () => {
  it('to‘g‘ri shaklni o‘qiydi', () => {
    expect(parseProposedAction(PROPOSED)).toEqual(PROPOSED);
  });

  it('params yo‘q bo‘lsa bo‘sh obyekt', () => {
    expect(parseProposedAction({ connector: 'a', action: 'b' })).toEqual({
      connector: 'a',
      action: 'b',
      params: {},
    });
  });

  it.each([null, undefined, 42, 'matn', {}, { connector: 'a' }, { action: 'b' }])(
    'yaroqsizni rad etadi: %p',
    (raw) => expect(parseProposedAction(raw)).toBeNull(),
  );

  it('params massiv bo‘lsa bo‘sh obyektga tushadi (shakl buzilmaydi)', () => {
    expect(parseProposedAction({ connector: 'a', action: 'b', params: [1, 2] })?.params).toEqual({});
  });
});

describe('resolveApprovedAction — tahrirsiz', () => {
  it('taklifning o‘zini qaytaradi', () => {
    expect(resolveApprovedAction(PROPOSED, null)).toEqual(PROPOSED);
  });

  it('taklif buzuq bo‘lsa ANIQ xato (jimgina o‘tmaydi)', () => {
    expect(() => resolveApprovedAction({ connector: 'a' }, null)).toThrow(BadRequestException);
  });
});

describe('⚠️ resolveApprovedAction — TAHRIRLASH CHEGARASI', () => {
  it('faqat parametrlar o‘zgaradi', () => {
    const out = resolveApprovedAction(PROPOSED, {
      ...PROPOSED,
      params: { chat_id: '222', text: 'tuzatilgan' },
    });
    expect(out).toEqual({
      connector: 'telegram-bot',
      action: 'send_message',
      params: { chat_id: '222', text: 'tuzatilgan' },
    });
  });

  it('faqat `params` berilsa ham ishlaydi', () => {
    const out = resolveApprovedAction(PROPOSED, { params: { chat_id: '333' } });
    expect(out.connector).toBe('telegram-bot');
    expect(out.action).toBe('send_message');
    expect(out.params).toEqual({ chat_id: '333' });
  });

  it('⚠️ KONNEKTORNI almashtirib bo‘lmaydi (to‘lovga o‘tkazish urinishi)', () => {
    expect(() =>
      resolveApprovedAction(PROPOSED, {
        connector: 'payme-merchant',
        action: 'send_message',
        params: {},
      }),
    ).toThrow(BadRequestException);
  });

  it('⚠️ AMALNI almashtirib bo‘lmaydi', () => {
    expect(() =>
      resolveApprovedAction(PROPOSED, {
        connector: 'telegram-bot',
        action: 'delete_chat',
        params: {},
      }),
    ).toThrow(BadRequestException);
  });

  it('ikkalasi ham almashtirilsa ham rad etiladi', () => {
    expect(() =>
      resolveApprovedAction(PROPOSED, {
        connector: 'payme-merchant',
        action: 'create_invoice',
        params: { amount: 999999 },
      }),
    ).toThrow(BadRequestException);
  });

  it('tuzatilgan amal shakli buzuq bo‘lsa rad etiladi', () => {
    expect(() => resolveApprovedAction(PROPOSED, 'shunchaki matn')).toThrow(BadRequestException);
    expect(() => resolveApprovedAction(PROPOSED, { nimadir: 1 })).toThrow(BadRequestException);
  });
});
