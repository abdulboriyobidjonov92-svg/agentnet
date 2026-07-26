import { GovtechController } from './govtech.controller';
import type { User } from '@prisma/client';

const user = { id: 'u1' } as unknown as User;

function makeSvc() {
  return {
    catalog: jest.fn(async () => ({ services: [], guides: [] })),
    intake: jest.fn(async () => ({})),
    list: jest.fn(async () => []),
    advance: jest.fn(async () => ({})),
    guide: jest.fn(async () => ({})),
  } as any;
}

describe('GovtechController — parametrlar to\'g\'ri uzatiladi', () => {
  it("catalog — user=null bilan chaqiradi (ochiq, autentifikatsiyasiz)", async () => {
    const govtech = makeSvc();
    const controller = new GovtechController(govtech);

    await controller.catalog();
    expect(govtech.catalog).toHaveBeenCalledWith(null);
  });

  it("intake — user va body'ni uzatadi", async () => {
    const govtech = makeSvc();
    const controller = new GovtechController(govtech);
    const body = { text: 'Propiska qanday olinadi?' };

    await controller.intake(user, body);
    expect(govtech.intake).toHaveBeenCalledWith(user, body);
  });

  it("list — user va status query'ni uzatadi", async () => {
    const govtech = makeSvc();
    const controller = new GovtechController(govtech);

    await controller.list(user, 'routed');
    expect(govtech.list).toHaveBeenCalledWith(user, 'routed');
  });

  it("advance — user, id va body'ni uzatadi", async () => {
    const govtech = makeSvc();
    const controller = new GovtechController(govtech);
    const body = { status: 'resolved' };

    await controller.advance(user, 'r1', body);
    expect(govtech.advance).toHaveBeenCalledWith(user, 'r1', body);
  });

  it("guide — user va body.query'ni ajratib uzatadi", async () => {
    const govtech = makeSvc();
    const controller = new GovtechController(govtech);

    await controller.guide(user, { query: 'pasport qanday olinadi' });
    expect(govtech.guide).toHaveBeenCalledWith(user, 'pasport qanday olinadi');
  });
});
