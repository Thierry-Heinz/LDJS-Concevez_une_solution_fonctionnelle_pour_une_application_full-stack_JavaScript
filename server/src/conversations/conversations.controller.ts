import { Controller, Get, NotFoundException, Req } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { AuthService } from 'src/auth/auth.service';

import { Public } from '../auth/decorators/public.decorators';
import { ConversationsRepository } from './conversations.repository';
import type { Request } from 'express';

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly authService: AuthService,
    private readonly conversationRepository: ConversationsRepository,
  ) {}

  @Public()
  @Get('current')
  async current(@Req() request: Request) {
    const identity = await this.authService.resolveIdentity(request.cookies);
    const conversation = await this.conversationsService.findCurrent(identity);
    if (!conversation) {
      throw new NotFoundException();
    }
    return conversation;
  }
}
