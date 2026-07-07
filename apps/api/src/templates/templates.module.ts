import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { ClerkGuard } from '../auth/clerk.guard';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  imports: [AgentsModule], // AgentsService (o'rnatishda limit/audit bilan yaratish)
  controllers: [TemplatesController],
  providers: [TemplatesService, ClerkGuard],
})
export class TemplatesModule {}
