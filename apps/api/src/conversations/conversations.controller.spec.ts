import { ConversationsController } from './conversations.controller';
import type { User } from '@prisma/client';

const user = { id: 'u1' } as unknown as User;

function makeSvc() {
  return {
    create: jest.fn(async () => ({})),
    findAll: jest.fn(async () => []),
    findOne: jest.fn(async () => ({})),
    addMessage: jest.fn(async () => ({})),
    addMessages: jest.fn(async () => ({})),
    clear: jest.fn(async () => ({})),
    remove: jest.fn(async () => undefined),
  } as any;
}

describe('ConversationsController — parametrlar to\'g\'ri uzatiladi', () => {
  it("create — user va body.agentId'ni uzatadi", async () => {
    const conversations = makeSvc();
    const controller = new ConversationsController(conversations);

    await controller.create(user, { agentId: 'a1' });
    expect(conversations.create).toHaveBeenCalledWith(user, 'a1');
  });

  it("findAll — user va agentId query'ni uzatadi", async () => {
    const conversations = makeSvc();
    const controller = new ConversationsController(conversations);

    await controller.findAll(user, 'a1');
    expect(conversations.findAll).toHaveBeenCalledWith(user, 'a1');
  });

  it('findOne — id va user\'ni uzatadi', async () => {
    const conversations = makeSvc();
    const controller = new ConversationsController(conversations);

    await controller.findOne(user, 'c1');
    expect(conversations.findOne).toHaveBeenCalledWith('c1', user);
  });
});

describe("ConversationsController.addMessage — timestamp mantig'i", () => {
  it("message.timestamp berilmagan bo'lsa hozirgi ISO vaqt bilan to'ldiradi", async () => {
    const conversations = makeSvc();
    const controller = new ConversationsController(conversations);

    await controller.addMessage(user, 'c1', { role: 'user', content: 'salom' });

    const sent = conversations.addMessage.mock.calls[0][2];
    expect(sent.role).toBe('user');
    expect(sent.content).toBe('salom');
    expect(() => new Date(sent.timestamp).toISOString()).not.toThrow();
  });

  it("message.timestamp berilgan bo'lsa O'ZGARTIRILMAYDI", async () => {
    const conversations = makeSvc();
    const controller = new ConversationsController(conversations);

    await controller.addMessage(user, 'c1', { role: 'user', content: 'salom', timestamp: '2020-01-01T00:00:00Z' });

    expect(conversations.addMessage.mock.calls[0][2].timestamp).toBe('2020-01-01T00:00:00Z');
  });
});

describe("ConversationsController.addMessages — bulk timestamp mantig'i", () => {
  it("har bir xabarga alohida timestamp qo'shadi (berilmaganlarga)", async () => {
    const conversations = makeSvc();
    const controller = new ConversationsController(conversations);

    await controller.addMessages(user, 'c1', {
      messages: [
        { role: 'user', content: 'birinchi' },
        { role: 'assistant', content: 'ikkinchi', timestamp: '2020-01-01T00:00:00Z' },
      ],
    });

    const sent = conversations.addMessages.mock.calls[0][2];
    expect(sent).toHaveLength(2);
    expect(() => new Date(sent[0].timestamp).toISOString()).not.toThrow();
    expect(sent[1].timestamp).toBe('2020-01-01T00:00:00Z');
  });

  it("messages berilmasa bo'sh ro'yxat bilan chaqiradi (yiqilmaydi)", async () => {
    const conversations = makeSvc();
    const controller = new ConversationsController(conversations);

    await controller.addMessages(user, 'c1', {} as any);
    expect(conversations.addMessages).toHaveBeenCalledWith('c1', user, []);
  });
});

describe('ConversationsController.clear / remove', () => {
  it('clear — id va user\'ni uzatadi', async () => {
    const conversations = makeSvc();
    const controller = new ConversationsController(conversations);

    await controller.clear(user, 'c1');
    expect(conversations.clear).toHaveBeenCalledWith('c1', user);
  });

  it("remove — id va user'ni uzatadi", async () => {
    const conversations = makeSvc();
    const controller = new ConversationsController(conversations);

    await controller.remove(user, 'c1');
    expect(conversations.remove).toHaveBeenCalledWith('c1', user);
  });
});
