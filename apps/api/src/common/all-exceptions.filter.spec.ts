import { HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

/**
 * SEC-08 regression: raw (non-HttpException) errors that carry a real HTTP
 * status (`.status`/`.statusCode`, the `http-errors` convention used by
 * Express/body-parser's `PayloadTooLargeError`) used to always fall through
 * to 500 here — meaning SEC-08's "so'rov > limit -> 413" DoD was silently
 * producing 500 in practice. Found via live verification, not assumed.
 */
describe('AllExceptionsFilter — raw status propagation (SEC-08)', () => {
  function mockHost() {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const res = { status };
    const req = { headers: {}, method: 'POST', url: '/api/billing/topup' };
    const host = {
      switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
    } as any;
    return { host, status, json };
  }

  it("PayloadTooLargeError shaklidagi xato (.status=413, HttpException emas) -> 413, ichki xato sifatida YASHIRILMAYDI", () => {
    const filter = new AllExceptionsFilter();
    const err = Object.assign(new Error('request entity too large'), { status: 413, statusCode: 413 });
    const { host, status, json } = mockHost();

    filter.catch(err, host);

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 413, message: 'request entity too large' }),
    );
  });

  it('haqiqiy HttpException — xulqi o\'zgarmagan (ilgari ham to\'g\'ri ishlagan)', () => {
    const filter = new AllExceptionsFilter();
    const err = new HttpException('Ruxsat yo\'q', HttpStatus.FORBIDDEN);
    const { host, status, json } = mockHost();

    filter.catch(err, host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ message: "Ruxsat yo'q" });
  });

  it("chinakam kutilmagan xato (status yo'q) -> 500, ichki tafsilot YASHIRILADI", () => {
    const filter = new AllExceptionsFilter();
    const err = new Error('undefined is not a function');
    const { host, status, json } = mockHost();

    filter.catch(err, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, reason: 'internal_error' }),
    );
    expect(json.mock.calls[0][0].message).not.toMatch(/undefined is not a function/);
  });

  it("status maydoni HTTP-status doirasidan tashqarida bo'lsa (masalan 9999) -> e'tiborsiz qoldiriladi, 500", () => {
    const filter = new AllExceptionsFilter();
    const err = Object.assign(new Error('weird'), { status: 9999 });
    const { host, status } = mockHost();

    filter.catch(err, host);

    expect(status).toHaveBeenCalledWith(500);
  });
});
