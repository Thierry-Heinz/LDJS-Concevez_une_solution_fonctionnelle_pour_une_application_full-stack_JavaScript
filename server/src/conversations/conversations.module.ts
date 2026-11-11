import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { AgenciesModule } from '../agencies/agencies.module';
import { ConversationsRepository } from './conversations.repository';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [AgenciesModule, AuthModule, AccountsModule],
  providers: [ConversationsService, ConversationsRepository],
  controllers: [ConversationsController],
  exports: [ConversationsService],
})
export class ConversationsModule {}
