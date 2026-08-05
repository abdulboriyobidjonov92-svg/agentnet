import { Module } from '@nestjs/common';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/auth.guard';

@Module({
  imports: [AuthModule],
  controllers: [ShareController],
  providers: [ShareService, AuthGuard],
  exports: [ShareService],
})
export class ShareModule {}
