import type { Messaging } from 'firebase-admin/messaging';
import type { Kafka } from 'kafkajs';
import type { Transporter } from 'nodemailer';
import request from 'supertest';
import { createApp } from './app';
import { buildContainer } from './container';
import { FirebasePushSubscriptionGateway } from './devices/infrastructure/push/firebase-push-subscription.gateway';
import { loadAppConfig } from './shared/infrastructure/config/env.config';
import { PushTopicNaming } from './shared/infrastructure/firebase/push-topic-naming';
import {
  userCreatedEvent,
  message,
  companyKycStatusChangedEvent,
} from './test-support/fixtures/upstream-events';
import { silentLogger } from './test-support/silent-logger';

const TOKEN = 'fGx3c1V9QkK0yN2b:APA91bH7dK2mE5xQwZr8T1pLsVn3cY6uJ0aB4fG9hI2k';

function fakes() {
  const messaging = {
    subscribeToTopic: jest
      .fn()
      .mockResolvedValue({ successCount: 1, failureCount: 0, errors: [] }),
    send: jest.fn().mockResolvedValue('msg-1'),
  };
  const transporter = { sendMail: jest.fn().mockResolvedValue({}) };
  const consumer = {
    events: { GROUP_JOIN: 'join', CRASH: 'crash', DISCONNECT: 'disconnect' },
    on: jest.fn(),
  };
  const kafka = { consumer: () => consumer, producer: () => ({}) };
  const fetchFn = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ contactEmail: 'mype@vankoo.test' }),
  });
  return {
    messaging,
    transporter,
    fetchFn,
    factories: {
      firebaseMessaging: () => messaging as unknown as Messaging,
      smtpTransport: () => transporter as unknown as Transporter,
      kafka: () => kafka as unknown as Kafka,
      fetch: fetchFn as unknown as typeof fetch,
    },
  };
}

describe('buildContainer + createApp', () => {
  it('en local: logging para push y email, sin Kafka ni Eureka', async () => {
    const container = buildContainer(
      loadAppConfig({ KAFKA_ENABLED: 'false', EUREKA_ENABLED: 'false' }),
      silentLogger(),
    );
    expect(container.kafkaRunner).toBeNull();
    expect(container.eureka).toBeNull();
    expect(container.subscribers).toHaveLength(7);

    const app = createApp({ logger: silentLogger(), ...container });
    await request(app).get('/health/live').expect(200, { status: 'UP' });
    await request(app)
      .get('/health/ready')
      .expect(200, { status: 'UP', components: {} });
    await request(app)
      .post('/api/v1/device-registrations')
      .set('X-User-Id', 'user-1')
      .send({ deviceToken: TOKEN, platform: 'IOS' })
      .expect(201);
  });

  it('desplegado: Firebase, SMTP, Kafka y Profile por URL fija', async () => {
    const { factories, messaging, transporter, fetchFn } = fakes();
    const config = loadAppConfig({
      EUREKA_ENABLED: 'false',
      PUSH_PROVIDER: 'firebase',
      EMAIL_PROVIDER: 'smtp',
      PROFILE_SERVICE_URL: 'http://vankoo-profile-service',
    });
    const container = buildContainer(config, silentLogger(), factories);

    expect(container.kafkaRunner).not.toBeNull();
    const app = createApp({ logger: silentLogger(), ...container });
    // Kafka todavía no entró al grupo: el servicio no está listo.
    await request(app).get('/health/ready').expect(503);

    await request(app)
      .post('/api/v1/device-registrations')
      .set('X-User-Id', 'user-1')
      .send({ deviceToken: TOKEN, platform: 'ANDROID' })
      .expect(201);
    expect(messaging.subscribeToTopic).toHaveBeenCalledWith(
      TOKEN,
      new PushTopicNaming(config.push.topicSecret).topicFor('user-1'),
    );

    const [iam, profile] = container.subscribers;
    await iam.handle(message(iam.topic, userCreatedEvent));
    expect(transporter.sendMail.mock.calls[0][0].to).toBe(
      'inversor@vankoo.test',
    );

    await profile.handle(message(profile.topic, companyKycStatusChangedEvent));
    expect(fetchFn.mock.calls[0][0]).toBe(
      'http://vankoo-profile-service/api/v1/companies/me',
    );
    expect(transporter.sendMail.mock.calls[1][0].to).toBe('mype@vankoo.test');
  });

  it('con Eureka resuelve Profile Service desde el registro', () => {
    const container = buildContainer(
      loadAppConfig({ KAFKA_ENABLED: 'false', PUSH_PROVIDER: 'logging' }),
      silentLogger(),
    );
    expect(container.eureka).not.toBeNull();
    expect(container.deviceCommandService).toBeDefined();
    // FirebasePushSubscriptionGateway solo se usa con PUSH_PROVIDER=firebase.
    expect(FirebasePushSubscriptionGateway).toBeDefined();
  });
});

describe('documentación y errores genéricos', () => {
  const container = buildContainer(
    loadAppConfig({ KAFKA_ENABLED: 'false', EUREKA_ENABLED: 'false' }),
    silentLogger(),
  );
  const app = createApp({ logger: silentLogger(), ...container });

  it('publica el OpenAPI 3.1 con el gateway como primer server', async () => {
    const { body } = await request(app).get('/openapi/v1.json').expect(200);
    expect(body.openapi).toBe('3.1.0');
    expect(body.servers[0]).toEqual({
      url: '/notification',
      description: 'A través del API Gateway',
    });
    expect(Object.keys(body.paths as object)).toEqual(
      expect.arrayContaining([
        '/api/v1/device-registrations',
        '/api/v1/device-registrations/{deviceToken}',
        '/api/v1/notification-types',
        '/health/ready',
      ]),
    );
    expect(body.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  });

  it('sirve Scalar en /reference con el documento embebido', async () => {
    const response = await request(app).get('/reference').expect(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Vankoo Notification Service');
  });

  it('responde 404 en problem+json', async () => {
    const response = await request(app).get('/no-existe').expect(404);
    expect(response.body).toMatchObject({
      type: 'about:blank',
      status: 404,
      instance: '/no-existe',
    });
  });
});
