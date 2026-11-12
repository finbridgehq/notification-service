import { Router } from 'express';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

/** @author LiquiLabs */
export interface ReadinessCheck {
  name: string;
  isReady(): boolean;
}

const HealthResource = z
  .object({
    status: z.enum(['UP', 'DOWN']),
    components: z.record(z.string(), z.enum(['UP', 'DOWN'])).optional(),
  })
  .meta({ id: 'HealthResource' });

/**
 * @author LiquiLabs
 * @summary Probes para Docker y Azure Container Apps.
 *
 * `/health/live` solo dice que el proceso responde. `/health/ready` además exige que
 * cada dependencia esté lista (por ejemplo, que el consumidor de Kafka ya entró al grupo).
 */
export function createHealthRouter(checks: ReadinessCheck[]): Router {
  const router = Router();
  router.get('/live', (_req, res) => {
    res.json({ status: 'UP' });
  });
  router.get('/ready', (_req, res) => {
    const components = Object.fromEntries(
      checks.map((check) => [check.name, check.isReady() ? 'UP' : 'DOWN']),
    );
    const ready = Object.values(components).every((status) => status === 'UP');
    res
      .status(ready ? 200 : 503)
      .json({ status: ready ? 'UP' : 'DOWN', components });
  });
  return router;
}

/** @author LiquiLabs */
export function registerHealthOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/health/live',
    tags: ['Health'],
    summary: 'El proceso está vivo',
    responses: {
      200: {
        description: 'Vivo',
        content: { 'application/json': { schema: HealthResource } },
      },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/health/ready',
    tags: ['Health'],
    summary: 'El servicio está listo para recibir tráfico y eventos',
    responses: {
      200: {
        description: 'Listo',
        content: { 'application/json': { schema: HealthResource } },
      },
      503: {
        description: 'Alguna dependencia no está lista',
        content: { 'application/json': { schema: HealthResource } },
      },
    },
  });
}
