import { DomainError } from '../../../../shared/domain/model/domain.error';
import { DeliveryStatus } from '../valueobjects/delivery-status.enum';
import { EmailAddress } from '../valueobjects/email-address.vo';
import { NotificationChannel } from '../valueobjects/notification-channel.enum';
import { NotificationContent } from '../valueobjects/notification-content.vo';
import { NotificationType } from '../valueobjects/notification-type.enum';
import { RecipientId } from '../valueobjects/recipient-id.vo';
import { Notification } from './notification.aggregate';

const { EMAIL, PUSH } = NotificationChannel;

function notification(
  channels = [PUSH, EMAIL],
  email: EmailAddress | null = null,
) {
  return Notification.create({
    sourceEventKey: 'event-1',
    type: NotificationType.INVESTOR_KYC_VERIFIED,
    recipientId: new RecipientId('user-1'),
    content: new NotificationContent('Título', 'Cuerpo'),
    channels,
    email,
  });
}

describe('Notification', () => {
  it('nace con cada canal pendiente, sin repetir canales', () => {
    const subject = notification([PUSH, EMAIL, PUSH]);
    expect(subject.channels).toEqual([PUSH, EMAIL]);
    expect(subject.pendingChannels()).toEqual([PUSH, EMAIL]);
    expect(subject.deliveryOf(PUSH)).toEqual({
      status: DeliveryStatus.PENDING,
    });
  });

  it('exige al menos un canal', () => {
    expect(() => notification([])).toThrow(DomainError);
  });

  it('pide resolver el email solo si el canal EMAIL sigue pendiente', () => {
    const subject = notification();
    expect(subject.needsEmailResolution()).toBe(true);
    subject.markSkipped(EMAIL, 'RECIPIENT_EMAIL_NOT_FOUND');
    expect(subject.needsEmailResolution()).toBe(false);
    expect(notification([PUSH]).needsEmailResolution()).toBe(false);
  });

  it('no pide email si ya lo trae', () => {
    const subject = notification([EMAIL], new EmailAddress('ana@vankoo.test'));
    expect(subject.needsEmailResolution()).toBe(false);
    expect(subject.recipientEmail?.value).toBe('ana@vankoo.test');
  });

  it('no entrega un email sin dirección', () => {
    const subject = notification([EMAIL]);
    expect(() => subject.markSent(EMAIL)).toThrow('sin la dirección');
    subject.assignEmail(new EmailAddress('ana@vankoo.test'));
    subject.markSent(EMAIL);
    expect(subject.deliveryOf(EMAIL)?.status).toBe(DeliveryStatus.SENT);
  });

  it('no cambia un canal que ya se resolvió ni uno que no se pidió', () => {
    const subject = notification([PUSH]);
    subject.markSent(PUSH);
    expect(() => subject.markFailed(PUSH, 'x')).toThrow('ya está SENT');
    expect(() => subject.markSent(EMAIL)).toThrow('no se pidió');
  });

  it('informa si algún canal falló', () => {
    const subject = notification([PUSH]);
    expect(subject.hasFailures()).toBe(false);
    subject.markFailed(PUSH, 'FCM caído');
    expect(subject.hasFailures()).toBe(true);
    expect(subject.deliveryOf(PUSH)).toEqual({
      status: DeliveryStatus.FAILED,
      reason: 'FCM caído',
    });
  });
});
