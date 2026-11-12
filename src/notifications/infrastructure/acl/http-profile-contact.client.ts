import { ExternalServiceError } from '../../../shared/application/errors/external-service.error';
import type {
  CompanyContact,
  IProfileContactClient,
} from '../../application/internal/outboundservices/acl/profile-contact-client';

const PROFILE_SERVICE = 'Profile Service';

/**
 * @author LiquiLabs
 * @summary Cliente HTTP de Profile Service: `GET /api/v1/companies/me` con la cabecera X-User-Id.
 *
 * Es la misma ruta que usa el web de la Mype a través del gateway; aquí se llama directo
 * (servicio a servicio, dentro de la red interna). La URL base sale de Eureka en local o
 * de PROFILE_SERVICE_URL desplegado.
 */
export class HttpProfileContactClient implements IProfileContactClient {
  constructor(
    private readonly resolveBaseUrl: () => string | null,
    private readonly timeoutMs: number,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async fetchCompanyContact(userId: string): Promise<CompanyContact | null> {
    const baseUrl = this.resolveBaseUrl();
    if (!baseUrl) {
      throw new ExternalServiceError(
        PROFILE_SERVICE,
        'no hay ninguna instancia disponible',
      );
    }

    let response: Response;
    try {
      response = await this.fetchFn(`${baseUrl}/api/v1/companies/me`, {
        headers: { 'X-User-Id': userId, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new ExternalServiceError(
        PROFILE_SERVICE,
        (error as Error).message,
        {
          cause: error,
        },
      );
    }

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new ExternalServiceError(
        PROFILE_SERVICE,
        `respondió ${response.status}`,
      );
    }
    const body = (await response.json()) as {
      contactEmail?: unknown;
      businessName?: unknown;
    };
    return {
      contactEmail:
        typeof body.contactEmail === 'string' ? body.contactEmail : null,
      businessName:
        typeof body.businessName === 'string' ? body.businessName : null,
    };
  }
}
