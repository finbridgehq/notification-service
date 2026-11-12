import type { Logger } from '../../../shared/infrastructure/logging/logger';
import type { DeviceToken } from '../../domain/model/valueobjects/device-token.vo';
import type { UserId } from '../../domain/model/valueobjects/user-id.vo';
import type { IPushSubscriptionGateway } from '../../domain/services/push-subscription-gateway';

/**
 * @author LiquiLabs
 * @summary Para desarrollo local (PUSH_PROVIDER=logging): FCM no tiene emulador, así que solo se registra en el log.
 */
export class LoggingPushSubscriptionGateway implements IPushSubscriptionGateway {
  constructor(private readonly logger: Logger) {}

  subscribe(userId: UserId, deviceToken: DeviceToken): Promise<void> {
    this.logger.info(
      { userId: userId.value, token: deviceToken.masked() },
      '[push:logging] Dispositivo suscrito',
    );
    return Promise.resolve();
  }

  unsubscribe(userId: UserId, deviceToken: DeviceToken): Promise<void> {
    this.logger.info(
      { userId: userId.value, token: deviceToken.masked() },
      '[push:logging] Dispositivo retirado',
    );
    return Promise.resolve();
  }
}
