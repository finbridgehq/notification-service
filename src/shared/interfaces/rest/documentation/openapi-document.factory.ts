import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';

/** @author LiquiLabs */
export type OpenApiRegistrar = (registry: OpenAPIRegistry) => void;

/** @author LiquiLabs */
export type OpenApiDocument = ReturnType<
  OpenApiGeneratorV31['generateDocument']
>;

/**
 * @author LiquiLabs
 * @summary Arma el documento OpenAPI 3.1 a partir de los schemas de zod de cada router.
 *
 * Los mismos schemas validan las peticiones, así que la documentación no se desfasa del
 * código. El primer server es el API Gateway (`/notification`), que es por donde entran
 * las peticiones reales y desde donde Scalar del gateway agrega este documento.
 */
export function createOpenApiDocument(
  registrars: OpenApiRegistrar[],
  version: string,
): OpenApiDocument {
  const registry = new OpenAPIRegistry();
  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT de IAM. Lo valida el API Gateway, que reenvía X-User-Id',
  });
  for (const register of registrars) register(registry);

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Vankoo Notification Service',
      version,
      description:
        'Envía notificaciones push (Firebase Cloud Messaging) y email a partir de los eventos de Kafka de la plataforma Vankoo, y registra los dispositivos móviles que deben recibirlas.',
    },
    servers: [
      { url: '/notification', description: 'A través del API Gateway' },
      { url: '/', description: 'Directo al servicio (desarrollo local)' },
    ],
  });
}
