import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { AuthModule } from '../auth/auth.module';
import { TwinModule } from '../twin/twin.module';

@Module({
  imports: [HttpModule, AuthModule, TwinModule],
  controllers: [GoalsController],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}
