import { ValidationPipe } from '@nestjs/common';
import {
  CommandDto,
  SendSmsPayload,
  CallPayload,
  OpenAppPayload,
  ComputerUsePayload,
} from './device-control.controller';

/**
 * SEC-08 DoD — "CommandDto.payload har kind uchun aniq DTO bilan
 * validatsiya qilinadi... har payload turi uchun validatsiya testi."
 *
 * Global pipe bilan AYNAN bir xil sozlama (`whitelist: true,
 * transform: true`) — haqiqiy ishlab-chiqarish xulqini takrorlaydi,
 * xuddi SEC-05'dagi UpdateProfileDto testi kabi.
 */
describe('CommandDto.payload — kind-ga bog\'liq shakl tekshiruvi (SEC-08)', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const meta = { type: 'body' as const, metatype: CommandDto };

  it("send_sms: to'g'ri shakl -> o'tadi", async () => {
    await expect(
      pipe.transform({ kind: 'send_sms', payload: { to: '+998901234567', text: 'Salom' } }, meta),
    ).resolves.toBeDefined();
  });

  it("send_sms: payload'da text yo'q -> rad etiladi", async () => {
    await expect(
      pipe.transform({ kind: 'send_sms', payload: { to: '+998901234567' } }, meta),
    ).rejects.toThrow();
  });

  it("call: to'g'ri shakl -> o'tadi", async () => {
    await expect(
      pipe.transform({ kind: 'call', payload: { to: '+998901234567' } }, meta),
    ).resolves.toBeDefined();
  });

  it("call: to'liq bo'sh payload -> rad etiladi", async () => {
    await expect(pipe.transform({ kind: 'call', payload: {} }, meta)).rejects.toThrow();
  });

  it("open_app: to'g'ri shakl -> o'tadi", async () => {
    await expect(
      pipe.transform({ kind: 'open_app', payload: { appId: 'com.example.app' } }, meta),
    ).resolves.toBeDefined();
  });

  it("open_app: appId noto'g'ri tur (raqam) -> rad etiladi", async () => {
    await expect(
      pipe.transform({ kind: 'open_app', payload: { appId: 12345 } }, meta),
    ).rejects.toThrow();
  });

  it("computer_use: to'g'ri shakl -> o'tadi", async () => {
    await expect(
      pipe.transform({ kind: 'computer_use', payload: { goal: 'Ob-havoni tekshir' } }, meta),
    ).resolves.toBeDefined();
  });

  it('computer_use: goal juda qisqa -> rad etiladi', async () => {
    await expect(
      pipe.transform({ kind: 'computer_use', payload: { goal: 'ab' } }, meta),
    ).rejects.toThrow();
  });

  it("noto'g'ri kind (validatsiyadan umuman o'tmaydi) -> rad etiladi", async () => {
    await expect(
      pipe.transform({ kind: 'delete_everything', payload: { goal: 'x' } }, meta),
    ).rejects.toThrow();
  });

  it("MOS KELMAGAN kind+payload (masalan send_sms'ning shakli computer_use'ga berilgan) -> rad etiladi", async () => {
    // send_sms shakli ({to, text}) computer_use kind'iga beriladi — computer_use
    // {goal} kutadi, shuning uchun rad etilishi SHART (aks holda kind faqat
    // "ishonch bilan" ishlatilib, payload haqiqatan tekshirilmagan bo'lardi).
    await expect(
      pipe.transform({ kind: 'computer_use', payload: { to: '+998901234567', text: 'Salom' } }, meta),
    ).rejects.toThrow();
  });
});

/** DTO klasslarining o'zi to'g'ri eksport qilinganini va mustaqil ishlatilishini tasdiqlaydi. */
describe('Payload DTO klasslari — mustaqil eksport (SEC-08)', () => {
  it('4 ta DTO ham eksport qilingan va konstruktor sifatida chaqirsa bo\'ladi', () => {
    expect(new SendSmsPayload()).toBeInstanceOf(SendSmsPayload);
    expect(new CallPayload()).toBeInstanceOf(CallPayload);
    expect(new OpenAppPayload()).toBeInstanceOf(OpenAppPayload);
    expect(new ComputerUsePayload()).toBeInstanceOf(ComputerUsePayload);
  });
});
