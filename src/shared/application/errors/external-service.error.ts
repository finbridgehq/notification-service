/**
 * @author LiquiLabs
 * @summary Un servicio externo (Firebase, SMTP, Profile Service) no respondió o falló.
 *
 * Es un error transitorio: en un evento de Kafka se reintenta y en una petición REST
 * se responde 502, porque el problema no es de quien llama.
 */
export class ExternalServiceError extends Error {
  constructor(
    public readonly service: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(`${service}: ${message}`, options);
    this.name = 'ExternalServiceError';
  }
}
