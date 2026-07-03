import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RetailController } from './retail.controller';
import { RetailService } from './retail.service';
import { AuthModule } from '../auth/auth.module';
import { ClerkGuard } from '../auth/clerk.guard';
import { ConnectorsModule } from '../connectors/connectors.module';

@Module({
  imports: [HttpModule, AuthModule, ConnectorsModule],
  controllers: [RetailController],
  providers: [RetailService, ClerkGuard],
})
export class RetailModule {}
