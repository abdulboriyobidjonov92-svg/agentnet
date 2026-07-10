import { Injectable, Logger, NotFoundException, ForbiddenException, BadGatewayException, UnprocessableEntityException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/auth.service';
import { TwinService } from '../twin/twin.service';
import type { User } from '@prisma/client';

/**
 * Autonomous Goal Achievement.
 * Maqsad matni → engine dekompozitsiyasi → Goal + GoalTask'lar.
 * Har kuni cron faol maqsadlarning navbatdagi vazifalarini o'zi yuritadi —
 * foydalanuvchi rejani boshqarmaydi, natijalarni oladi.
 */
@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);
  private readonly engineUrl = process.env.AGENT_ENGINE_URL ?? 'http://localhost:8000';

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditLogService,
    private readonly twin: TwinService,
  ) {}

  async create(user: User, title: string) {
    const facts = await this.twin.factsForEngine(user.id);
    let plan: any;
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.engineUrl}/goals/decompose`, {
          goal_text: title,
          facts,
          profession: user.professionTitle ?? '',
          language: user.preferredLanguage ?? 'en',
        }),
      );
      plan = data;
    } catch (e: any) {
      this.rethrowEngine(e);
    }

    const goal = await this.prisma.goal.create({
      data: {
        userId: user.id,
        title: plan.title ?? title,
        description: plan.reasoning ?? null,
        plan: { milestones: plan.milestones, method: plan.method, reasoning: plan.reasoning },
        status: 'active',
      },
    });

    // Milestone tasklari tekis ro'yxatga yoziladi (order — global ketma-ketlik)
    let order = 0;
    for (const milestone of plan.milestones ?? []) {
      for (const task of milestone.tasks ?? []) {
        await this.prisma.goalTask.create({
          data: {
            goalId: goal.id,
            order: order++,
            title: `${milestone.title} — ${task.title}`,
            description: task.description ?? null,
            agentRole: task.agent_role ?? null,
            cadence: task.cadence ?? 'once',
          },
        });
      }
    }

    await this.audit.record({ actorId: user.id, action: 'goal.create', resourceType: 'goal', resourceId: goal.id, metadata: { method: plan.method, tasks: order } });
    return this.findOne(goal.id, user);
  }

  async findAll(user: User) {
    return this.prisma.goal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { tasks: { orderBy: { order: 'asc' }, select: { id: true, title: true, status: true } } },
    });
  }

  async findOne(id: string, user: User) {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
      include: { tasks: { orderBy: { order: 'asc' } } },
    });
    if (!goal) throw new NotFoundException('Maqsad topilmadi');
    if (goal.userId !== user.id) throw new ForbiddenException();
    return goal;
  }

  async remove(id: string, user: User) {
    await this.findOne(id, user);
    await this.prisma.goal.delete({ where: { id } });
  }

  /**
   * Maqsadni oldinga surish: navbatdagi ≤2 pending vazifani engine orqali
   * bajarib, natijalarni saqlaydi va progressni yangilaydi.
   * Cron ham, "Advance now" tugmasi ham shu metodni chaqiradi.
   */
  async advance(id: string, user: User, maxTasks = 2) {
    const goal = await this.findOne(id, user);
    if (goal.status !== 'active') return { advanced: 0, goal };

    const pending = goal.tasks.filter((t) => t.status === 'pending').slice(0, maxTasks);
    const facts = await this.twin.factsForEngine(user.id);
    let advanced = 0;

    for (const task of pending) {
      try {
        const { data } = await firstValueFrom(
          this.http.post(`${this.engineUrl}/goals/execute-task`, {
            task: { title: task.title, description: task.description ?? '', agent_role: task.agentRole ?? 'personal_assistant' },
            facts,
            goal_title: goal.title,
            profession: user.professionTitle ?? '',
            language: user.preferredLanguage ?? 'en',
          }),
        );
        await this.prisma.goalTask.update({
          where: { id: task.id },
          data: { status: 'done', result: data.result, lastRunAt: new Date() },
        });
        advanced++;
      } catch (e: any) {
        this.logger.warn(`Vazifa bajarilmadi (${task.id}): ${e.message}`);
      }
    }

    // Progress: bajarilgan / jami
    const tasks = await this.prisma.goalTask.findMany({ where: { goalId: goal.id } });
    const done = tasks.filter((t) => t.status === 'done').length;
    const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const status = progress >= 100 ? 'completed' : goal.status;
    await this.prisma.goal.update({ where: { id: goal.id }, data: { progress, status } });

    if (advanced > 0) {
      await this.audit.record({ actorId: user.id, action: 'goal.advance', resourceType: 'goal', resourceId: goal.id, metadata: { advanced, progress } });
    }
    return { advanced, goal: await this.findOne(goal.id, user) };
  }

  /** Har kuni 07:00 da barcha faol maqsadlarni avtonom yuritadi. */
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async advanceAllActive() {
    const goals = await this.prisma.goal.findMany({
      where: { status: 'active' },
      include: { user: true },
    });
    this.logger.log(`Cron: ${goals.length} ta faol maqsad yuritilmoqda`);
    for (const goal of goals) {
      try {
        await this.advance(goal.id, goal.user, 2);
      } catch (e: any) {
        this.logger.warn(`Cron maqsad xatosi (${goal.id}): ${e.message}`);
      }
    }
  }

  private rethrowEngine(e: any): never {
    const detail = e?.response?.data?.detail;
    if (e?.response?.status === 422 && detail?.blocked) {
      throw new UnprocessableEntityException({ blocked: true, reason: detail.reason });
    }
    this.logger.error(`Engine xatosi: ${e.message}`);
    throw new BadGatewayException({ message: "Agent engine bilan aloqa yo'q", reason: 'engine_unavailable' });
  }
}
