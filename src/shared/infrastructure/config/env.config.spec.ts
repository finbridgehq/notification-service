import { DEVELOPMENT_PUSH_TOPIC_SECRET, loadAppConfig } from './env.config';

describe('loadAppConfig', () => {
  it('sin variables usa los valores de desarrollo local', () => {
    const config = loadAppConfig({});
    expect(config).toMatchObject({
      nodeEnv: 'development',
      port: 3001,
      webAppUrl: 'http://localhost:5173',
      eureka: { enabled: true, host: 'localhost', port: 8761 },
      kafka: {
        enabled: true,
        brokers: ['localhost:9092'],
        groupId: 'notification-delivery-v1',
        fromBeginning: false,
        ssl: false,
        dlqTopic: 'notification.delivery.dlq',
        maxRetries: 3,
      },
      push: { provider: 'logging', topicSecret: DEVELOPMENT_PUSH_TOPIC_SECRET },
      email: { provider: 'logging', host: 'localhost', port: 1025 },
      profileService: { appId: 'profile-service', timeoutMs: 3000 },
    });
    expect(config.kafka.sasl).toBeUndefined();
    expect(config.push.firebase).toBeUndefined();
  });

  it('lee la configuración de un entorno desplegado', () => {
    const config = loadAppConfig({
      NODE_ENV: 'production',
      PORT: '8080',
      WEB_APP_URL: 'https://app.vankoo.pe/',
      EUREKA_ENABLED: 'false',
      KAFKA_BROKERS: 'a:9093, b:9093',
      KAFKA_SSL: 'true',
      KAFKA_SASL_MECHANISM: 'plain',
      KAFKA_SASL_USERNAME: '$ConnectionString',
      KAFKA_SASL_PASSWORD: 'secret',
      PUSH_PROVIDER: 'firebase',
      PUSH_TOPIC_SECRET: 'a-production-secret',
      FIREBASE_PROJECT_ID: 'vankoo',
      FIREBASE_CLIENT_EMAIL: 'sa@vankoo.iam.gserviceaccount.com',
      FIREBASE_PRIVATE_KEY: '-----BEGIN KEY-----\\nabc\\n-----END KEY-----',
      EMAIL_PROVIDER: 'smtp',
      SMTP_USER: 'apikey',
      SMTP_PASSWORD: 'pass',
      PROFILE_SERVICE_URL: 'http://vankoo-profile-service/',
    });
    expect(config.port).toBe(8080);
    expect(config.webAppUrl).toBe('https://app.vankoo.pe');
    expect(config.eureka.enabled).toBe(false);
    expect(config.kafka.brokers).toEqual(['a:9093', 'b:9093']);
    expect(config.kafka.sasl).toEqual({
      mechanism: 'plain',
      username: '$ConnectionString',
      password: 'secret',
    });
    expect(config.push.firebase?.privateKey).toBe(
      '-----BEGIN KEY-----\nabc\n-----END KEY-----',
    );
    expect(config.email).toMatchObject({ user: 'apikey', password: 'pass' });
    expect(config.profileService.url).toBe('http://vankoo-profile-service');
  });

  it.each([
    [
      'el secreto de desarrollo en producción',
      { NODE_ENV: 'production' },
      'PUSH_TOPIC_SECRET',
    ],
    [
      'SASL sin usuario',
      { KAFKA_SASL_MECHANISM: 'plain', KAFKA_SASL_PASSWORD: 'x' },
      'KAFKA_SASL_USERNAME',
    ],
    [
      'SASL sin contraseña',
      { KAFKA_SASL_MECHANISM: 'plain', KAFKA_SASL_USERNAME: 'x' },
      'KAFKA_SASL_PASSWORD',
    ],
    [
      'credenciales de Firebase incompletas',
      { FIREBASE_PROJECT_ID: 'vankoo' },
      'FIREBASE_PROJECT_ID',
    ],
    ['un booleano mal escrito', { KAFKA_ENABLED: 'yes' }, 'KAFKA_ENABLED'],
    ['un puerto que no es número', { PORT: 'abc' }, 'PORT'],
  ])('falla con %s', (_case, env, variable) => {
    expect(() => loadAppConfig(env)).toThrow(variable);
  });

  it('trata las variables vacías como no definidas', () => {
    const config = loadAppConfig({ SMTP_USER: '  ', SMTP_PASSWORD: '' });
    expect(config.email.user).toBeUndefined();
    expect(config.email.password).toBeUndefined();
  });
});
