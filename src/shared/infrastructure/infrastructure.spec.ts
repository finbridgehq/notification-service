import type { Eureka, EurekaConfig } from 'eureka-js-client';
import { silentLogger } from '../../test-support/silent-logger';
import { loadAppConfig } from './config/env.config';
import { EurekaClientService } from './discovery/eureka-client.service';
import { createFirebaseMessaging } from './firebase/firebase-messaging.factory';
import { PushTopicNaming } from './firebase/push-topic-naming';
import { createLogger } from './logging/logger';
import { createKafka } from './messaging/kafka.factory';

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'notification-service' })),
  cert: jest.fn((serviceAccount: unknown) => ({ serviceAccount })),
  applicationDefault: jest.fn(() => ({ applicationDefault: true })),
}));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(() => ({ messaging: true })),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const firebaseApp = require('firebase-admin/app') as {
  initializeApp: jest.Mock;
  cert: jest.Mock;
};

describe('PushTopicNaming', () => {
  it('genera un topic estable, válido para FCM y distinto por secreto', () => {
    const naming = new PushTopicNaming('a-secret-of-16-chars');
    const topic = naming.topicFor('user-1');
    expect(topic).toMatch(/^user_[0-9a-f]{64}$/);
    expect(naming.topicFor('user-1')).toBe(topic);
    expect(naming.topicFor('user-2')).not.toBe(topic);
    expect(
      new PushTopicNaming('another-secret-123').topicFor('user-1'),
    ).not.toBe(topic);
    expect(topic).not.toContain('user-1');
  });
});

describe('createFirebaseMessaging', () => {
  beforeEach(() => jest.clearAllMocks());

  it('usa la cuenta de servicio de las variables de entorno', () => {
    const messaging = createFirebaseMessaging({
      projectId: 'vankoo',
      clientEmail: 'sa@vankoo.test',
      privateKey: 'key',
    });
    expect(firebaseApp.cert).toHaveBeenCalledWith({
      projectId: 'vankoo',
      clientEmail: 'sa@vankoo.test',
      privateKey: 'key',
    });
    expect(firebaseApp.initializeApp.mock.calls[0][0]).toMatchObject({
      projectId: 'vankoo',
    });
    expect(messaging).toEqual({ messaging: true });
  });

  it('sin variables usa las credenciales por defecto de Google', () => {
    createFirebaseMessaging(undefined);
    expect(firebaseApp.initializeApp.mock.calls[0][0]).toEqual({
      credential: { applicationDefault: true },
    });
  });
});

describe('EurekaClientService', () => {
  function setUp(instances: unknown[] = []) {
    let captured: EurekaConfig | undefined;
    const client = {
      start: jest.fn((callback: (error?: Error) => void) => callback()),
      stop: jest.fn((callback: () => void) => callback()),
      getInstancesByAppId: jest.fn(() => instances),
    };
    const service = new EurekaClientService(
      {
        appName: 'notification-service',
        instanceHostname: 'notification-service',
        port: 3001,
        eurekaHost: 'discovery-server',
        eurekaPort: 8761,
      },
      silentLogger(),
      (config) => {
        captured = config;
        return client as unknown as Eureka;
      },
    );
    return { service, client, config: () => captured as EurekaConfig };
  }

  it('se registra con el nombre que usa el gateway y sus health checks', async () => {
    const { service, client, config } = setUp();
    await service.start();
    await service.stop();
    expect(config().instance).toMatchObject({
      app: 'notification-service',
      vipAddress: 'notification-service',
      instanceId: 'notification-service:notification-service:3001',
      healthCheckUrl: 'http://notification-service:3001/health/ready',
      port: { $: 3001, '@enabled': 'true' },
    });
    expect(config().eureka).toMatchObject({
      host: 'discovery-server',
      port: 8761,
      fetchRegistry: true,
    });
    expect(client.stop).toHaveBeenCalled();
  });

  it('arranca aunque Eureka no responda', async () => {
    const { service, client } = setUp();
    client.start.mockImplementation((callback: (error?: Error) => void) =>
      callback(new Error('ECONNREFUSED')),
    );
    await expect(service.start()).resolves.toBeUndefined();
  });

  it('resuelve la URL de una instancia UP de otro servicio', () => {
    const { service, client } = setUp([
      { hostName: 'caido', status: 'DOWN', port: { $: 1 } },
      { hostName: 'profile-service', status: 'UP', port: { $: 3000 } },
    ]);
    expect(service.resolveServiceUrl('profile-service')).toBe(
      'http://profile-service:3000',
    );
    client.getInstancesByAppId.mockReturnValue([]);
    expect(service.resolveServiceUrl('profile-service')).toBeNull();
  });
});

describe('fábricas', () => {
  it('crean el cliente de Kafka y el logger', () => {
    const kafka = createKafka(loadAppConfig({}).kafka);
    expect(typeof kafka.consumer).toBe('function');
    expect(createLogger('silent').level).toBe('silent');
  });
});
