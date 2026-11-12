import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter } from '@nestjs/websockets';
import type { ChatSocket } from './chat.types';
import type { ChatError, ErrorAck } from './chat.events';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
};

// Nest appelle les handlers WebSocket avec [client, data, ack?, pattern] :
// l'ack, quand le client en a fourni un, est le troisième argument.
const ACK_ARG_INDEX = 2;

@Catch()
export class WsExceptionsFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger('ChatGateway');

  catch(exception: unknown, host: ArgumentsHost) {
    const ws = host.switchToWs();
    const error = this.toChatError(exception);

    const ack: unknown = host.getArgByIndex(ACK_ARG_INDEX);
    if (typeof ack === 'function') {
      (ack as (res: ErrorAck) => void)({ status: 'error', error });
      return;
    }

    ws.getClient<ChatSocket>().emit('chat:error', {
      ...error,
      event: ws.getPattern(),
    });
  }

  private toChatError(exception: unknown): ChatError {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      const body =
        typeof response === 'object' && response !== null ? response : {};
      const responseCode =
        'code' in body && typeof body.code === 'string' ? body.code : undefined;
      return {
        code: responseCode ?? CODE_BY_STATUS[status] ?? 'ERROR',
        message: exception.message,
        details: 'errors' in body ? body.errors : undefined,
      };
    }

    this.logger.error(exception);
    return { code: 'INTERNAL_ERROR', message: 'Internal server error' };
  }
}
