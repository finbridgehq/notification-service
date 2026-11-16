import { z } from 'zod';

/**
 * @author LiquiLabs
 * @summary Schemas comunes de la documentación OpenAPI.
 */
export const ProblemDetailsResource = z
  .object({
    type: z.string().meta({ example: 'about:blank' }),
    title: z.string().meta({ example: 'Bad Request' }),
    status: z.number().int().meta({ example: 400 }),
    detail: z.string(),
    instance: z.string().meta({ example: '/api/v1/device-registrations' }),
    errors: z
      .array(z.object({ field: z.string(), message: z.string() }))
      .optional(),
  })
  .meta({ id: 'ProblemDetails' });

/** Cabecera que inyecta el API Gateway; directo al servicio hay que mandarla a mano. */
export const UserIdHeaders = z.object({
  'x-user-id': z.string().meta({
    description: 'Id del usuario en IAM; lo pone el API Gateway desde el JWT',
    example: '40000000-0000-4000-8000-000000000001',
  }),
});

/** @author LiquiLabs */
export const problemResponse = (description: string) => ({
  description,
  content: { 'application/problem+json': { schema: ProblemDetailsResource } },
});
