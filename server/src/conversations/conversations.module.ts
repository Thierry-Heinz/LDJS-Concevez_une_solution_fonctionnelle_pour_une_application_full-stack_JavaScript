import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { AgenciesModule } from 'src/agencies/agencies.module';
import { ConversationsRepository } from './conversations.repository';

@Module({
  imports: [AgenciesModule],
  providers: [ConversationsService, ConversationsRepository],
  controllers: [ConversationsController],
  exports: [ConversationsService],
})
export class ConversationsModule {}
