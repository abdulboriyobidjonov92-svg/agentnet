import { MarketplaceController } from './marketplace.controller';
import type { User } from '@prisma/client';

const user = { id: 'u1' } as unknown as User;

function makeSvc() {
  return {
    listPublished: jest.fn(async () => []),
    creatorDashboard: jest.fn(async () => ({})),
    requestPayout: jest.fn(async () => ({})),
    publish: jest.fn(async () => ({})),
    unpublish: jest.fn(async () => undefined),
    install: jest.fn(async () => ({})),
    reviews: jest.fn(async () => []),
    review: jest.fn(async () => ({})),
  } as any;
}

describe('MarketplaceController — parametrlar to\'g\'ri uzatiladi', () => {
  it("list — search query'ni uzatadi (public, guardsiz)", async () => {
    const marketplace = makeSvc();
    const controller = new MarketplaceController(marketplace);

    await controller.list('retail');
    expect(marketplace.listPublished).toHaveBeenCalledWith('retail');
  });

  it("creatorDashboard — user'ni uzatadi", async () => {
    const marketplace = makeSvc();
    const controller = new MarketplaceController(marketplace);

    await controller.creatorDashboard(user);
    expect(marketplace.creatorDashboard).toHaveBeenCalledWith(user);
  });

  it("payout — user'ni uzatadi", async () => {
    const marketplace = makeSvc();
    const controller = new MarketplaceController(marketplace);

    await controller.payout(user);
    expect(marketplace.requestPayout).toHaveBeenCalledWith(user);
  });

  it("publish — user, agentId va body maydonlarini uzatadi", async () => {
    const marketplace = makeSvc();
    const controller = new MarketplaceController(marketplace);

    await controller.publish(user, 'a1', { price: 50_000, description: 'tavsif', monthlyPrice: 20_000 });
    expect(marketplace.publish).toHaveBeenCalledWith('a1', user, 50_000, 'tavsif', 20_000);
  });

  it("unpublish — agentId va user'ni uzatadi", async () => {
    const marketplace = makeSvc();
    const controller = new MarketplaceController(marketplace);

    await controller.unpublish(user, 'a1');
    expect(marketplace.unpublish).toHaveBeenCalledWith('a1', user);
  });

  it("install — agentId va user'ni uzatadi", async () => {
    const marketplace = makeSvc();
    const controller = new MarketplaceController(marketplace);

    await controller.install(user, 'a1');
    expect(marketplace.install).toHaveBeenCalledWith('a1', user);
  });

  it("reviews — agentId'ni uzatadi (public, guardsiz)", async () => {
    const marketplace = makeSvc();
    const controller = new MarketplaceController(marketplace);

    await controller.reviews('a1');
    expect(marketplace.reviews).toHaveBeenCalledWith('a1');
  });

  it("review — agentId, user, rating va comment'ni uzatadi", async () => {
    const marketplace = makeSvc();
    const controller = new MarketplaceController(marketplace);

    await controller.review(user, 'a1', { rating: 5, comment: "a'lo" });
    expect(marketplace.review).toHaveBeenCalledWith('a1', user, 5, "a'lo");
  });
});
