import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { priceForAgent, usdUzsRate } from './agent-pricing';
import type { User } from '@prisma/client';

/**
 * Y9: bir-klik agent — tabiiy til tavsifidan bitta tayyor agent TAKLIFI
 * (nom, system-prompt, tool'lar) + narx. Agent YARATILMAYDI; foydalanuvchi
 * ko'rib, tasdiqlagach mavjud create() orqali yaratiladi. Texnik sozlash yo'q.
 */
export class AgentCompose {
  constructor(private readonly http: HttpService) {}

  async compose(user: User, description: string, language?: string) {
    const engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';
    const lang = language ?? user.preferredLanguage ?? 'en';

    let data: any;
    try {
      const res = await firstValueFrom(
        this.http.post(`${engineUrl}/agents/compose`, {
          description,
          language: lang,
          profession: user.professionTitle ?? '',
        }),
      );
      data = res.data;
    } catch (e: any) {
      // Halal Filter bloki engine'da 422 qaytaradi — tushunarli xato beramiz
      if (e?.response?.status === 422) {
        throw new BadRequestException(
          e.response.data?.detail ?? { message: "So'rovni qayta ifodalab ko'ring." },
        );
      }
      throw new ServiceUnavailableException({
        message: "Agent kompozitori hozir mavjud emas. Birozdan keyin qayta urinib ko'ring.",
        reason: 'engine_unavailable',
      });
    }

    const tools: Array<{ tool_id: string; config: Record<string, unknown> }> = data.tools ?? [];
    const price = priceForAgent(data.complexity ?? 3, tools.length, usdUzsRate());

    // POST /api/agents (CreateAgentDto) bilan mos "taklif" — tasdiqlangach shu yuboriladi.
    const proposal = {
      name: data.name,
      systemPrompt: data.system_prompt,
      model: data.model ?? 'claude-sonnet-4-6',
      toolsConfig: tools,
      ...(data.vertical ? { vertical: data.vertical } : {}),
      ...(data.reasoning ? { description: String(data.reasoning).slice(0, 300) } : {}),
      halalFilterEnabled: true,
      memoryEnabled: true,
    };

    return {
      proposal,
      meta: {
        domain: data.domain,
        vertical: data.vertical ?? null,
        complexity: price.complexity,
        reasoning: data.reasoning ?? '',
        method: data.method, // "llm" | "heuristic"
        matched: data.matched ?? null, // "custom_llm" | "domain_template" | null
        toolIds: tools.map((t) => t.tool_id),
        language: lang,
      },
      price,
    };
  }
}
