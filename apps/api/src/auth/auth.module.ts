import { Module } from '@nestjs/common';
import { AuditLogService, TwoFactorService, ClerkSyncService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [AuditLogService, TwoFactorService, ClerkSyncService],
  exports: [AuditLogService, TwoFactorService, ClerkSyncService],
})
export class AuthModule {}
