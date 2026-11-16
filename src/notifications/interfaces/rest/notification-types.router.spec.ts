import request from 'supertest';
import { createApp } from '../../../app';
import type { IDeviceCommandService } from '../../../devices/domain/services/device-command.service';
import { createOpenApiDocument } from '../../../shared/interfaces/rest/documentation/openapi-document.factory';
import { silentLogger } from '../../../test-support/silent-logger';
import { NotificationQueryServiceImpl } from '../../application/internal/queryservices/notification-query.service.impl';
import { NotificationType } from '../../domain/model/valueobjects/notification-type.enum';
import { InMemoryNotificationTemplateCatalog } from '../../infrastructure/templates/in-memory-notification-template.catalog';

function app() {
  return createApp({
    logger: silentLogger(),
    deviceCommandService: {} as IDeviceCommandService,
    notificationQueryService: new NotificationQueryServiceImpl(
      new InMemoryNotificationTemplateCatalog('https://app.vankoo.test'),
    ),
    readinessChecks: [],
    openApiDocument: createOpenApiDocument([], '1.0.0'),
  });
}

describe('GET /api/v1/notification-types', () => {
  it('lista el catálogo de notificaciones', async () => {
    const response = await request(app())
      .get('/api/v1/notification-types')
      .set('X-User-Id', 'user-1')
      .expect(200);

    expect(response.body).toHaveLength(Object.values(NotificationType).length);
    expect(response.body[0]).toEqual({
      type: 'USER_WELCOME',
      name: 'Bienvenida',
      description: 'Se creó la cuenta del usuario en IAM',
      audience: 'ANY',
      channels: ['EMAIL'],
      sourceEvent: 'vankoo.iam.events · UserCreated',
    });
  });

  it('exige X-User-Id', async () => {
    const response = await request(app())
      .get('/api/v1/notification-types')
      .expect(401);
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
  });
});
