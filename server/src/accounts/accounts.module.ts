import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountsRepository } from './accounts.repository';

// PrismaService vient de PrismaModule (global) : le redéclarer ici
// créerait un second client Prisma avec son propre pool de connexions.
@Module({
  providers: [AccountsService, AccountsRepository],
  exports: [AccountsService],
})
export class AccountsModule {}
