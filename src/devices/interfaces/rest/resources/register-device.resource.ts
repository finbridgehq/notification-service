import { z } from 'zod';
import { DevicePlatform } from '../../../domain/model/valueobjects/device-platform.enum';

/**
 * @author LiquiLabs
 * @summary Cuerpo de POST /device-registrations: el token que la app obtuvo de Firebase.
 */
export const RegisterDeviceResource = z
  .object({
    deviceToken: z
      .string()
      .min(20, 'El token debe tener al menos 20 caracteres')
      .max(4096, 'El token no puede pasar de 4096 caracteres')
      .meta({
        description: 'Token de registro de FCM del dispositivo',
        example:
          'fGx3c1V9QkK0yN2b:APA91bH7dK2mE5xQwZr8T1pLsVn3cY6uJ0aB4fG9hI2kL7mN',
      }),
    platform: z.enum(DevicePlatform).meta({ example: DevicePlatform.ANDROID }),
  })
  .meta({ id: 'RegisterDeviceResource' });

/** @author LiquiLabs */
export type RegisterDeviceResource = z.infer<typeof RegisterDeviceResource>;
