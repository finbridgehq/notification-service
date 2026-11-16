import { Router } from 'express';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  authenticatedUser,
  getAuthenticatedUserId,
} from '../../../shared/interfaces/rest/middleware/authenticated-user.middleware';
import { validateBody } from '../../../shared/interfaces/rest/middleware/validate-request.middleware';
import {
  UserIdHeaders,
  problemResponse,
} from '../../../shared/interfaces/rest/resources/common.resource';
import { UnregisterDeviceCommand } from '../../domain/model/commands/unregister-device.command';
import type { IDeviceCommandService } from '../../domain/services/device-command.service';
import { DeviceRegistrationResource } from './resources/device-registration.resource';
import { RegisterDeviceResource } from './resources/register-device.resource';
import { DeviceRegistrationResourceFromEntityAssembler } from './transform/device-registration-resource-from-entity.assembler';
import { RegisterDeviceCommandFromResourceAssembler } from './transform/register-device-command-from-resource.assembler';

/** Prefijo con el que se monta el router (y que rutea el gateway bajo /notification). */
export const DEVICE_REGISTRATIONS_PATH = '/api/v1/device-registrations';

/**
 * @author LiquiLabs
 * @summary Registro de dispositivos móviles: la app manda su token de FCM al iniciar sesión y lo da de baja al cerrarla.
 */
export function createDeviceRegistrationsRouter(
  deviceCommandService: IDeviceCommandService,
): Router {
  const router = Router();
  router.use(authenticatedUser);

  router.post('/', validateBody(RegisterDeviceResource), async (req, res) => {
    const command =
      RegisterDeviceCommandFromResourceAssembler.toCommandFromResource(
        getAuthenticatedUserId(res),
        req.body as RegisterDeviceResource,
      );
    const registration =
      await deviceCommandService.handleRegisterDevice(command);
    res
      .status(201)
      .json(
        DeviceRegistrationResourceFromEntityAssembler.toResourceFromEntity(
          registration,
        ),
      );
  });

  router.delete('/:deviceToken', async (req, res) => {
    await deviceCommandService.handleUnregisterDevice(
      new UnregisterDeviceCommand(
        getAuthenticatedUserId(res),
        req.params.deviceToken,
      ),
    );
    res.status(204).send();
  });

  return router;
}

/** @author LiquiLabs */
export function registerDeviceRegistrationsOpenApi(
  registry: OpenAPIRegistry,
): void {
  registry.registerPath({
    method: 'post',
    path: DEVICE_REGISTRATIONS_PATH,
    tags: ['Device Registrations'],
    summary: 'Registrar el dispositivo del usuario para recibir push',
    description:
      'Suscribe el token de FCM al topic del usuario autenticado. Llamarlo otra vez con el mismo token no tiene efecto.',
    security: [{ bearerAuth: [] }],
    request: {
      headers: UserIdHeaders,
      body: {
        required: true,
        content: { 'application/json': { schema: RegisterDeviceResource } },
      },
    },
    responses: {
      201: {
        description: 'Dispositivo registrado',
        content: {
          'application/json': { schema: DeviceRegistrationResource },
        },
      },
      400: problemResponse('Cuerpo inválido o token rechazado por Firebase'),
      401: problemResponse('Falta X-User-Id (no pasó por el gateway)'),
      502: problemResponse('Firebase no está disponible'),
    },
  });
  registry.registerPath({
    method: 'delete',
    path: `${DEVICE_REGISTRATIONS_PATH}/{deviceToken}`,
    tags: ['Device Registrations'],
    summary: 'Dar de baja un dispositivo (cerrar sesión)',
    security: [{ bearerAuth: [] }],
    request: {
      headers: UserIdHeaders,
      params: z.object({
        deviceToken: z
          .string()
          .meta({ description: 'Token de FCM del dispositivo' }),
      }),
    },
    responses: {
      204: { description: 'El dispositivo ya no recibe push del usuario' },
      400: problemResponse('Token con formato inválido o rechazado'),
      401: problemResponse('Falta X-User-Id (no pasó por el gateway)'),
      502: problemResponse('Firebase no está disponible'),
    },
  });
}
