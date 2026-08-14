import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

/**
 * Filtro global de excepciones de CUDII.
 *
 * Captura cualquier excepción HTTP controlada y cualquier error inesperado,
 * registra el incidente en los logs centralizados y devuelve al frontend
 * un formato de error estandarizado y estable.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const esHttp = exception instanceof HttpException;

    const statusCode = esHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const detalleHttp = esHttp
      ? exception.getResponse()
      : { message: 'Error interno del servidor' };

    const mensaje =
      typeof detalleHttp === 'string'
        ? detalleHttp
        : ((detalleHttp as Record<string, unknown>).message ?? 'Error interno');

    // Registrar el incidente en logs (solo errores no controlados o 5xx).
    if (!esHttp || statusCode >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const cuerpo = {
      statusCode,
      message: Array.isArray(mensaje) ? mensaje : [mensaje],
      error: esHttp
        ? ((detalleHttp as Record<string, unknown>).error ?? 'Unknown')
        : 'Internal Server Error',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(cuerpo);
  }
}
