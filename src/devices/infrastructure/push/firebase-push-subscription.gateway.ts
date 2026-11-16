import type {
  Messaging,
  MessagingTopicManagementResponse,
} from 'firebase-admin/messaging';
import { ExternalServiceError } from '../../../shared/application/errors/external-service.error';
import { DomainError } from '../../../shared/domain/model/domain.error';
import type { PushTopicNaming } from '../../../shared/infrastructure/firebase/push-topic-naming';
import type { Logger } from '../../../shared/infrastructure/logging/logger';
import type { DeviceToken } from '../../domain/model/valueobjects/device-token.vo';
import type { UserId } from '../../domain/model/valueobjects/user-id.vo';
import type { IPushSubscriptionGateway } from '../../domain/services/push-subscription-gateway';

/** Errores de FCM que significan "ese token no sirve", no "FCM está caído". */
const REJECTED_TOKEN_CODES = new Set([
  'messaging/invalid-argument',
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

/**
 * @author LiquiLabs
 * @summary Suscribe el dispositivo al topic de FCM de su usuario con Firebase Admin.
 */
export class FirebasePushSubscriptionGateway implements IPushSubscriptionGateway {
  constructor(
    private readonly messaging: Messaging,
    private readonly topicNaming: PushTopicNaming,
    private readonly logger: Logger,
  ) {}

  async subscribe(userId: UserId, deviceToken: DeviceToken): Promise<void> {
    const response = await this.call(() =>
      this.messaging.subscribeToTopic(
        deviceToken.value,
        this.topicNaming.topicFor(userId.value),
      ),
    );
    this.check(response, 'suscribir');
    this.logger.info(
      { userId: userId.value, token: deviceToken.masked() },
      'Dispositivo suscrito a su topic de FCM',
    );
  }

  async unsubscribe(userId: UserId, deviceToken: DeviceToken): Promise<void> {
    const response = await this.call(() =>
      this.messaging.unsubscribeFromTopic(
        deviceToken.value,
        this.topicNaming.topicFor(userId.value),
      ),
    );
    this.check(response, 'desuscribir');
    this.logger.info(
      { userId: userId.value, token: deviceToken.masked() },
      'Dispositivo retirado de su topic de FCM',
    );
  }

  private async call(
    operation: () => Promise<MessagingTopicManagementResponse>,
  ): Promise<MessagingTopicManagementResponse> {
    try {
      return await operation();
    } catch (error) {
      throw new ExternalServiceError(
        'Firebase Cloud Messaging',
        (error as Error).message,
        { cause: error },
      );
    }
  }

  private check(response: MessagingTopicManagementResponse, action: string) {
    if (response.failureCount === 0) return;
    const code = response.errors[0]?.error.code ?? 'unknown';
    if (REJECTED_TOKEN_CODES.has(code)) {
      throw new DomainError(
        'DEVICE_TOKEN_REJECTED',
        'Firebase rechazó el token del dispositivo: la app debe pedir uno nuevo',
      );
    }
    throw new ExternalServiceError(
      'Firebase Cloud Messaging',
      `No se pudo ${action} el dispositivo (${code})`,
    );
  }
}
