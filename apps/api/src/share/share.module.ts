import { Module } from '@nestjs/common';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';

@Module({
  imports: [AuthModule],
  controllers: [ShareController],
  providers: [ShareService, ClerkGuard],
  exports: [ShareService],
})
export class ShareModule {}
