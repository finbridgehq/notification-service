import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { HttpProblem } from '../problem-details';

/**
 * @author LiquiLabs
 * @summary Valida el cuerpo con un schema de zod (el mismo que documenta Scalar) y lo deja ya parseado.
 */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(
        new HttpProblem(
          400,
          'Bad Request',
          'El cuerpo de la petición no es válido',
          result.error.issues.map((issue) => ({
            field: issue.path.join('.') || '(body)',
            message: issue.message,
          })),
        ),
      );
      return;
    }
    req.body = result.data;
    next();
  };
}
