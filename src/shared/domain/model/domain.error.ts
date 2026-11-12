/**
 * @author LiquiLabs
 * @summary Error de una regla de negocio. La capa de interfaces lo traduce a un 400.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
