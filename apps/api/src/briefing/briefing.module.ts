import { Module } from '@nestjs/common';
import { BriefingService } from './briefing.service';
import { ConnectorsModule } from '../connectors/connectors.module';

@Module({
  imports: [ConnectorsModule],
  providers: [BriefingService],
  exports: [BriefingService],
})
export class BriefingModule {}
