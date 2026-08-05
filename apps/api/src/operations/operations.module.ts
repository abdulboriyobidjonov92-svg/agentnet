import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/auth.guard';
import { ConnectorsModule } from '../connectors/connectors.module';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [HttpModule, AuthModule, ConnectorsModule, UsageModule],
  controllers: [OperationsController],
  providers: [OperationsService, AuthGuard],
})
export class OperationsModule {}
