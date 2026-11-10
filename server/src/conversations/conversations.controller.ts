import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { AuthService } from 'src/auth/auth.service';

import { Public } from '../auth/decorators/public.decorators';
import type { Request } from 'express';
import { StartConversationDto } from './dto/start-conversation.dto';

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly authService: AuthService,
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

  @Public()
  @Get('open')
  async open(@Req() request: Request) {
    const identity = await this.authService.resolveIdentity(request.cookies);
    return this.conversationsService.listOpenForAgent(identity);
  }

  @Public()
  @Get(':id/messages')
  async messages(
    @Req() request: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const identity = await this.authService.resolveIdentity(request.cookies);
    return this.conversationsService.getMessages(identity, id);
  }

  @Public()
  @Post()
  async start(@Req() request: Request, @Body() dto: StartConversationDto) {
    const identity = await this.authService.resolveIdentity(request.cookies);
    return this.conversationsService.startConversation(identity, dto);
  }
}
