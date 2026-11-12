import request from 'supertest';
import { createApp } from '../../../app';
import type { INotificationQueryService } from '../../../notifications/domain/services/notification-query.service';
import { ExternalServiceError } from '../../../shared/application/errors/external-service.error';
import { DomainError } from '../../../shared/domain/model/domain.error';
import { createOpenApiDocument } from '../../../shared/interfaces/rest/documentation/openapi-document.factory';
import { silentLogger } from '../../../test-support/silent-logger';
import { DeviceRegistration } from '../../domain/model/aggregates/device-registration.aggregate';
import { RegisterDeviceCommand } from '../../domain/model/commands/register-device.command';
import { DevicePlatform } from '../../domain/model/valueobjects/device-platform.enum';
import type { IDeviceCommandService } from '../../domain/services/device-command.service';

const TOKEN = 'fGx3c1V9QkK0yN2b:APA91bH7dK2mE5xQwZr8T1pLsVn3cY6uJ0aB4fG9hI2k';
const PATH = '/api/v1/device-registrations';

function setUp() {
  const deviceCommandService: jest.Mocked<IDeviceCommandService> = {
    handleRegisterDevice: jest.fn((command) =>
      Promise.resolve(
        DeviceRegistration.register(
          command,
          new Date('2026-11-03T15:00:00.000Z'),
        ),
      ),
    ),
    handleUnregisterDevice: jest.fn().mockResolvedValue(undefined),
  };
  const app = createApp({
    logger: silentLogger(),
    deviceCommandService,
    notificationQueryService: {} as INotificationQueryService,
    readinessChecks: [],
    openApiDocument: createOpenApiDocument([], '1.0.0'),
  });
  return { app, deviceCommandService };
}

describe('POST /api/v1/device-registrations', () => {
  it('registra el dispositivo del usuario autenticado', async () => {
    const { app, deviceCommandService } = setUp();

    const response = await request(app)
      .post(PATH)
      .set('X-User-Id', 'user-1')
      .send({ deviceToken: TOKEN, platform: 'ANDROID' })
      .expect(201);

    expect(response.body).toEqual({
      userId: 'user-1',
      platform: 'ANDROID',
      registeredAt: '2026-11-03T15:00:00.000Z',
    });
    expect(deviceCommandService.handleRegisterDevice).toHaveBeenCalledWith(
      new RegisterDeviceCommand('user-1', TOKEN, DevicePlatform.ANDROID),
    );
  });

  it('responde 401 sin X-User-Id', async () => {
    const { app, deviceCommandService } = setUp();
    await request(app)
      .post(PATH)
      .send({ deviceToken: TOKEN, platform: 'IOS' })
      .expect(401);
    expect(deviceCommandService.handleRegisterDevice).not.toHaveBeenCalled();
  });

  it('responde 400 con el detalle de cada campo inválido', async () => {
    const { app } = setUp();
    const response = await request(app)
      .post(PATH)
      .set('X-User-Id', 'user-1')
      .send({ deviceToken: 'corto', platform: 'WINDOWS' })
      .expect(400);
    const { errors } = response.body as { errors: { field: string }[] };
    expect(errors.map((error) => error.field)).toEqual([
      'deviceToken',
      'platform',
    ]);
  });

  it('responde 400 si el JSON está mal formado', async () => {
    const { app } = setUp();
    const response = await request(app)
      .post(PATH)
      .set('X-User-Id', 'user-1')
      .set('Content-Type', 'application/json')
      .send('{"deviceToken":')
      .expect(400);
    expect(response.body.detail).toContain('JSON');
  });

  it('responde 400 si Firebase rechaza el token', async () => {
    const { app, deviceCommandService } = setUp();
    deviceCommandService.handleRegisterDevice.mockRejectedValue(
      new DomainError('DEVICE_TOKEN_REJECTED', 'Firebase rechazó el token'),
    );
    const response = await request(app)
      .post(PATH)
      .set('X-User-Id', 'user-1')
      .send({ deviceToken: TOKEN, platform: 'IOS' })
      .expect(400);
    expect(response.body.title).toBe('DEVICE_TOKEN_REJECTED');
  });

  it('responde 502 si Firebase no está disponible', async () => {
    const { app, deviceCommandService } = setUp();
    deviceCommandService.handleRegisterDevice.mockRejectedValue(
      new ExternalServiceError('Firebase Cloud Messaging', 'timeout'),
    );
    await request(app)
      .post(PATH)
      .set('X-User-Id', 'user-1')
      .send({ deviceToken: TOKEN, platform: 'IOS' })
      .expect(502);
  });

  it('responde 500 ante un error inesperado', async () => {
    const { app, deviceCommandService } = setUp();
    deviceCommandService.handleRegisterDevice.mockRejectedValue(
      new Error('bug'),
    );
    const response = await request(app)
      .post(PATH)
      .set('X-User-Id', 'user-1')
      .send({ deviceToken: TOKEN, platform: 'IOS' })
      .expect(500);
    expect(response.body.detail).toBe('Error inesperado');
  });
});

describe('DELETE /api/v1/device-registrations/:deviceToken', () => {
  it('da de baja el dispositivo', async () => {
    const { app, deviceCommandService } = setUp();
    await request(app)
      .delete(`${PATH}/${TOKEN}`)
      .set('X-User-Id', 'user-1')
      .expect(204);
    expect(deviceCommandService.handleUnregisterDevice).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', deviceToken: TOKEN }),
    );
  });
});
