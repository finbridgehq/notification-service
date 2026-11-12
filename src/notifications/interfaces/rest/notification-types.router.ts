import { Router } from 'express';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { authenticatedUser } from '../../../shared/interfaces/rest/middleware/authenticated-user.middleware';
import {
  UserIdHeaders,
  problemResponse,
} from '../../../shared/interfaces/rest/resources/common.resource';
import { GetAllNotificationTypesQuery } from '../../domain/model/queries/get-all-notification-types.query';
import type { INotificationQueryService } from '../../domain/services/notification-query.service';
import { NotificationTypeResource } from './resources/notification-type.resource';
import { NotificationTypeResourceFromEntityAssembler } from './transform/notification-type-resource-from-entity.assembler';

/** Prefijo con el que se monta el router (y que rutea el gateway bajo /notification). */
export const NOTIFICATION_TYPES_PATH = '/api/v1/notification-types';

/**
 * @author LiquiLabs
 * @summary Catálogo de notificaciones (lado query de CQRS): qué avisa Vankoo y por qué canal.
 */
export function createNotificationTypesRouter(
  notificationQueryService: INotificationQueryService,
): Router {
  const router = Router();
  router.use(authenticatedUser);
  router.get('/', (_req, res) => {
    const definitions = notificationQueryService.handleGetAllNotificationTypes(
      new GetAllNotificationTypesQuery(),
    );
    res.json(
      definitions.map((definition) =>
        NotificationTypeResourceFromEntityAssembler.toResourceFromEntity(
          definition,
        ),
      ),
    );
  });
  return router;
}

/** @author LiquiLabs */
export function registerNotificationTypesOpenApi(
  registry: OpenAPIRegistry,
): void {
  registry.registerPath({
    method: 'get',
    path: NOTIFICATION_TYPES_PATH,
    tags: ['Notification Types'],
    summary: 'Listar los tipos de notificación y sus canales',
    security: [{ bearerAuth: [] }],
    request: { headers: UserIdHeaders },
    responses: {
      200: {
        description: 'Catálogo de notificaciones',
        content: {
          'application/json': { schema: z.array(NotificationTypeResource) },
        },
      },
      401: problemResponse('Falta X-User-Id (no pasó por el gateway)'),
    },
  });
}
