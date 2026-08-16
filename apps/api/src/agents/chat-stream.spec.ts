import { of, throwError } from 'rxjs';
import { AgentsService } from './agents.service';
import type { User } from '@prisma/client';

/**
 * SEC-10 / ADR-021 — chat oqimi endi engine'ga TO'G'RIDAN-TO'G'RI emas,
 * API orqali boradi (engine Render'da private service; frontend Vercel'da).
 *
 * Bu testlar shu yo'lning ikkita KRITIK xususiyatini qulflaydi:
 *   1. `user_id` engine'ga AUTENTIFIKATSIYALANGAN foydalanuvchidan ketadi —
 *      body'dan EMAS (aks holda "boshqa foydalanuvchi nomidan" yuborish mumkin).
 *   2. So'rov `responseType: 'stream'` bilan ketadi (aks holda axios butun
 *      javobni buferlaydi va SSE "jonli" bo'lmay qoladi — chat qotib qolardi).
 */

/** `http.post(url, body, config)` chaqiruv argumentlari — mock'ni tiplash uchun. */
type PostArgs = [string, Record<string, unknown>, Record<string, unknown>?];

function makeHttp(impl: () => unknown) {
  return { post: jest.fn(impl) as unknown as jest.Mock<unknown, PostArgs> };
}

function makeService(
  http: { post: jest.Mock<unknown, PostArgs> },
  connectorTools: Array<Record<string, unknown>> = [],
) {
  return new AgentsService(
    {} as never, // prisma — bu yo'lda ishlatilmaydi
    http as never,
    {} as never, // audit
    {} as never, // usage
    {} as never, // agentBilling
    {} as never, // billing
    { toolSpecsForAgent: jest.fn(async () => connectorTools) } as never,
  );
}

const user = { id: 'u1' } as unknown as User;

const dto = {
  agentDefinition: { agent_id: 'a1', name: 'Yordamchi' },
  message: 'Salom',
  conversationId: 'conv1',
  conversationHistory: [{ role: 'user', content: 'oldingi' }],
  profession: 'shifokor',
};

describe('AgentsService.openChatStream (SEC-10)', () => {
  const OLD_ENV = process.env.AGENT_ENGINE_URL;

  afterEach(() => {
    process.env.AGENT_ENGINE_URL = OLD_ENV;
    jest.restoreAllMocks();
  });

  it('engine\'ga `user_id`ni BODY\'dan emas, autentifikatsiyalangan userdan yuboradi', async () => {
    const http = makeHttp(() => of({ data: 'stream-obyekti' }));
    // Body'da boshqa user_id "kontrabanda" qilishga urinish — u E'TIBORGA
    // OLINMASLIGI shart (DTO uni umuman e'lon qilmaydi, xizmat esa user.id ishlatadi).
    await makeService(http).openChatStream(user, { ...dto, user_id: 'boshqa-odam' } as never);

    const [, body] = http.post.mock.calls[0];
    expect(body.user_id).toBe('u1');
  });

  it('engine sxemasiga (snake_case) to\'g\'ri o\'giradi', async () => {
    const http = makeHttp(() => of({ data: 'stream-obyekti' }));
    await makeService(http).openChatStream(user, dto);

    const [url, body] = http.post.mock.calls[0];
    expect(url).toMatch(/\/agents\/stream$/);
    expect(body).toEqual({
      // `tools` har doim serverda yig'iladi (ulangan konnektorlar shu yerga
      // qo'shiladi) — konnektorsiz foydalanuvchida bo'sh ro'yxat.
      agent_definition: { ...dto.agentDefinition, tools: [] },
      user_id: 'u1',
      message: 'Salom',
      conversation_id: 'conv1',
      conversation_history: dto.conversationHistory,
      profession: 'shifokor',
      // Model zanjiri tarifdan kelib chiqadi (pastdagi alohida testga qarang).
      tier: 'paid',
    });
  });

  it('tarifni SERVER hal qiladi: free -> OpenRouter zanjiri, pro -> Anthropic', async () => {
    const http = makeHttp(() => of({ data: 'stream-obyekti' }));
    const svc = makeService(http);

    await svc.openChatStream({ id: 'u1', plan: 'free', proUntil: null } as never, dto);
    expect((http.post.mock.calls[0][1] as { tier: string }).tier).toBe('free');

    await svc.openChatStream(
      { id: 'u2', plan: 'pro', proUntil: new Date(Date.now() + 999_999) } as never,
      dto,
    );
    expect((http.post.mock.calls[1][1] as { tier: string }).tier).toBe('paid');

    // Muddati o'tgan pro -> yana free (soxta pro yo'q)
    await svc.openChatStream(
      { id: 'u3', plan: 'pro', proUntil: new Date(Date.now() - 1) } as never,
      dto,
    );
    expect((http.post.mock.calls[2][1] as { tier: string }).tier).toBe('free');
  });

  it('ulangan konnektorlarni agent taʼrifiga tool sifatida qo\'shadi', async () => {
    const http = makeHttp(() => of({ data: 'stream-obyekti' }));
    const telegram = { tool_id: 'connector.telegram-bot', config: { connector_id: 'telegram-bot' } };
    await makeService(http, [telegram]).openChatStream(user, {
      ...dto,
      agentDefinition: { ...dto.agentDefinition, tools: [{ tool_id: 'utility.weather', config: {} }] },
    });

    const [, body] = http.post.mock.calls[0];
    expect((body.agent_definition as { tools: unknown[] }).tools).toEqual([
      { tool_id: 'utility.weather', config: {} },
      telegram,
    ]);
  });

  it('mijoz yuborgan soxta `connector.*` toolini TASHLAYDI (avtorizatsiya serverda)', async () => {
    const http = makeHttp(() => of({ data: 'stream-obyekti' }));
    // Foydalanuvchi soliq.uz'ni umuman ulamagan — server ro'yxati bo'sh.
    await makeService(http, []).openChatStream(user, {
      ...dto,
      agentDefinition: {
        ...dto.agentDefinition,
        tools: [{ tool_id: 'connector.soliq-uz', config: { connector_id: 'soliq-uz' } }],
      },
    });

    const [, body] = http.post.mock.calls[0];
    expect((body.agent_definition as { tools: unknown[] }).tools).toEqual([]);
  });

  it('ixtiyoriy maydonlar yo\'q bo\'lsa engine kutgan null/bo\'sh qiymatlar ketadi', async () => {
    const http = makeHttp(() => of({ data: 'stream-obyekti' }));
    await makeService(http).openChatStream(user, {
      agentDefinition: { agent_id: 'a1' },
      message: 'Salom',
    });

    const [, body] = http.post.mock.calls[0];
    expect(body.conversation_id).toBeNull();
    expect(body.conversation_history).toBeNull();
    expect(body.profession).toBe('');
  });

  it('`responseType: stream` bilan so\'raydi (buferlanmaydi — SSE jonli qoladi)', async () => {
    const http = makeHttp(() => of({ data: 'stream-obyekti' }));
    await makeService(http).openChatStream(user, dto);

    const [, , config] = http.post.mock.calls[0];
    expect(config).toEqual(expect.objectContaining({ responseType: 'stream' }));
  });

  it('engine javob bermasa istisno yuqoriga chiqadi (controller 503 qiladi -> BFF refund)', async () => {
    const http = makeHttp(() => throwError(() => new Error('ECONNREFUSED')));
    await expect(makeService(http).openChatStream(user, dto)).rejects.toThrow('ECONNREFUSED');
  });

  it('AGENT_ENGINE_URL berilgan bo\'lsa o\'shanga boradi (xususiy tarmoq manzili)', async () => {
    process.env.AGENT_ENGINE_URL = 'http://agentnet-engine-2j3e:8000';
    const http = makeHttp(() => of({ data: 'stream-obyekti' }));
    await makeService(http).openChatStream(user, dto);

    expect(http.post.mock.calls[0][0]).toBe('http://agentnet-engine-2j3e:8000/agents/stream');
  });
});
