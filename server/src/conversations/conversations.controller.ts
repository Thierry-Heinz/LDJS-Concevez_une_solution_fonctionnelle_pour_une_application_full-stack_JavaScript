import {
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { AuthService } from '../auth/auth.service';

import { Public } from '../auth/decorators/public.decorators';
import type { Request, Response } from 'express';
import { StartConversationDto } from './dto/start-conversation.dto';
import { ConversationDto } from './dto/conversation.dto';
import { MessageDto } from './dto/message.dto';
import { ApiErrorDto } from '../common/dto/api-error.dto';

@ApiTags('Conversations')
@ApiCookieAuth('access_token')
@ApiCookieAuth('guest_token')
@ApiUnauthorizedResponse({
  description:
    "Aucun jeton d'accès ni jeton invité, ou jeton invalide ou expiré",
  type: ApiErrorDto.Output,
})
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Get('current')
  @ApiOperation({
    summary: 'Récupérer la conversation en cours',
    description:
      "Renvoie la conversation ouverte du client connecté ou de l'invité. Réservé aux clients et aux invités.",
  })
  @ApiOkResponse({
    description: 'Conversation ouverte',
    type: ConversationDto.Output,
  })
  @ApiForbiddenResponse({
    description: "L'utilisateur connecté est un agent",
    type: ApiErrorDto.Output,
  })
  @ApiNotFoundResponse({
    description: 'Aucune conversation ouverte',
    type: ApiErrorDto.Output,
  })
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
  @ApiOperation({
    summary: "Lister les conversations ouvertes de l'agence",
    description:
      "Renvoie les conversations ouvertes de l'agence de l'agent connecté, de la plus ancienne à la plus récente. Réservé aux agents.",
  })
  @ApiOkResponse({
    description: "Conversations ouvertes de l'agence",
    type: [ConversationDto.Output],
  })
  @ApiForbiddenResponse({
    description: "L'appelant n'est pas un agent rattaché à une agence",
    type: ApiErrorDto.Output,
  })
  async open(@Req() request: Request) {
    const identity = await this.authService.resolveIdentity(request.cookies);
    return this.conversationsService.listOpenForAgent(identity);
  }

  @Public()
  @Get(':id/messages')
  @ApiOperation({
    summary: "Récupérer l'historique des messages",
    description:
      "Renvoie les messages d'une conversation, du plus ancien au plus récent, avec les informations d'affichage de l'auteur. Accessible au propriétaire de la conversation et aux agents de l'agence concernée.",
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Identifiant de la conversation',
  })
  @ApiOkResponse({
    description: 'Messages de la conversation',
    type: [MessageDto.Output],
  })
  @ApiBadRequestResponse({
    description: "L'identifiant n'est pas un UUID",
    type: ApiErrorDto.Output,
  })
  @ApiForbiddenResponse({
    description: "L'appelant n'a pas accès à cette conversation",
    type: ApiErrorDto.Output,
  })
  @ApiNotFoundResponse({
    description: 'Conversation introuvable',
    type: ApiErrorDto.Output,
  })
  async messages(
    @Req() request: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const identity = await this.authService.resolveIdentity(request.cookies);
    return this.conversationsService.getMessages(identity, id);
  }

  @Public()
  @Post()
  @ApiOperation({
    summary: 'Démarrer une conversation',
    description:
      "Ouvre une conversation avec le service client central (GENERAL) ou une agence (AGENCY). Un client ou un invité n'a qu'une conversation ouverte à la fois : si elle vise la même cible, elle est renvoyée (200) ; sinon la demande est refusée (409). Réservé aux clients et aux invités.",
  })
  @ApiBody({
    type: StartConversationDto,
    description: 'Origine de la demande et agence éventuelle',
  })
  @ApiCreatedResponse({
    description: 'Conversation créée',
    type: ConversationDto.Output,
  })
  @ApiOkResponse({
    description: 'Conversation déjà ouverte vers la même cible',
    type: ConversationDto.Output,
  })
  @ApiConflictResponse({
    description:
      'Une conversation est déjà ouverte vers une autre cible : code CONVERSATION_ALREADY_OPEN et conversationId de la conversation existante',
    type: ApiErrorDto.Output,
  })
  @ApiBadRequestResponse({
    description:
      'Données invalides (agencyId manquant pour une origine AGENCY)',
    type: ApiErrorDto.Output,
  })
  @ApiForbiddenResponse({
    description: "L'utilisateur connecté est un agent",
    type: ApiErrorDto.Output,
  })
  @ApiNotFoundResponse({
    description: "Agence introuvable ou n'étant pas une agence locale",
    type: ApiErrorDto.Output,
  })
  async start(
    @Req() request: Request,
    @Body() dto: StartConversationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const identity = await this.authService.resolveIdentity(request.cookies);
    const { conversation, created } =
      await this.conversationsService.startConversation(identity, dto);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return conversation;
  }
}
