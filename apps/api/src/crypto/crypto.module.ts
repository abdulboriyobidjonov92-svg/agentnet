import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

// Global — har qanday modul (auth, connectors, ...) CryptoService'ni
// qo'shimcha import'siz inyeksiya qila oladi.
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
