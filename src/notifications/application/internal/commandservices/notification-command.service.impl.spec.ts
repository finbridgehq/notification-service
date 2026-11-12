import { silentLogger } from '../../../../test-support/silent-logger';
import { SendNotificationCommand } from '../../../domain/model/commands/send-notification.command';
import { DeliveryStatus } from '../../../domain/model/valueobjects/delivery-status.enum';
import { EmailAddress } from '../../../domain/model/valueobjects/email-address.vo';
import { NotificationChannel } from '../../../domain/model/valueobjects/notification-channel.enum';
import { NotificationContent } from '../../../domain/model/valueobjects/notification-content.vo';
import { NotificationType } from '../../../domain/model/valueobjects/notification-type.enum';
import type { IEmailSender } from '../../../domain/services/email-sender';
import type { INotificationTemplateCatalog } from '../../../domain/services/notification-template-catalog';
import type { IPushNotificationSender } from '../../../domain/services/push-notification-sender';
import type { IRecipientDirectory } from '../../../domain/services/recipient-directory';
import { InMemoryProcessedEventRegistry } from '../../../infrastructure/idempotency/in-memory-processed-event.registry';
import { NotificationCommandServiceImpl } from './notification-command.service.impl';
import { NotificationDeliveryError } from './notification-delivery.error';

const { EMAIL, PUSH } = NotificationChannel;
const content = new NotificationContent('Título', 'Cuerpo');

function setUp() {
  const templateCatalog: jest.Mocked<INotificationTemplateCatalog> = {
    render: jest.fn().mockReturnValue(content),
    definitions: jest.fn(),
  };
  const recipientDirectory: jest.Mocked<IRecipientDirectory> = {
    findEmail: jest
      .fn()
      .mockResolvedValue(new EmailAddress('mype@vankoo.test')),
  };
  const pushSender: jest.Mocked<IPushNotificationSender> = {
    send: jest.fn().mockResolvedValue(undefined),
  };
  const emailSender: jest.Mocked<IEmailSender> = {
    send: jest.fn().mockResolvedValue(undefined),
  };
  const registry = new InMemoryProcessedEventRegistry(100, 60_000);
  const service = new NotificationCommandServiceImpl(
    templateCatalog,
    recipientDirectory,
    pushSender,
    emailSender,
    registry,
    silentLogger(),
  );
  return {
    service,
    templateCatalog,
    recipientDirectory,
    pushSender,
    emailSender,
  };
}

const command = (channels: NotificationChannel[], recipientEmail?: string) =>
  new SendNotificationCommand(
    'event-1',
    NotificationType.INVESTOR_KYC_VERIFIED,
    'user-1',
    channels,
    { reason: 'x' },
    recipientEmail,
  );

describe('NotificationCommandServiceImpl', () => {
  it('renderiza la plantilla y entrega por push y email con el email del evento', async () => {
    const {
      service,
      templateCatalog,
      recipientDirectory,
      pushSender,
      emailSender,
    } = setUp();

    const notification = await service.handleSendNotification(
      command([PUSH, EMAIL], 'inversor@vankoo.test'),
    );

    expect(templateCatalog.render).toHaveBeenCalledWith(
      NotificationType.INVESTOR_KYC_VERIFIED,
      { reason: 'x' },
    );
    expect(recipientDirectory.findEmail).not.toHaveBeenCalled();
    expect(pushSender.send.mock.calls[0][0].value).toBe('user-1');
    expect(emailSender.send.mock.calls[0][0].value).toBe(
      'inversor@vankoo.test',
    );
    expect(notification?.deliveryOf(PUSH)?.status).toBe(DeliveryStatus.SENT);
    expect(notification?.deliveryOf(EMAIL)?.status).toBe(DeliveryStatus.SENT);
  });

  it('busca el email con el ACL de Profile cuando el evento no lo trae', async () => {
    const { service, recipientDirectory, emailSender } = setUp();
    await service.handleSendNotification(command([EMAIL]));
    expect(recipientDirectory.findEmail.mock.calls[0][0].value).toBe('user-1');
    expect(emailSender.send.mock.calls[0][0].value).toBe('mype@vankoo.test');
  });

  it('omite el email si el destinatario no tiene uno, sin fallar', async () => {
    const { service, recipientDirectory, emailSender, pushSender } = setUp();
    recipientDirectory.findEmail.mockResolvedValue(null);

    const notification = await service.handleSendNotification(
      command([PUSH, EMAIL]),
    );

    expect(emailSender.send).not.toHaveBeenCalled();
    expect(pushSender.send).toHaveBeenCalled();
    expect(notification?.deliveryOf(EMAIL)).toEqual({
      status: DeliveryStatus.SKIPPED,
      reason: 'RECIPIENT_EMAIL_NOT_FOUND',
    });
  });

  it('no notifica dos veces el mismo evento', async () => {
    const { service, pushSender } = setUp();
    await service.handleSendNotification(command([PUSH]));
    const duplicate = await service.handleSendNotification(command([PUSH]));
    expect(duplicate).toBeNull();
    expect(pushSender.send).toHaveBeenCalledTimes(1);
  });

  it('si un canal falla lanza, y el reintento solo repite el canal fallido', async () => {
    const { service, pushSender, emailSender } = setUp();
    emailSender.send.mockRejectedValueOnce(new Error('SMTP caído'));

    await expect(
      service.handleSendNotification(command([PUSH, EMAIL], 'a@b.co')),
    ).rejects.toThrow(NotificationDeliveryError);
    await expect(
      service.handleSendNotification(command([PUSH, EMAIL], 'a@b.co')),
    ).resolves.not.toBeNull();

    expect(pushSender.send).toHaveBeenCalledTimes(1);
    expect(emailSender.send).toHaveBeenCalledTimes(2);
  });

  it('si Profile no responde, entrega el push y lanza para reintentar el email', async () => {
    const { service, recipientDirectory, pushSender } = setUp();
    recipientDirectory.findEmail.mockRejectedValue(
      new Error('Profile Service: respondió 503'),
    );

    const error = await service
      .handleSendNotification(command([PUSH, EMAIL]))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotificationDeliveryError);
    expect((error as Error).message).toContain('EMAIL: Profile Service');
    expect(pushSender.send).toHaveBeenCalledTimes(1);
  });
});
