import { Logger, BadGatewayException, UnprocessableEntityException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/** agent-engine'ga POST qiluvchi umumiy klient — halal-block va tarmoq xatolarini bir xil ko'rinishga keltiradi. */
export class OperationsEngineClient {
  private readonly engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

  constructor(
    private readonly http: HttpService,
    private readonly logger: Logger,
  ) {}

  async call(path: string, body: unknown): Promise<any> {
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.engineUrl}${path}`, body, { timeout: 90_000 }),
      );
      return data;
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 422 && detail?.blocked) {
        throw new UnprocessableEntityException({ blocked: true, reason: detail.reason });
      }
      this.logger.error(`Engine xatosi (${path}): ${e.message}`);
      throw new BadGatewayException({ message: "Agent engine bilan aloqa yo'q", reason: 'engine_unavailable' });
    }
  }
}
