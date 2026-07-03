import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';
import { TwinModule } from '../twin/twin.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';

@Module({
  imports: [AuthModule, TwinModule, MarketplaceModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, ClerkGuard],
  exports: [ConversationsService],
})
export class ConversationsModule {}
