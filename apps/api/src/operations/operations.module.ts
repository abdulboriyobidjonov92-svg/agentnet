import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';
import { ConnectorsModule } from '../connectors/connectors.module';

@Module({
  imports: [HttpModule, AuthModule, ConnectorsModule],
  controllers: [OperationsController],
  providers: [OperationsService, ClerkGuard],
})
export class OperationsModule {}
