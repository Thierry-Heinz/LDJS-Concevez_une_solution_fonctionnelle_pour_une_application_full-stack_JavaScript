import {
  ArgumentsHost,
  ConflictException,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { WsExceptionsFilter } from './ws-exceptions.filter';
import { JoinConversationDto } from './dto/join-conversation.dto';

function createHost() {
  const client = { emit: jest.fn() };
  const host = {
    switchToWs: () => ({ getClient: () => client }),
  } as unknown as ArgumentsHost;
  return { client, host };
}

function zodValidationError(): unknown {
  try {
    new ZodValidationPipe(JoinConversationDto).transform(
      { conversationId: 'pas-un-uuid' },
      { type: 'body' },
    );
  } catch (error) {
    return error;
  }
  throw new Error('La validation aurait dû échouer');
}

describe('WsExceptionsFilter', () => {
  let filter: WsExceptionsFilter;
  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    filter = new WsExceptionsFilter();
    loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('émet le code métier porté par une HttpException', () => {
    const { client, host } = createHost();

    filter.catch(
      new ConflictException({
        code: 'CONVERSATION_CLOSED',
        message: 'Conversation fermée',
      }),
      host,
    );

    expect(client.emit).toHaveBeenCalledWith('chat:error', {
      code: 'CONVERSATION_CLOSED',
      message: 'Conversation fermée',
      details: undefined,
    });
  });

  it.each([
    [new UnauthorizedException(), 'UNAUTHENTICATED'],
    [new ForbiddenException(), 'FORBIDDEN'],
    [new NotFoundException(), 'NOT_FOUND'],
    [new ConflictException(), 'CONFLICT'],
  ])(
    'déduit le code du statut HTTP quand l’exception n’a pas de code (%p → %s)',
    (exception, expectedCode) => {
      const { client, host } = createHost();

      filter.catch(exception, host);

      expect(client.emit).toHaveBeenCalledWith(
        'chat:error',
        expect.objectContaining({
          code: expectedCode,
          message: exception.message,
        }),
      );
    },
  );

  it('émet ERROR pour un statut HTTP absent de la table', () => {
    const { client, host } = createHost();

    filter.catch(new HttpException('Trop de requêtes', 429), host);

    expect(client.emit).toHaveBeenCalledWith(
      'chat:error',
      expect.objectContaining({ code: 'ERROR', message: 'Trop de requêtes' }),
    );
  });

  it('émet VALIDATION_FAILED avec le détail des erreurs Zod', () => {
    const { client, host } = createHost();

    filter.catch(zodValidationError(), host);

    expect(client.emit).toHaveBeenCalledWith('chat:error', {
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      details: [
        expect.objectContaining({
          path: ['conversationId'],
          code: 'invalid_format',
        }),
      ],
    });
  });

  it('masque une erreur inconnue sous INTERNAL_ERROR et la journalise', () => {
    const { client, host } = createHost();
    const error = new Error('connexion à la base perdue');

    filter.catch(error, host);

    expect(client.emit).toHaveBeenCalledWith('chat:error', {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: undefined,
    });
    expect(loggerError).toHaveBeenCalledWith(error);
  });
});
