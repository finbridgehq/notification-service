import { DomainError } from '../../../../shared/domain/model/domain.error';
import { SendNotificationCommand } from '../commands/send-notification.command';
import { EmailAddress } from './email-address.vo';
import { NotificationChannel } from './notification-channel.enum';
import { NotificationChannelPolicy } from './notification-channel-policy';
import { NotificationContent } from './notification-content.vo';
import { NotificationType } from './notification-type.enum';
import { RecipientId } from './recipient-id.vo';

describe('EmailAddress', () => {
  it('normaliza a minúsculas y sin espacios', () => {
    expect(new EmailAddress('  Ana@Vankoo.TEST ').value).toBe(
      'ana@vankoo.test',
    );
  });

  it.each(['', 'sin-arroba', 'a@b', 'a b@c.com'])('rechaza %p', (value) => {
    expect(() => new EmailAddress(value)).toThrow(DomainError);
  });

  it('tryCreate devuelve null en vez de lanzar', () => {
    expect(EmailAddress.tryCreate('mal')).toBeNull();
    expect(EmailAddress.tryCreate(undefined)).toBeNull();
    expect(EmailAddress.tryCreate('a@b.co')?.value).toBe('a@b.co');
  });
});

describe('RecipientId', () => {
  it('rechaza un id vacío o demasiado largo', () => {
    expect(() => new RecipientId('  ')).toThrow(DomainError);
    expect(() => new RecipientId('x'.repeat(129))).toThrow(DomainError);
    expect(new RecipientId(' u1 ').value).toBe('u1');
  });
});

describe('NotificationContent', () => {
  it('exige título y cuerpo', () => {
    expect(() => new NotificationContent('', 'b')).toThrow(DomainError);
    expect(() => new NotificationContent('t', ' ')).toThrow(DomainError);
    expect(new NotificationContent('t', 'b').data).toEqual({});
  });
});

describe('SendNotificationCommand', () => {
  it('exige la clave del evento y al menos un canal', () => {
    expect(
      () =>
        new SendNotificationCommand(' ', NotificationType.USER_WELCOME, 'u', [
          NotificationChannel.EMAIL,
        ]),
    ).toThrow('clave del evento');
    expect(
      () =>
        new SendNotificationCommand(
          'k',
          NotificationType.USER_WELCOME,
          'u',
          [],
        ),
    ).toThrow('al menos un canal');
  });
});

describe('NotificationChannelPolicy', () => {
  it('manda a la Mype por email y las recargas por push', () => {
    expect(
      NotificationChannelPolicy.channelsFor(NotificationType.AUCTION_PUBLISHED),
    ).toEqual([NotificationChannel.EMAIL]);
    expect(
      NotificationChannelPolicy.channelsFor(NotificationType.DEPOSIT_FAILED),
    ).toEqual([NotificationChannel.PUSH]);
  });

  it('devuelve una copia que no altera la política', () => {
    const channels = NotificationChannelPolicy.channelsFor(
      NotificationType.USER_WELCOME,
    );
    channels.push(NotificationChannel.PUSH);
    expect(
      NotificationChannelPolicy.channelsFor(NotificationType.USER_WELCOME),
    ).toEqual([NotificationChannel.EMAIL]);
  });
});
