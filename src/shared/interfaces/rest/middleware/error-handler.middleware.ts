import type { ErrorRequestHandler, RequestHandler } from 'express';
import { DomainError } from '../../../domain/model/domain.error';
import { ExternalServiceError } from '../../../application/errors/external-service.error';
import type { Logger } from '../../../infrastructure/logging/logger';
import { HttpProblem, sendProblem } from '../problem-details';

/**
 * @author LiquiLabs
 * @summary Ruta inexistente: 404 en problem+json.
 */
export const notFoundHandler: RequestHandler = (req, res) => {
  sendProblem(res, req.originalUrl, {
    title: 'Not Found',
    status: 404,
    detail: `No existe ${req.method} ${req.path}`,
  });
};

/**
 * @author LiquiLabs
 * @summary Traduce los errores a problem+json: reglas de negocio 400, servicios externos 502 y el resto 500.
 */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof HttpProblem) {
      sendProblem(res, req.originalUrl, {
        title: error.title,
        status: error.status,
        detail: error.detail,
        errors: error.errors,
      });
      return;
    }
    if (error instanceof DomainError) {
      sendProblem(res, req.originalUrl, {
        title: error.code,
        status: 400,
        detail: error.message,
      });
      return;
    }
    if (error instanceof ExternalServiceError) {
      logger.error({ error: error.message }, 'Fallo de un servicio externo');
      sendProblem(res, req.originalUrl, {
        title: 'Bad Gateway',
        status: 502,
        detail: `${error.service} no está disponible en este momento`,
      });
      return;
    }
    if (isBodyParserError(error)) {
      sendProblem(res, req.originalUrl, {
        title: 'Bad Request',
        status: error.status,
        detail: 'El cuerpo de la petición no es un JSON válido',
      });
      return;
    }
    logger.error({ err: error }, 'Error inesperado');
    sendProblem(res, req.originalUrl, {
      title: 'Internal Server Error',
      status: 500,
      detail: 'Error inesperado',
    });
  };
}

/** express.json() marca sus errores con `type` y un estado 4xx. */
function isBodyParserError(
  error: unknown,
): error is { status: number; type: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'status' in error &&
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status < 500
  );
}
