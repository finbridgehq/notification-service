import { DomainError } from '../../../shared/domain/model/domain.error';
import {
  INVESTOR_USER_ID,
  MYPE_USER_ID,
  auctionPublishedEvent,
  auctionRejectedEvent,
  companyKycStatusChangedEvent,
  companyVerificationIssuedEvent,
  depositSucceededEvent,
  financeHeaders,
  greenCertificationIssuedEvent,
  investorKycRejectedEvent,
  investorKycVerifiedEvent,
  invoiceEligibleForFundingEvent,
  message,
  userCreatedEvent,
} from '../../../test-support/fixtures/upstream-events';
import { silentLogger } from '../../../test-support/silent-logger';
import type { SendNotificationCommand } from '../../domain/model/commands/send-notification.command';
import { NotificationChannel } from '../../domain/model/valueobjects/notification-channel.enum';
import { NotificationType } from '../../domain/model/valueobjects/notification-type.enum';
import type { INotificationCommandService } from '../../domain/services/notification-command.service';
import { AuctionLifecycleSubscriber } from './auction-lifecycle.subscriber';
import { CompanyVerificationsSubscriber } from './company-verifications.subscriber';
import { FinanceEventsSubscriber } from './finance-events.subscriber';
import { GreenCertificationsSubscriber } from './green-certifications.subscriber';
import { IamEventsSubscriber } from './iam-events.subscriber';
import { InvoicingEventsSubscriber } from './invoicing-events.subscriber';
import type { NotificationEventSubscriber } from './notification-event.subscriber';
import { ProfileEventsSubscriber } from './profile-events.subscriber';

type SubscriberClass = new (
  service: INotificationCommandService,
  logger: ReturnType<typeof silentLogger>,
) => NotificationEventSubscriber;

function setUp(Subscriber: SubscriberClass) {
  const commandService: jest.Mocked<INotificationCommandService> = {
    handleSendNotification: jest.fn().mockResolvedValue(null),
  };
  const logger = silentLogger();
  const subscriber = new Subscriber(commandService, logger);
  const sentCommand = (): SendNotificationCommand =>
    commandService.handleSendNotification.mock.calls[0][0];
  return { subscriber, commandService, logger, sentCommand };
}

describe('IamEventsSubscriber', () => {
  it('envía la bienvenida por email al inversionista con el email del evento', async () => {
    const { subscriber, sentCommand } = setUp(IamEventsSubscriber);
    await subscriber.handle(message(subscriber.topic, userCreatedEvent));

    expect(subscriber.topic).toBe('vankoo.iam.events');
    expect(sentCommand()).toMatchObject({
      sourceEventKey: `iam:UserCreated:${INVESTOR_USER_ID}`,
      type: NotificationType.USER_WELCOME,
      recipientId: INVESTOR_USER_ID,
      channels: [NotificationChannel.EMAIL],
      recipientEmail: 'inversor@vankoo.test',
      variables: { role: 'INVESTOR' },
    });
  });

  it('distingue a la Mype por su rol', async () => {
    const { subscriber, sentCommand } = setUp(IamEventsSubscriber);
    await subscriber.handle(
      message(subscriber.topic, { ...userCreatedEvent, roles: ['ROLE_MYPE'] }),
    );
    expect(sentCommand().variables).toEqual({ role: 'MYPE' });
  });

  it.each([
    ['un rol sin notificación', { ...userCreatedEvent, roles: ['ROLE_ADMIN'] }],
    ['otro tipo de evento', { ...userCreatedEvent, eventType: 'UserDeleted' }],
    ['sin email', { id: 'x', roles: ['ROLE_MYPE'] }],
    ['un valor que no es objeto', 'hola'],
  ])('ignora %s', async (_case, value) => {
    const { subscriber, commandService } = setUp(IamEventsSubscriber);
    await subscriber.handle(message(subscriber.topic, value));
    expect(commandService.handleSendNotification).not.toHaveBeenCalled();
  });
});

describe('ProfileEventsSubscriber', () => {
  it('notifica el KYC verificado del inversionista por push y email', async () => {
    const { subscriber, sentCommand } = setUp(ProfileEventsSubscriber);
    await subscriber.handle(
      message(subscriber.topic, investorKycVerifiedEvent),
    );
    expect(sentCommand()).toMatchObject({
      type: NotificationType.INVESTOR_KYC_VERIFIED,
      recipientId: INVESTOR_USER_ID,
      channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      recipientEmail: 'inversor@vankoo.test',
    });
  });

  it('incluye el motivo del rechazo y lo usa en la clave del evento', async () => {
    const { subscriber, sentCommand } = setUp(ProfileEventsSubscriber);
    await subscriber.handle(
      message(subscriber.topic, investorKycRejectedEvent),
    );
    expect(sentCommand().type).toBe(NotificationType.INVESTOR_KYC_REJECTED);
    expect(sentCommand().variables).toEqual({
      reason: 'La foto del DNI no es legible',
    });
    expect(sentCommand().sourceEventKey).toContain(
      'La foto del DNI no es legible',
    );
  });

  it.each([
    ['VERIFIED', NotificationType.COMPANY_KYC_VERIFIED],
    ['REJECTED', NotificationType.COMPANY_KYC_REJECTED],
  ])(
    'notifica a la Mype el KYC %s de su empresa por email',
    async (kycStatus, type) => {
      const { subscriber, sentCommand } = setUp(ProfileEventsSubscriber);
      await subscriber.handle(
        message(subscriber.topic, {
          ...companyKycStatusChangedEvent,
          kycStatus,
        }),
      );
      expect(sentCommand()).toMatchObject({
        sourceEventKey: companyKycStatusChangedEvent.eventId,
        type,
        recipientId: MYPE_USER_ID,
        channels: [NotificationChannel.EMAIL],
      });
      expect(sentCommand().recipientEmail).toBeUndefined();
    },
  );

  it.each([
    [
      'el KYC legacy de una empresa',
      { ...investorKycVerifiedEvent, profileType: 'COMPANY' },
    ],
    [
      'un estado intermedio',
      { ...companyKycStatusChangedEvent, kycStatus: 'IN_REVIEW' },
    ],
    [
      'un CompanyKycStatusChanged de otra versión',
      { ...companyKycStatusChangedEvent, schemaVersion: 2 },
    ],
    [
      'un KycVerified sin userId',
      { ...investorKycVerifiedEvent, userId: undefined },
    ],
    [
      'ProfileCompleted',
      { eventType: 'ProfileCompleted', userId: 'u', email: 'a@b.co' },
    ],
  ])('ignora %s', async (_case, value) => {
    const { subscriber, commandService } = setUp(ProfileEventsSubscriber);
    await subscriber.handle(message(subscriber.topic, value));
    expect(commandService.handleSendNotification).not.toHaveBeenCalled();
  });
});

describe('CompanyVerificationsSubscriber', () => {
  it('pide corregir los datos con los campos traducidos', async () => {
    const { subscriber, sentCommand } = setUp(CompanyVerificationsSubscriber);
    await subscriber.handle(
      message(subscriber.topic, companyVerificationIssuedEvent),
    );
    expect(sentCommand()).toMatchObject({
      sourceEventKey: companyVerificationIssuedEvent.eventId,
      type: NotificationType.COMPANY_VERIFICATION_CORRECTION_REQUIRED,
      recipientId: MYPE_USER_ID,
      variables: { fields: 'razón social, domicilio fiscal' },
    });
  });

  it.each([
    [
      'VERIFIED (lo notifica Profile)',
      {
        ...companyVerificationIssuedEvent,
        data: { ...companyVerificationIssuedEvent.data, decision: 'VERIFIED' },
      },
    ],
    [
      'un evento sin eventId',
      { ...companyVerificationIssuedEvent, eventId: undefined },
    ],
    [
      'otro eventType',
      { ...companyVerificationIssuedEvent, eventType: 'Other' },
    ],
    [
      'data sin userId',
      {
        ...companyVerificationIssuedEvent,
        data: { ...companyVerificationIssuedEvent.data, userId: undefined },
      },
    ],
  ])('ignora %s', async (_case, value) => {
    const { subscriber, commandService } = setUp(
      CompanyVerificationsSubscriber,
    );
    await subscriber.handle(message(subscriber.topic, value));
    expect(commandService.handleSendNotification).not.toHaveBeenCalled();
  });
});

describe('GreenCertificationsSubscriber', () => {
  it('notifica el certificado aprobado a la Mype', async () => {
    const { subscriber, sentCommand } = setUp(GreenCertificationsSubscriber);
    await subscriber.handle(
      message(subscriber.topic, greenCertificationIssuedEvent),
    );
    expect(sentCommand()).toMatchObject({
      type: NotificationType.GREEN_CERTIFICATION_GRANTED,
      recipientId: MYPE_USER_ID,
      variables: { standard: 'ISO 14001', validUntil: '2028-03-31' },
    });
  });

  it('notifica el certificado rechazado', async () => {
    const { subscriber, sentCommand } = setUp(GreenCertificationsSubscriber);
    await subscriber.handle(
      message(subscriber.topic, {
        ...greenCertificationIssuedEvent,
        data: {
          ...greenCertificationIssuedEvent.data,
          decision: 'NOT_GREEN',
          standard: null,
        },
      }),
    );
    expect(sentCommand().type).toBe(
      NotificationType.GREEN_CERTIFICATION_DENIED,
    );
  });

  it('ignora otros eventos', async () => {
    const { subscriber, commandService } = setUp(GreenCertificationsSubscriber);
    await subscriber.handle(
      message(subscriber.topic, {
        ...greenCertificationIssuedEvent,
        eventType: 'X',
      }),
    );
    await subscriber.handle(
      message(subscriber.topic, { ...greenCertificationIssuedEvent, data: {} }),
    );
    expect(commandService.handleSendNotification).not.toHaveBeenCalled();
  });
});

describe('AuctionLifecycleSubscriber', () => {
  it('avisa a la Mype que su factura fue rechazada, con el motivo', async () => {
    const { subscriber, sentCommand } = setUp(AuctionLifecycleSubscriber);
    await subscriber.handle(message(subscriber.topic, auctionRejectedEvent));
    expect(sentCommand()).toMatchObject({
      sourceEventKey: auctionRejectedEvent.eventId,
      type: NotificationType.INVOICE_REJECTED,
      recipientId: MYPE_USER_ID,
      variables: { reason: auctionRejectedEvent.data.reason },
    });
  });

  it('avisa a la Mype que su factura está en subasta', async () => {
    const { subscriber, sentCommand } = setUp(AuctionLifecycleSubscriber);
    await subscriber.handle(message(subscriber.topic, auctionPublishedEvent));
    expect(sentCommand()).toMatchObject({
      type: NotificationType.AUCTION_PUBLISHED,
      variables: {
        payerName: 'Pagador S.A.',
        targetAmount: 9884,
        currency: 'PEN',
        expiresAt: '2026-09-21T16:00:00Z',
      },
    });
  });

  it.each([
    [
      'PartitionAdded (no trae investorId)',
      { ...auctionPublishedEvent, eventType: 'PartitionAdded' },
    ],
    [
      'un AuctionPublished inválido',
      { ...auctionPublishedEvent, data: { mypeId: 'x' } },
    ],
    ['un AuctionRejected inválido', { ...auctionRejectedEvent, data: {} }],
    ['una versión desconocida', { ...auctionRejectedEvent, schemaVersion: 2 }],
  ])('ignora %s', async (_case, value) => {
    const { subscriber, commandService } = setUp(AuctionLifecycleSubscriber);
    await subscriber.handle(message(subscriber.topic, value));
    expect(commandService.handleSendNotification).not.toHaveBeenCalled();
  });
});

describe('FinanceEventsSubscriber', () => {
  it.each([
    ['DepositSucceededEvent', NotificationType.DEPOSIT_SUCCEEDED],
    ['DepositFailedEvent', NotificationType.DEPOSIT_FAILED],
    ['DepositCancelledEvent', NotificationType.DEPOSIT_CANCELLED],
  ])(
    'convierte %s (tipo en la cabecera) en un push con el monto en soles',
    async (eventType, type) => {
      const { subscriber, sentCommand } = setUp(FinanceEventsSubscriber);
      await subscriber.handle(
        message(
          subscriber.topic,
          { ...depositSucceededEvent, failureReason: 'card_declined' },
          financeHeaders(eventType),
        ),
      );
      expect(sentCommand()).toMatchObject({
        sourceEventKey: 'a1000000-0000-4000-8000-000000000001',
        type,
        recipientId: INVESTOR_USER_ID,
        channels: [NotificationChannel.PUSH],
        variables: { amount: 1500.5, currency: 'PEN', depositId: 'dep-0001' },
      });
    },
  );

  it('usa una clave de negocio si falta event-id', async () => {
    const { subscriber, sentCommand } = setUp(FinanceEventsSubscriber);
    const headers: Record<string, string> = financeHeaders(
      'DepositSucceededEvent',
    );
    delete headers['event-id'];
    await subscriber.handle(
      message(subscriber.topic, depositSucceededEvent, headers),
    );
    expect(sentCommand().sourceEventKey).toBe(
      'finance:DepositSucceededEvent:dep-0001',
    );
  });

  it('ignora los eventos internos y los inválidos', async () => {
    const { subscriber, commandService } = setUp(FinanceEventsSubscriber);
    await subscriber.handle(
      message(
        subscriber.topic,
        depositSucceededEvent,
        financeHeaders('DepositInitiatedEvent'),
      ),
    );
    await subscriber.handle(
      message(
        subscriber.topic,
        { depositId: 'x' },
        financeHeaders('DepositFailedEvent'),
      ),
    );
    expect(commandService.handleSendNotification).not.toHaveBeenCalled();
  });
});

describe('InvoicingEventsSubscriber', () => {
  it('lee el evento en PascalCase y avisa que la factura se recibió', async () => {
    const { subscriber, sentCommand } = setUp(InvoicingEventsSubscriber);
    await subscriber.handle(
      message(subscriber.topic, invoiceEligibleForFundingEvent),
    );
    expect(sentCommand()).toMatchObject({
      sourceEventKey: invoiceEligibleForFundingEvent.EventId,
      type: NotificationType.INVOICE_RECEIVED,
      recipientId: MYPE_USER_ID,
      variables: {
        payerName: 'Pagador S.A.',
        amount: 10000.5,
        currency: 'PEN',
      },
    });
  });

  it('ignora un evento sin MypeId', async () => {
    const { subscriber, commandService } = setUp(InvoicingEventsSubscriber);
    await subscriber.handle(
      message(subscriber.topic, {
        ...invoiceEligibleForFundingEvent,
        MypeId: '',
      }),
    );
    expect(commandService.handleSendNotification).not.toHaveBeenCalled();
  });
});

describe('NotificationEventSubscriber (base)', () => {
  it('ignora con un warn un DomainError (reintentar no lo arreglaría)', async () => {
    const { subscriber, commandService, logger } = setUp(IamEventsSubscriber);
    commandService.handleSendNotification.mockRejectedValue(
      new DomainError('INVALID_RECIPIENT_ID', 'id inválido'),
    );
    await expect(
      subscriber.handle(message(subscriber.topic, userCreatedEvent)),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('propaga los fallos de entrega para que Kafka reintente', async () => {
    const { subscriber, commandService } = setUp(IamEventsSubscriber);
    commandService.handleSendNotification.mockRejectedValue(
      new Error('SMTP caído'),
    );
    await expect(
      subscriber.handle(message(subscriber.topic, userCreatedEvent)),
    ).rejects.toThrow('SMTP caído');
  });
});
