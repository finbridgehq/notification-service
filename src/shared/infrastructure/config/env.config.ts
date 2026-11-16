import { z } from 'zod';

/** Secreto de desarrollo para los topics de FCM. En producción se exige uno propio. */
export const DEVELOPMENT_PUSH_TOPIC_SECRET = 'vankoo-local-push-topic-secret';

/** Las variables de entorno llegan como texto: "true"/"false" se convierte a booleano. */
const flag = (defaultValue: boolean) =>
  z
    .enum(['true', 'false'])
    .default(defaultValue ? 'true' : 'false')
    .transform((value) => value === 'true');

const optionalText = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== '' ? value : undefined));

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    INSTANCE_HOSTNAME: z.string().min(1).default('localhost'),
    WEB_APP_URL: z.url().default('http://localhost:5173'),

    EUREKA_ENABLED: flag(true),
    EUREKA_HOST: z.string().min(1).default('localhost'),
    EUREKA_PORT: z.coerce.number().int().positive().default(8761),

    KAFKA_ENABLED: flag(true),
    KAFKA_BROKERS: z.string().min(1).default('localhost:9092'),
    KAFKA_CLIENT_ID: z.string().min(1).default('notification-service'),
    KAFKA_GROUP_ID: z.string().min(1).default('notification-delivery-v1'),
    KAFKA_FROM_BEGINNING: flag(false),
    KAFKA_SSL: flag(false),
    KAFKA_SASL_MECHANISM: z
      .enum(['plain', 'scram-sha-256', 'scram-sha-512'])
      .optional(),
    KAFKA_SASL_USERNAME: optionalText,
    KAFKA_SASL_PASSWORD: optionalText,
    KAFKA_DLQ_TOPIC: z.string().min(1).default('notification.delivery.dlq'),
    KAFKA_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
    KAFKA_RETRY_BASE_DELAY_MS: z.coerce.number().int().min(0).default(500),

    PUSH_PROVIDER: z.enum(['logging', 'firebase']).default('logging'),
    PUSH_TOPIC_SECRET: z
      .string()
      .min(16)
      .default(DEVELOPMENT_PUSH_TOPIC_SECRET),
    FIREBASE_PROJECT_ID: optionalText,
    FIREBASE_CLIENT_EMAIL: optionalText,
    FIREBASE_PRIVATE_KEY: optionalText,

    EMAIL_PROVIDER: z.enum(['logging', 'smtp']).default('logging'),
    SMTP_HOST: z.string().min(1).default('localhost'),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_SECURE: flag(false),
    SMTP_USER: optionalText,
    SMTP_PASSWORD: optionalText,
    MAIL_FROM: z.string().min(1).default('Vankoo <no-reply@vankoo.local>'),

    PROFILE_SERVICE_URL: z.url().optional(),
    PROFILE_SERVICE_APP_ID: z.string().min(1).default('profile-service'),
    PROFILE_SERVICE_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(3000),

    IDEMPOTENCY_CACHE_SIZE: z.coerce.number().int().positive().default(10000),
    IDEMPOTENCY_TTL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(24 * 60 * 60 * 1000),
  })
  .superRefine((env, ctx) => {
    if (
      env.NODE_ENV === 'production' &&
      env.PUSH_TOPIC_SECRET === DEVELOPMENT_PUSH_TOPIC_SECRET
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['PUSH_TOPIC_SECRET'],
        message: 'En producción hace falta un secreto propio',
      });
    }
    if (env.KAFKA_SASL_MECHANISM && !env.KAFKA_SASL_USERNAME) {
      ctx.addIssue({
        code: 'custom',
        path: ['KAFKA_SASL_USERNAME'],
        message: 'Es obligatorio si se define KAFKA_SASL_MECHANISM',
      });
    }
    if (env.KAFKA_SASL_MECHANISM && !env.KAFKA_SASL_PASSWORD) {
      ctx.addIssue({
        code: 'custom',
        path: ['KAFKA_SASL_PASSWORD'],
        message: 'Es obligatorio si se define KAFKA_SASL_MECHANISM',
      });
    }
    const firebaseKeys = [
      env.FIREBASE_PROJECT_ID,
      env.FIREBASE_CLIENT_EMAIL,
      env.FIREBASE_PRIVATE_KEY,
    ];
    const definedFirebaseKeys = firebaseKeys.filter(Boolean).length;
    if (definedFirebaseKeys > 0 && definedFirebaseKeys < firebaseKeys.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['FIREBASE_PROJECT_ID'],
        message:
          'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY van juntas (o ninguna, para usar GOOGLE_APPLICATION_CREDENTIALS)',
      });
    }
  });

/**
 * @author LiquiLabs
 * @summary Configuración del servicio ya validada y agrupada por responsabilidad.
 */
export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  logLevel: string;
  instanceHostname: string;
  webAppUrl: string;
  eureka: { enabled: boolean; host: string; port: number };
  kafka: {
    enabled: boolean;
    brokers: string[];
    clientId: string;
    groupId: string;
    fromBeginning: boolean;
    ssl: boolean;
    sasl?: {
      mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
      username: string;
      password: string;
    };
    dlqTopic: string;
    maxRetries: number;
    retryBaseDelayMs: number;
  };
  push: {
    provider: 'logging' | 'firebase';
    topicSecret: string;
    firebase?: { projectId: string; clientEmail: string; privateKey: string };
  };
  email: {
    provider: 'logging' | 'smtp';
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    from: string;
  };
  profileService: { url?: string; appId: string; timeoutMs: number };
  idempotency: { cacheSize: number; ttlMs: number };
}

/**
 * @author LiquiLabs
 * @summary Lee y valida las variables de entorno. Si falta o sobra algo, el servicio no arranca.
 */
export function loadAppConfig(
  source: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuración inválida: ${details}`);
  }
  const env = result.data;
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    instanceHostname: env.INSTANCE_HOSTNAME,
    webAppUrl: env.WEB_APP_URL.replace(/\/+$/, ''),
    eureka: {
      enabled: env.EUREKA_ENABLED,
      host: env.EUREKA_HOST,
      port: env.EUREKA_PORT,
    },
    kafka: {
      enabled: env.KAFKA_ENABLED,
      brokers: env.KAFKA_BROKERS.split(',')
        .map((broker) => broker.trim())
        .filter(Boolean),
      clientId: env.KAFKA_CLIENT_ID,
      groupId: env.KAFKA_GROUP_ID,
      fromBeginning: env.KAFKA_FROM_BEGINNING,
      ssl: env.KAFKA_SSL,
      sasl:
        env.KAFKA_SASL_MECHANISM &&
        env.KAFKA_SASL_USERNAME &&
        env.KAFKA_SASL_PASSWORD
          ? {
              mechanism: env.KAFKA_SASL_MECHANISM,
              username: env.KAFKA_SASL_USERNAME,
              password: env.KAFKA_SASL_PASSWORD,
            }
          : undefined,
      dlqTopic: env.KAFKA_DLQ_TOPIC,
      maxRetries: env.KAFKA_MAX_RETRIES,
      retryBaseDelayMs: env.KAFKA_RETRY_BASE_DELAY_MS,
    },
    push: {
      provider: env.PUSH_PROVIDER,
      topicSecret: env.PUSH_TOPIC_SECRET,
      firebase:
        env.FIREBASE_PROJECT_ID &&
        env.FIREBASE_CLIENT_EMAIL &&
        env.FIREBASE_PRIVATE_KEY
          ? {
              projectId: env.FIREBASE_PROJECT_ID,
              clientEmail: env.FIREBASE_CLIENT_EMAIL,
              // En un .env o en un secreto la clave suele venir con "\n" literales.
              privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }
          : undefined,
    },
    email: {
      provider: env.EMAIL_PROVIDER,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from: env.MAIL_FROM,
    },
    profileService: {
      url: env.PROFILE_SERVICE_URL?.replace(/\/+$/, ''),
      appId: env.PROFILE_SERVICE_APP_ID,
      timeoutMs: env.PROFILE_SERVICE_TIMEOUT_MS,
    },
    idempotency: {
      cacheSize: env.IDEMPOTENCY_CACHE_SIZE,
      ttlMs: env.IDEMPOTENCY_TTL_MS,
    },
  };
}
