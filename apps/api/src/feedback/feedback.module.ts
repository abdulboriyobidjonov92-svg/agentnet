import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';

@Module({
  imports: [AuthModule],
  controllers: [FeedbackController],
  providers: [FeedbackService, ClerkGuard],
  exports: [FeedbackService],
})
export class FeedbackModule {}
