import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';
import { TwinModule } from '../twin/twin.module';

@Module({
  imports: [AuthModule, TwinModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, ClerkGuard],
  exports: [ConversationsService],
})
export class ConversationsModule {}
