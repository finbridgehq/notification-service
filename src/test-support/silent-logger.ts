import pino from 'pino';
import type { Logger } from '../shared/infrastructure/logging/logger';

/**
 * @author LiquiLabs
 * @summary Logger real de pino pero mudo, con sus métodos espiados para los asserts.
 */
export function silentLogger(): Logger {
  const logger = pino({ level: 'silent' });
  jest.spyOn(logger, 'info');
  jest.spyOn(logger, 'warn');
  jest.spyOn(logger, 'error');
  jest.spyOn(logger, 'debug');
  return logger;
}
