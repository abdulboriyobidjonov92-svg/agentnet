import {
  allTemplates,
  TEMPLATE_REGISTRY,
  assembleTools,
  buildSystemPrompt,
  templateDepth,
} from './registry';
import { TemplatesService } from './templates.service';

describe('Y3 shablon registri', () => {
  it('roppa-rosa 20 ta shablon bor', () => {
    expect(allTemplates()).toHaveLength(20);
  });

  it("HAR shablonda kamida bitta BASHORAT va bitta AVTONOM modul bor (brief talabi)", () => {
    for (const t of allTemplates()) {
      const d = templateDepth(t);
      expect(d.prediction).toBe(true); // shunchaki eslatma boti emas
      expect(d.autonomous).toBe(true); // odam aralashuvisiz harakat
    }
  });

  it('1-shablon (do\'kon egasi) — bayroqdor ★★★★★, $70/$40', () => {
    const t = TEMPLATE_REGISTRY['shop-owner'];
    expect(t.complexity).toBe(5);
    expect(t.createUsd).toBe(70);
    expect(t.monthlyUsd).toBe(40);
    // kamera fuziyasi + tugash bashorati + avto-buyurtma
    expect(t.moduleIds).toEqual(expect.arrayContaining(['stockout_forecast', 'auto_reorder']));
  });

  it('buildSystemPrompt modullarni + til-bandini yig\'adi', () => {
    const sp = buildSystemPrompt(TEMPLATE_REGISTRY['shop-owner'], 'uz');
    expect(sp).toContain('Always reply in the language the user writes in.');
    expect(sp.toLowerCase()).toContain('predict'); // bashorat tamoyili
    expect(sp).toContain('runs out'); // stockout_forecast fragmenti
  });

  it('compliance vertical → disclaimer prompt\'ga qo\'shiladi', () => {
    const sp = buildSystemPrompt(TEMPLATE_REGISTRY['doctor'], 'uz');
    expect(sp.toLowerCase()).toContain('diagnosis'); // "never a diagnosis or licensed medical advice"
  });

  it('assembleTools takrorsiz tool_id qaytaradi', () => {
    for (const t of allTemplates()) {
      const ids = assembleTools(t).map((x) => x.tool_id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

// Ijtimoiy dalil (installCounts) uchun minimal Prisma mock
const prismaMock = (counts: Record<string, number> = {}) => ({
  agent: {
    groupBy: jest.fn(async () =>
      Object.entries(counts).map(([templateId, n]) => ({ templateId, _count: { _all: n } })),
    ),
  },
});

describe('TemplatesService (list / match / install)', () => {
  beforeEach(() => {
    process.env.USD_UZS_RATE = '12600';
  });

  it('list — murakkablik bo\'yicha kamayadi, narx so\'mda', async () => {
    const svc = new TemplatesService(null as any, prismaMock() as any);
    const list = await svc.list('uz');
    expect(list).toHaveLength(20);
    expect(list[0].complexity).toBeGreaterThanOrEqual(list[1].complexity);
    const shop = list.find((x) => x.id === 'shop-owner')!;
    expect(shop.price.createSom).toBe(70 * 12_600);
    expect(shop.depth).toEqual({ prediction: true, autonomous: true });
  });

  it('list — REAL install-count va Top belgisi (>=3 va eng ko\'p)', async () => {
    const svc = new TemplatesService(null as any, prismaMock({ 'shop-owner': 5, farmer: 2 }) as any);
    const list = await svc.list('uz');
    const shop = list.find((x) => x.id === 'shop-owner')!;
    const farmer = list.find((x) => x.id === 'farmer')!;
    expect(shop.installCount).toBe(5);
    expect(shop.top).toBe(true);
    expect(farmer.installCount).toBe(2);
    expect(farmer.top).toBe(false); // <3 o'rnatish — "Top" deyish halol emas
    expect(list[0].id).toBe('shop-owner'); // eng ko'p o'rnatilgan birinchi
  });

  it('match — kasb kalit so\'zidan to\'g\'ri shablon', () => {
    const svc = new TemplatesService(null as any, prismaMock() as any);
    expect(svc.match("Menga do'konim uchun yordamchi kerak", 'uz')[0].id).toBe('shop-owner');
    expect(svc.match('avtoservis ochdim', 'uz')[0].id).toBe('auto-service');
    expect(svc.match('fermerman', 'uz')[0].id).toBe('farmer');
  });

  it('match — moslik yo\'q → bo\'sh (Y9 custom-oqimga yo\'naltiriladi)', () => {
    const svc = new TemplatesService(null as any, prismaMock() as any);
    expect(svc.match('qwerty zxcv 123', 'uz')).toHaveLength(0);
  });

  it('match — matchPercent: 2+ kalit so\'z hit -> 70%+ (Y9 "tayyor agent bor" taklifi shu chegaradan boshlanadi)', () => {
    const svc = new TemplatesService(null as any, prismaMock() as any);
    // Ikkita kalit so'z ("do'kon" va "tovar") — kuchli signal, 100%
    const strong = svc.match("Do'konim uchun tovar hisobi yurituvchi kerak", 'uz')[0];
    expect(strong.id).toBe('shop-owner');
    expect(strong.matchPercent).toBe(100);
    expect(strong.matchPercent).toBeGreaterThanOrEqual(70);

    // Bitta kalit so'z — zaifroq signal, 70% dan PAST (taklif ko'rsatilmaydi)
    const weak = svc.match('avtoservis ochdim', 'uz')[0];
    expect(weak.matchPercent).toBeLessThan(70);
  });

  it('install — mavjud AgentsService.create bilan real agent yaratadi', async () => {
    const created: any[] = [];
    const agentsMock = {
      create: jest.fn(async (_user: any, dto: any) => {
        created.push(dto);
        return { id: 'agent-1', ...dto };
      }),
    };
    const svc = new TemplatesService(agentsMock as any, prismaMock() as any);
    const user = { id: 'u1', preferredLanguage: 'uz' } as any;

    const res = await svc.install(user, 'shop-owner');
    expect(agentsMock.create).toHaveBeenCalledTimes(1);
    const dto = created[0];
    expect(dto.name).toBe("Do'kon egasi");
    expect(dto.vertical).toBe('retail');
    expect(dto.systemPrompt).toContain('runs out'); // modullardan yig'ilgan
    expect(dto.toolsConfig.length).toBeGreaterThan(0);
    expect(res.agent.id).toBe('agent-1');
  });

  it('install — noma\'lum shablon → xato', async () => {
    const svc = new TemplatesService({ create: jest.fn() } as any, prismaMock() as any);
    await expect(svc.install({ id: 'u1' } as any, 'yo-q-shablon')).rejects.toThrow();
  });
});
