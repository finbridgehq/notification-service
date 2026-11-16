import type { RequestHandler } from 'express';

/**
 * @author LiquiLabs
 * @summary Sustituto de @scalar/express-api-reference en Jest: el paquete solo se publica
 * como ESM y Jest carga los módulos como CommonJS. Devuelve la configuración recibida
 * para poder comprobarla en los tests.
 */
export function apiReference(configuration: unknown): RequestHandler {
  return (_req, res) => {
    res.type('text/html').send(`<scalar>${JSON.stringify(configuration)}`);
  };
}
