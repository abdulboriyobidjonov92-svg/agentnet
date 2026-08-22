import { Module, forwardRef } from '@nestjs/common';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsService } from './connectors.service';
import { AuthModule } from '../auth/auth.module';
import { PolicyModule } from '../policy/policy.module';

@Module({
  // `PolicyModule` — P0-6 darvozasi `invoke` ichida ishlaydi. Aylanma
  // bog'liqlik yo'q: PolicyModule ConnectorsModule'ni import qilmaydi
  // (`PolicyEngine` registrni to'g'ridan-to'g'ri, modulsiz o'qiydi).
  imports: [AuthModule, forwardRef(() => PolicyModule)],
  controllers: [ConnectorsController],
  providers: [ConnectorsService],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
