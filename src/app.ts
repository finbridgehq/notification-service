import express from 'express';
import type { Express } from 'express';
import { pinoHttp } from 'pino-http';
import type { IDeviceCommandService } from './devices/domain/services/device-command.service';
import {
  DEVICE_REGISTRATIONS_PATH,
  createDeviceRegistrationsRouter,
} from './devices/interfaces/rest/device-registrations.router';
import type { INotificationQueryService } from './notifications/domain/services/notification-query.service';
import {
  NOTIFICATION_TYPES_PATH,
  createNotificationTypesRouter,
} from './notifications/interfaces/rest/notification-types.router';
import type { Logger } from './shared/infrastructure/logging/logger';
import { createDocumentationRouter } from './shared/interfaces/rest/documentation/documentation.router';
import type { OpenApiDocument } from './shared/interfaces/rest/documentation/openapi-document.factory';
import {
  type ReadinessCheck,
  createHealthRouter,
} from './shared/interfaces/rest/health/health.router';
import {
  createErrorHandler,
  notFoundHandler,
} from './shared/interfaces/rest/middleware/error-handler.middleware';

/** @author LiquiLabs */
export interface AppDependencies {
  logger: Logger;
  deviceCommandService: IDeviceCommandService;
  notificationQueryService: INotificationQueryService;
  readinessChecks: ReadinessCheck[];
  openApiDocument: OpenApiDocument;
}

/**
 * @author LiquiLabs
 * @summary Aplicación Express: rutas REST, health, documentación y manejo de errores.
 *
 * No arranca nada (ni Kafka ni el puerto): así los tests la levantan con supertest.
 */
export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    pinoHttp({
      logger: dependencies.logger,
      autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
    }),
  );
  app.use(express.json({ limit: '16kb' }));

  app.use('/health', createHealthRouter(dependencies.readinessChecks));
  app.use(createDocumentationRouter(dependencies.openApiDocument));
  app.use(
    DEVICE_REGISTRATIONS_PATH,
    createDeviceRegistrationsRouter(dependencies.deviceCommandService),
  );
  app.use(
    NOTIFICATION_TYPES_PATH,
    createNotificationTypesRouter(dependencies.notificationQueryService),
  );

  app.use(notFoundHandler);
  app.use(createErrorHandler(dependencies.logger));
  return app;
}
