import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AgentOsController } from './agentos.controller';
import { AgentOsService } from './agentos.service';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';

@Module({
  imports: [HttpModule, AuthModule],
  controllers: [AgentOsController],
  providers: [AgentOsService, ClerkGuard],
})
export class AgentOsModule {}
