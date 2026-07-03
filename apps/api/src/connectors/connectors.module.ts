import { Module } from '@nestjs/common';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsService } from './connectors.service';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';

@Module({
  imports: [AuthModule],
  controllers: [ConnectorsController],
  providers: [ConnectorsService, ClerkGuard],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
