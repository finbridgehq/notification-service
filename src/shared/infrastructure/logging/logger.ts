import pino from 'pino';

/** @author LiquiLabs */
export type Logger = pino.Logger;

/**
 * @author LiquiLabs
 * @summary Logger JSON (pino). Nunca escribe el token del JWT ni el de los dispositivos.
 */
export function createLogger(level: string): Logger {
  return pino({
    level,
    base: { service: 'notification-service' },
    redact: [
      'req.headers.authorization',
      'deviceToken',
      '*.deviceToken',
      'req.body.deviceToken',
    ],
  });
}
