import { of, throwError } from 'rxjs';
import { TradeController } from './trade.controller';
import type { User } from '@prisma/client';

/**
 * TradeController — bu modulda alohida TradeService YO'Q, engine-chaqiruv
 * mantig'i (halal-block vs engine-down) to'g'ridan-to'g'ri CONTROLLER'ning
 * o'zida yashaydi (boshqa modullarda bu odatda alohida servisda). Shu
 * sabab bu yerda goals/govtech/operations kabi servislarga yozgan xuddi
 * shu chuqurlikdagi testlar to'g'ridan-to'g'ri controllerga yoziladi.
 */

function makeMock() {
  const http = { post: jest.fn(), get: jest.fn() } as any;
  return { http };
}

const user = { id: 'u1', preferredLanguage: 'uz' } as unknown as User;

describe('TradeController — engine POST endpointlari (customs-docs/tariff/compliance)', () => {
  it("docs — user.preferredLanguage bilan engine'ga yuboradi", async () => {
    const { http } = makeMock();
    http.post.mockReturnValue(of({ data: { documents: ['invoice'] } }));
    const controller = new TradeController(http);

    const res = await controller.docs(user, { shipment: { weight: 10 } });

    expect(http.post).toHaveBeenCalledWith(
      'http://localhost:8000/trade/customs-docs',
      { shipment: { weight: 10 }, language: 'uz' },
      { timeout: 90_000 },
    );
    expect(res).toEqual({ documents: ['invoice'] });
  });

  it("docs — body.shipment berilmasa bo'sh obyekt bilan yuboradi", async () => {
    const { http } = makeMock();
    http.post.mockReturnValue(of({ data: {} }));
    const controller = new TradeController(http);

    await controller.docs(user, {} as any);
    expect(http.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ shipment: {} }), expect.anything());
  });

  it("tariff — destination berilmasa 'Uzbekistan' standart", async () => {
    const { http } = makeMock();
    http.post.mockReturnValue(of({ data: {} }));
    const controller = new TradeController(http);

    await controller.tariff(user, { goods: 'paxta' });
    expect(http.post).toHaveBeenCalledWith(
      expect.any(String),
      { goods: 'paxta', destination: 'Uzbekistan', language: 'uz' },
      expect.anything(),
    );
  });

  it("compliance — ixtiyoriy maydonlar berilmasa bo'sh satr bilan yuboradi", async () => {
    const { http } = makeMock();
    http.post.mockReturnValue(of({ data: {} }));
    const controller = new TradeController(http);

    await controller.compliance(user, { goods: 'paxta' });
    expect(http.post).toHaveBeenCalledWith(
      expect.any(String),
      { goods: 'paxta', origin: '', destination: '', counterparty: '', language: 'uz' },
      expect.anything(),
    );
  });

  it("engine 422 halal-block bersa -> UnprocessableEntityException (3 ta POST endpoint bir xil helperdan foydalanadi)", async () => {
    const { http } = makeMock();
    http.post.mockReturnValue(
      throwError(() => ({ response: { status: 422, data: { detail: { blocked: true, reason: 'sanctioned_goods' } } } })),
    );
    const controller = new TradeController(http);

    await expect(controller.docs(user, { shipment: {} })).rejects.toMatchObject({ status: 422 });
    await expect(controller.tariff(user, { goods: 'x' })).rejects.toMatchObject({ status: 422 });
    await expect(controller.compliance(user, { goods: 'x' })).rejects.toMatchObject({ status: 422 });
  });

  it("engine mavjud emas -> BadGatewayException (502), yiqilmaydi", async () => {
    const { http } = makeMock();
    http.post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
    const controller = new TradeController(http);

    await expect(controller.docs(user, { shipment: {} })).rejects.toMatchObject({ status: 502 });
  });
});

describe("TradeController.tracking — tashqi tracking API'ga proksi", () => {
  it("trackingNumber URL'ga encode qilib qo'shiladi", async () => {
    const { http } = makeMock();
    http.get.mockReturnValue(of({ data: { status: 'in_transit' } }));
    const controller = new TradeController(http);

    const res = await controller.tracking('AB 123/456');

    expect(http.get).toHaveBeenCalledWith(
      'http://localhost:8000/trade/tracking/' + encodeURIComponent('AB 123/456'),
      { timeout: 20_000 },
    );
    expect(res).toEqual({ status: 'in_transit' });
  });
});

describe('TradeController.fx — standart base/symbols', () => {
  it("base/symbols berilmasa standart qiymatlar bilan chaqiradi", async () => {
    const { http } = makeMock();
    http.get.mockReturnValue(of({ data: { rates: {} } }));
    const controller = new TradeController(http);

    await controller.fx();

    expect(http.get).toHaveBeenCalledWith(
      'http://localhost:8000/trade/fx',
      { params: { base: 'USD', symbols: 'UZS,EUR,RUB,CNY,KZT' }, timeout: 20_000 },
    );
  });

  it("base/symbols berilsa aynan shularni uzatadi", async () => {
    const { http } = makeMock();
    http.get.mockReturnValue(of({ data: { rates: {} } }));
    const controller = new TradeController(http);

    await controller.fx('EUR', 'USD,UZS');
    expect(http.get).toHaveBeenCalledWith(
      expect.any(String),
      { params: { base: 'EUR', symbols: 'USD,UZS' }, timeout: 20_000 },
    );
  });
});
