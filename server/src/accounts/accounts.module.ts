import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsRepository } from './accounts.repository';

@Module({
  providers: [AccountsService, AccountsRepository, PrismaService],
  exports: [AccountsService],
})
export class AccountsModule {}
