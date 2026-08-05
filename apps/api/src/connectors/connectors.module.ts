import { Module } from '@nestjs/common';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsService } from './connectors.service';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/auth.guard';

@Module({
  imports: [AuthModule],
  controllers: [ConnectorsController],
  providers: [ConnectorsService, AuthGuard],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
