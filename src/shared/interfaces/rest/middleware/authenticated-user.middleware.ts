import type { RequestHandler, Response } from 'express';
import { HttpProblem } from '../problem-details';

/** El gateway valida el JWT y reenvía el id del usuario en esta cabecera. */
export const USER_ID_HEADER = 'x-user-id';

/**
 * @author LiquiLabs
 * @summary Exige la cabecera X-User-Id que pone el API Gateway tras validar el JWT.
 *
 * El servicio no valida el JWT: confía en el gateway porque su ingress es interno
 * (en Docker y en Azure nadie llega directo desde fuera).
 */
export const authenticatedUser: RequestHandler = (req, res, next) => {
  const userId = req.header(USER_ID_HEADER)?.trim();
  if (!userId) {
    next(
      new HttpProblem(
        401,
        'Unauthorized',
        'Falta la cabecera X-User-Id: la petición debe pasar por el API Gateway',
      ),
    );
    return;
  }
  res.locals.userId = userId;
  next();
};

/** @author LiquiLabs */
export function getAuthenticatedUserId(res: Response): string {
  return res.locals.userId as string;
}
