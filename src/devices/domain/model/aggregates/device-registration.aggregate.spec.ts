import { DomainError } from '../../../../shared/domain/model/domain.error';
import { RegisterDeviceCommand } from '../commands/register-device.command';
import { DevicePlatform } from '../valueobjects/device-platform.enum';
import { DeviceToken } from '../valueobjects/device-token.vo';
import { UserId } from '../valueobjects/user-id.vo';
import { DeviceRegistration } from './device-registration.aggregate';

const TOKEN = 'fGx3c1V9QkK0yN2b:APA91bH7dK2mE5xQwZr8T1pLsVn3cY6uJ0aB4fG9hI2k';

describe('DeviceRegistration', () => {
  it('registra el dispositivo del usuario', () => {
    const now = new Date('2026-11-03T15:00:00Z');
    const registration = DeviceRegistration.register(
      new RegisterDeviceCommand('user-1', ` ${TOKEN} `, DevicePlatform.IOS),
      now,
    );
    expect(registration.userId.value).toBe('user-1');
    expect(registration.deviceToken.value).toBe(TOKEN);
    expect(registration.platform).toBe(DevicePlatform.IOS);
    expect(registration.registeredAt).toBe(now);
  });

  it('rechaza una plataforma desconocida', () => {
    expect(
      () => new RegisterDeviceCommand('u', TOKEN, 'WINDOWS' as DevicePlatform),
    ).toThrow(DomainError);
  });
});

describe('DeviceToken', () => {
  it.each([
    ['muy corto', 'abc'],
    ['con espacios en medio', 'abcdefghij klmnopqrstuvwxyz'],
    ['con caracteres raros', 'abcdefghijklmnopqrstu<script>'],
    ['demasiado largo', 'a'.repeat(4097)],
  ])('rechaza un token %s', (_case, value) => {
    expect(() => new DeviceToken(value)).toThrow(DomainError);
  });

  it('en los logs solo muestra el final', () => {
    expect(new DeviceToken(TOKEN).masked()).toBe('…G9hI2k');
  });
});

describe('UserId', () => {
  it('rechaza un id vacío', () => {
    expect(() => new UserId('')).toThrow(DomainError);
    expect(new UserId(' u ').value).toBe('u');
  });
});
