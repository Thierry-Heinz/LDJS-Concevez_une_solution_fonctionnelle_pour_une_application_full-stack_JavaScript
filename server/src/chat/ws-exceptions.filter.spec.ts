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

const PATTERN = 'conversation:join';

/** Reproduit les arguments passés par Nest : [client, data, ack?, pattern]. */
function createHost(ack?: jest.Mock) {
  const client = { emit: jest.fn() };
  const args: unknown[] = ack
    ? [client, {}, ack, PATTERN]
    : [client, {}, PATTERN];
  const host = {
    getArgByIndex: (index: number) => args[index],
    switchToWs: () => ({
      getClient: () => client,
      getPattern: () => PATTERN,
    }),
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

  /** Lance le filtre avec un ack et renvoie l'erreur transmise à l'ack. */
  function errorFor(exception: unknown) {
    const ack = jest.fn();
    filter.catch(exception, createHost(ack).host);
    expect(ack).toHaveBeenCalledTimes(1);
    const [response] = ack.mock.calls[0] as [{ error: unknown }];
    return response.error;
  }

  describe('livraison de l’erreur', () => {
    it('répond à l’ack avec status error, sans émettre chat:error', () => {
      const ack = jest.fn();
      const { client, host } = createHost(ack);

      filter.catch(new ForbiddenException(), host);

      expect(ack).toHaveBeenCalledWith({
        status: 'error',
        error: { code: 'FORBIDDEN', message: 'Forbidden', details: undefined },
      });
      expect(client.emit).not.toHaveBeenCalled();
    });

    it('émet chat:error avec le nom de l’événement quand le client n’a pas fourni d’ack', () => {
      const { client, host } = createHost();

      filter.catch(new ForbiddenException(), host);

      expect(client.emit).toHaveBeenCalledWith('chat:error', {
        code: 'FORBIDDEN',
        message: 'Forbidden',
        details: undefined,
        event: PATTERN,
      });
    });
  });

  describe('conversion de l’exception', () => {
    it('reprend le code métier porté par une HttpException', () => {
      expect(
        errorFor(
          new ConflictException({
            code: 'CONVERSATION_CLOSED',
            message: 'Conversation fermée',
          }),
        ),
      ).toEqual({
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
        expect(errorFor(exception)).toMatchObject({
          code: expectedCode,
          message: exception.message,
        });
      },
    );

    it('donne ERROR pour un statut HTTP absent de la table', () => {
      expect(
        errorFor(new HttpException('Trop de requêtes', 429)),
      ).toMatchObject({ code: 'ERROR', message: 'Trop de requêtes' });
    });

    it('donne VALIDATION_FAILED avec le détail des erreurs Zod', () => {
      expect(errorFor(zodValidationError())).toEqual({
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
      const error = new Error('connexion à la base perdue');

      expect(errorFor(error)).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });
      expect(loggerError).toHaveBeenCalledWith(error);
    });
  });
});
