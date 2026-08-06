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

function makeService(http: { post: jest.Mock<unknown, PostArgs> }) {
  return new AgentsService(
    {} as never, // prisma — bu yo'lda ishlatilmaydi
    http as never,
    {} as never, // audit
    {} as never, // usage
    {} as never, // agentBilling
    {} as never, // billing
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
      agent_definition: dto.agentDefinition,
      user_id: 'u1',
      message: 'Salom',
      conversation_id: 'conv1',
      conversation_history: dto.conversationHistory,
      profession: 'shifokor',
    });
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
