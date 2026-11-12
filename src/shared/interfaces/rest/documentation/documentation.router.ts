import { Router } from 'express';
import { apiReference } from '@scalar/express-api-reference';
import type { OpenApiDocument } from './openapi-document.factory';

/** Ruta del documento OpenAPI; el gateway la lee en `/notification/openapi/v1.json`. */
export const OPENAPI_PATH = '/openapi/v1.json';

/**
 * @author LiquiLabs
 * @summary Publica el documento OpenAPI y la referencia de Scalar en `/reference`.
 */
export function createDocumentationRouter(document: OpenApiDocument): Router {
  const router = Router();
  router.get(OPENAPI_PATH, (_req, res) => {
    res.json(document);
  });
  router.use(
    '/reference',
    apiReference({
      pageTitle: 'Vankoo Notification Service',
      theme: 'purple',
      content: document,
    }),
  );
  return router;
}
