import type { Messaging } from 'firebase-admin/messaging';
import type { Kafka } from 'kafkajs';
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { DeviceCommandServiceImpl } from './devices/application/internal/commandservices/device-command.service.impl';
import type { IDeviceCommandService } from './devices/domain/services/device-command.service';
import type { IPushSubscriptionGateway } from './devices/domain/services/push-subscription-gateway';
import { FirebasePushSubscriptionGateway } from './devices/infrastructure/push/firebase-push-subscription.gateway';
import { LoggingPushSubscriptionGateway } from './devices/infrastructure/push/logging-push-subscription.gateway';
import { registerDeviceRegistrationsOpenApi } from './devices/interfaces/rest/device-registrations.router';
import { NotificationCommandServiceImpl } from './notifications/application/internal/commandservices/notification-command.service.impl';
import { ExternalProfileService } from './notifications/application/internal/outboundservices/acl/external-profile.service';
import { NotificationQueryServiceImpl } from './notifications/application/internal/queryservices/notification-query.service.impl';
import type { IEmailSender } from './notifications/domain/services/email-sender';
import type { INotificationCommandService } from './notifications/domain/services/notification-command.service';
import type { INotificationQueryService } from './notifications/domain/services/notification-query.service';
import type { IPushNotificationSender } from './notifications/domain/services/push-notification-sender';
import { HttpProfileContactClient } from './notifications/infrastructure/acl/http-profile-contact.client';
import { LoggingEmailSender } from './notifications/infrastructure/email/logging-email.sender';
import { SmtpEmailSender } from './notifications/infrastructure/email/smtp-email.sender';
import { InMemoryProcessedEventRegistry } from './notifications/infrastructure/idempotency/in-memory-processed-event.registry';
import { FirebasePushNotificationSender } from './notifications/infrastructure/push/firebase-push-notification.sender';
import { LoggingPushNotificationSender } from './notifications/infrastructure/push/logging-push-notification.sender';
import { InMemoryNotificationTemplateCatalog } from './notifications/infrastructure/templates/in-memory-notification-template.catalog';
import { AuctionLifecycleSubscriber } from './notifications/interfaces/events/auction-lifecycle.subscriber';
import { CompanyVerificationsSubscriber } from './notifications/interfaces/events/company-verifications.subscriber';
import { FinanceEventsSubscriber } from './notifications/interfaces/events/finance-events.subscriber';
import { GreenCertificationsSubscriber } from './notifications/interfaces/events/green-certifications.subscriber';
import { IamEventsSubscriber } from './notifications/interfaces/events/iam-events.subscriber';
import { InvoicingEventsSubscriber } from './notifications/interfaces/events/invoicing-events.subscriber';
import { ProfileEventsSubscriber } from './notifications/interfaces/events/profile-events.subscriber';
import { registerNotificationTypesOpenApi } from './notifications/interfaces/rest/notification-types.router';
import type { AppConfig } from './shared/infrastructure/config/env.config';
import { EurekaClientService } from './shared/infrastructure/discovery/eureka-client.service';
import { createFirebaseMessaging } from './shared/infrastructure/firebase/firebase-messaging.factory';
import { PushTopicNaming } from './shared/infrastructure/firebase/push-topic-naming';
import type { Logger } from './shared/infrastructure/logging/logger';
import { KafkaConsumerRunner } from './shared/infrastructure/messaging/kafka-consumer.runner';
import { createKafka } from './shared/infrastructure/messaging/kafka.factory';
import type { IntegrationEventSubscriber } from './shared/interfaces/events/integration-event-subscriber';
import {
  type OpenApiDocument,
  createOpenApiDocument,
} from './shared/interfaces/rest/documentation/openapi-document.factory';
import { registerHealthOpenApi } from './shared/interfaces/rest/health/health.router';
import type { ReadinessCheck } from './shared/interfaces/rest/health/health.router';

/** Nombre con el que el servicio se registra en Eureka y lo rutea el gateway. */
export const SERVICE_NAME = 'notification-service';
export const SERVICE_VERSION = '1.0.0';

/**
 * @author LiquiLabs
 * @summary Fábricas de los clientes externos; los tests las reemplazan por dobles.
 */
export interface ExternalClientFactories {
  firebaseMessaging: (config: AppConfig['push']['firebase']) => Messaging;
  smtpTransport: (config: AppConfig['email']) => Transporter;
  kafka: (config: AppConfig['kafka']) => Kafka;
  fetch: typeof fetch;
}

const defaultFactories: ExternalClientFactories = {
  firebaseMessaging: createFirebaseMessaging,
  smtpTransport: (config) =>
    createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth:
        config.user && config.password
          ? { user: config.user, pass: config.password }
          : undefined,
    }),
  kafka: createKafka,
  fetch: (input, init) => fetch(input, init),
};

/** @author LiquiLabs */
export interface Container {
  deviceCommandService: IDeviceCommandService;
  notificationCommandService: INotificationCommandService;
  notificationQueryService: INotificationQueryService;
  subscribers: IntegrationEventSubscriber[];
  kafkaRunner: KafkaConsumerRunner | null;
  eureka: EurekaClientService | null;
  readinessChecks: ReadinessCheck[];
  openApiDocument: OpenApiDocument;
}

/**
 * @author LiquiLabs
 * @summary Composition root: crea cada pieza y le inyecta sus dependencias por constructor.
 *
 * Aquí, y solo aquí, se elige cada adaptador según la configuración: logging o Firebase
 * para el push, logging o SMTP para el email, Eureka o una URL fija para Profile, y si se
 * consume Kafka o no.
 */
export function buildContainer(
  config: AppConfig,
  logger: Logger,
  factories: Partial<ExternalClientFactories> = {},
): Container {
  const clients = { ...defaultFactories, ...factories };

  const eureka = config.eureka.enabled
    ? new EurekaClientService(
        {
          appName: SERVICE_NAME,
          instanceHostname: config.instanceHostname,
          port: config.port,
          eurekaHost: config.eureka.host,
          eurekaPort: config.eureka.port,
        },
        logger,
      )
    : null;

  // --- Push (compartido por devices y notifications) ---
  let pushSubscriptionGateway: IPushSubscriptionGateway;
  let pushSender: IPushNotificationSender;
  if (config.push.provider === 'firebase') {
    const messaging = clients.firebaseMessaging(config.push.firebase);
    const topicNaming = new PushTopicNaming(config.push.topicSecret);
    pushSubscriptionGateway = new FirebasePushSubscriptionGateway(
      messaging,
      topicNaming,
      logger,
    );
    pushSender = new FirebasePushNotificationSender(messaging, topicNaming);
  } else {
    pushSubscriptionGateway = new LoggingPushSubscriptionGateway(logger);
    pushSender = new LoggingPushNotificationSender(logger);
  }

  // --- Email ---
  const emailSender: IEmailSender =
    config.email.provider === 'smtp'
      ? new SmtpEmailSender(
          clients.smtpTransport(config.email),
          config.email.from,
        )
      : new LoggingEmailSender(logger);

  // --- ACL hacia Profile Service ---
  const { url: profileUrl, appId: profileAppId } = config.profileService;
  const profileContactClient = new HttpProfileContactClient(
    () => profileUrl ?? eureka?.resolveServiceUrl(profileAppId) ?? null,
    config.profileService.timeoutMs,
    clients.fetch,
  );

  // --- Bounded context: devices ---
  const deviceCommandService = new DeviceCommandServiceImpl(
    pushSubscriptionGateway,
  );

  // --- Bounded context: notifications ---
  const templateCatalog = new InMemoryNotificationTemplateCatalog(
    config.webAppUrl,
  );
  const notificationCommandService = new NotificationCommandServiceImpl(
    templateCatalog,
    new ExternalProfileService(profileContactClient),
    pushSender,
    emailSender,
    new InMemoryProcessedEventRegistry(
      config.idempotency.cacheSize,
      config.idempotency.ttlMs,
    ),
    logger,
  );
  const notificationQueryService = new NotificationQueryServiceImpl(
    templateCatalog,
  );

  const subscribers: IntegrationEventSubscriber[] = [
    new IamEventsSubscriber(notificationCommandService, logger),
    new ProfileEventsSubscriber(notificationCommandService, logger),
    new CompanyVerificationsSubscriber(notificationCommandService, logger),
    new GreenCertificationsSubscriber(notificationCommandService, logger),
    new InvoicingEventsSubscriber(notificationCommandService, logger),
    new AuctionLifecycleSubscriber(notificationCommandService, logger),
    new FinanceEventsSubscriber(notificationCommandService, logger),
  ];

  const kafkaRunner = config.kafka.enabled
    ? new KafkaConsumerRunner(
        clients.kafka(config.kafka),
        subscribers,
        {
          groupId: config.kafka.groupId,
          fromBeginning: config.kafka.fromBeginning,
          dlqTopic: config.kafka.dlqTopic,
          maxRetries: config.kafka.maxRetries,
          retryBaseDelayMs: config.kafka.retryBaseDelayMs,
        },
        logger,
      )
    : null;

  const readinessChecks: ReadinessCheck[] = kafkaRunner
    ? [{ name: 'kafka', isReady: () => kafkaRunner.isReady() }]
    : [];

  return {
    deviceCommandService,
    notificationCommandService,
    notificationQueryService,
    subscribers,
    kafkaRunner,
    eureka,
    readinessChecks,
    openApiDocument: createOpenApiDocument(
      [
        registerDeviceRegistrationsOpenApi,
        registerNotificationTypesOpenApi,
        registerHealthOpenApi,
      ],
      SERVICE_VERSION,
    ),
  };
}
