import type { DeviceToken } from '../model/valueobjects/device-token.vo';
import type { UserId } from '../model/valueobjects/user-id.vo';

/**
 * @author LiquiLabs
 * @summary Puerto hacia el proveedor de push: suscribe o quita un dispositivo del canal de su usuario.
 */
export interface IPushSubscriptionGateway {
  subscribe(userId: UserId, deviceToken: DeviceToken): Promise<void>;
  unsubscribe(userId: UserId, deviceToken: DeviceToken): Promise<void>;
}
