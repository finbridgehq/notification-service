import type { Messaging } from 'firebase-admin/messaging';
import { ExternalServiceError } from '../../../shared/application/errors/external-service.error';
import { DomainError } from '../../../shared/domain/model/domain.error';
import { PushTopicNaming } from '../../../shared/infrastructure/firebase/push-topic-naming';
import { silentLogger } from '../../../test-support/silent-logger';
import { DeviceToken } from '../../domain/model/valueobjects/device-token.vo';
import { UserId } from '../../domain/model/valueobjects/user-id.vo';
import { FirebasePushSubscriptionGateway } from './firebase-push-subscription.gateway';
import { LoggingPushSubscriptionGateway } from './logging-push-subscription.gateway';

const TOKEN = new DeviceToken(
  'fGx3c1V9QkK0yN2b:APA91bH7dK2mE5xQwZr8T1pLsVn3cY6uJ0aB4fG9hI2k',
);
const USER = new UserId('user-1');
const topicNaming = new PushTopicNaming('a-secret-of-16-chars');

const ok = { successCount: 1, failureCount: 0, errors: [] };
const failure = (code: string) => ({
  successCount: 0,
  failureCount: 1,
  errors: [{ index: 0, error: { code, message: code } }],
});

function gateway(messaging: Partial<Messaging>) {
  return new FirebasePushSubscriptionGateway(
    messaging as Messaging,
    topicNaming,
    silentLogger(),
  );
}

describe('FirebasePushSubscriptionGateway', () => {
  it('suscribe y desuscribe el token al topic del usuario', async () => {
    const messaging = {
      subscribeToTopic: jest.fn().mockResolvedValue(ok),
      unsubscribeFromTopic: jest.fn().mockResolvedValue(ok),
    };
    const subject = gateway(messaging);

    await subject.subscribe(USER, TOKEN);
    await subject.unsubscribe(USER, TOKEN);

    const topic = topicNaming.topicFor('user-1');
    expect(messaging.subscribeToTopic).toHaveBeenCalledWith(TOKEN.value, topic);
    expect(messaging.unsubscribeFromTopic).toHaveBeenCalledWith(
      TOKEN.value,
      topic,
    );
  });

  it('traduce un token rechazado por FCM a DomainError', async () => {
    const subject = gateway({
      subscribeToTopic: jest
        .fn()
        .mockResolvedValue(
          failure('messaging/registration-token-not-registered'),
        ),
    });
    await expect(subject.subscribe(USER, TOKEN)).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it('traduce otros fallos de FCM a ExternalServiceError', async () => {
    const subject = gateway({
      subscribeToTopic: jest
        .fn()
        .mockResolvedValue(failure('messaging/internal-error')),
      unsubscribeFromTopic: jest.fn().mockRejectedValue(new Error('timeout')),
    });
    await expect(subject.subscribe(USER, TOKEN)).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
    await expect(subject.unsubscribe(USER, TOKEN)).rejects.toThrow(
      'Firebase Cloud Messaging: timeout',
    );
  });
});

describe('LoggingPushSubscriptionGateway', () => {
  it('solo escribe en el log, sin el token completo', async () => {
    const logger = silentLogger();
    const subject = new LoggingPushSubscriptionGateway(logger);
    await subject.subscribe(USER, TOKEN);
    await subject.unsubscribe(USER, TOKEN);
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(JSON.stringify((logger.info as jest.Mock).mock.calls)).not.toContain(
      TOKEN.value,
    );
  });
});
