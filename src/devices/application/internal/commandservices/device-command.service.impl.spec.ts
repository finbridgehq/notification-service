import { DomainError } from '../../../../shared/domain/model/domain.error';
import { RegisterDeviceCommand } from '../../../domain/model/commands/register-device.command';
import { UnregisterDeviceCommand } from '../../../domain/model/commands/unregister-device.command';
import { DevicePlatform } from '../../../domain/model/valueobjects/device-platform.enum';
import type { IPushSubscriptionGateway } from '../../../domain/services/push-subscription-gateway';
import { DeviceCommandServiceImpl } from './device-command.service.impl';

const TOKEN = 'fGx3c1V9QkK0yN2b:APA91bH7dK2mE5xQwZr8T1pLsVn3cY6uJ0aB4fG9hI2k';
const NOW = new Date('2026-11-03T15:00:00Z');

function setUp() {
  const gateway: jest.Mocked<IPushSubscriptionGateway> = {
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
  };
  return { gateway, service: new DeviceCommandServiceImpl(gateway, () => NOW) };
}

describe('DeviceCommandServiceImpl', () => {
  it('suscribe el dispositivo al canal de su usuario', async () => {
    const { gateway, service } = setUp();
    const registration = await service.handleRegisterDevice(
      new RegisterDeviceCommand('user-1', TOKEN, DevicePlatform.ANDROID),
    );
    const [userId, token] = gateway.subscribe.mock.calls[0];
    expect(userId.value).toBe('user-1');
    expect(token.value).toBe(TOKEN);
    expect(registration.registeredAt).toBe(NOW);
  });

  it('no llama a Firebase si el token es inválido', async () => {
    const { gateway, service } = setUp();
    await expect(
      service.handleRegisterDevice(
        new RegisterDeviceCommand('user-1', 'corto', DevicePlatform.ANDROID),
      ),
    ).rejects.toBeInstanceOf(DomainError);
    expect(gateway.subscribe).not.toHaveBeenCalled();
  });

  it('da de baja el dispositivo', async () => {
    const { gateway, service } = setUp();
    await service.handleUnregisterDevice(
      new UnregisterDeviceCommand('user-1', TOKEN),
    );
    expect(gateway.unsubscribe.mock.calls[0][1].value).toBe(TOKEN);
  });

  it('propaga el fallo del proveedor de push', async () => {
    const { gateway, service } = setUp();
    gateway.subscribe.mockRejectedValue(new Error('FCM caído'));
    await expect(
      service.handleRegisterDevice(
        new RegisterDeviceCommand('user-1', TOKEN, DevicePlatform.IOS),
      ),
    ).rejects.toThrow('FCM caído');
  });
});
