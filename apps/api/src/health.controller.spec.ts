import { HealthController } from './health.controller';

describe('HealthController', () => {
  it("status='ok' va ISO timestamp bilan javob beradi (autentifikatsiyasiz)", () => {
    const controller = new HealthController();

    const res = controller.check();

    expect(res.status).toBe('ok');
    expect(res.service).toBe('api');
    expect(() => new Date(res.ts).toISOString()).not.toThrow();
  });
});
