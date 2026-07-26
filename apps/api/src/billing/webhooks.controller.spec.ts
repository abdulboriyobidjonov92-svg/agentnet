import { WebhooksController } from './webhooks.controller';

describe('WebhooksController.clickWebhook', () => {
  it("body'ni ClickService.handleWebhook'ga o'zgarishsiz uzatadi", async () => {
    const click = { handleWebhook: jest.fn(async () => ({ error: 0 })) } as any;
    const controller = new WebhooksController(click);

    const res = await controller.clickWebhook({ click_trans_id: '123', action: 0 });

    expect(click.handleWebhook).toHaveBeenCalledWith({ click_trans_id: '123', action: 0 });
    expect(res).toEqual({ error: 0 });
  });

  it("body null/undefined bo'lsa bo'sh obyekt uzatadi (yiqilmaydi)", async () => {
    const click = { handleWebhook: jest.fn(async () => ({ error: -8 })) } as any;
    const controller = new WebhooksController(click);

    await controller.clickWebhook(null as any);

    expect(click.handleWebhook).toHaveBeenCalledWith({});
  });
});
