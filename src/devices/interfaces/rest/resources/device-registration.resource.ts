import { z } from 'zod';
import { DevicePlatform } from '../../../domain/model/valueobjects/device-platform.enum';

/**
 * @author LiquiLabs
 * @summary Respuesta de un registro. No devuelve el token: la app ya lo tiene.
 */
export const DeviceRegistrationResource = z
  .object({
    userId: z
      .string()
      .meta({ example: '40000000-0000-4000-8000-000000000001' }),
    platform: z.enum(DevicePlatform),
    registeredAt: z.iso
      .datetime()
      .meta({ example: '2026-11-03T15:00:00.000Z' }),
  })
  .meta({ id: 'DeviceRegistrationResource' });

/** @author LiquiLabs */
export type DeviceRegistrationResource = z.infer<
  typeof DeviceRegistrationResource
>;
