# Vankoo: Notification Service

Microservicio que avisa a los usuarios de Vankoo de lo que pasa en la plataforma. Escucha los eventos de Kafka de los demás servicios y envía:

- **push** al mobile del inversionista con **Firebase Cloud Messaging (FCM)**;
- **email** a la Mype (el web no tiene FCM en el C4) y al inversionista cuando el evento trae su dirección.

Además expone una API para que la app móvil registre sus dispositivos. **No tiene base de datos**: Firebase guarda qué dispositivos tiene cada usuario y el email de la Mype se le pide a Profile Service.

Stack: Node.js 24, TypeScript, Express 5, kafkajs, firebase-admin, nodemailer, eureka-js-client, zod y Scalar.

## Requisitos Previos

- Node.js 24 (`.nvmrc`)
- pnpm 10.30.2 (`corepack enable` lo toma de `packageManager`)
- Para levantar todo el ecosistema: Docker y el repositorio `vankoo-infra` en la misma carpeta que este

## Configuración del Entorno

```bash
corepack enable
pnpm install
cp .env.example .env
```

### Variables de Entorno

Todas se validan al arrancar ([env.config.ts](src/shared/infrastructure/config/env.config.ts)). Si una falta o no tiene el formato esperado, el servicio no arranca y dice cuál es.

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | `3001` | Puerto HTTP |
| `NODE_ENV` | `development` | En `production` se exige un `PUSH_TOPIC_SECRET` propio |
| `LOG_LEVEL` | `info` | Nivel de pino |
| `INSTANCE_HOSTNAME` | `localhost` | Host con el que se registra en Eureka |
| `WEB_APP_URL` | `http://localhost:5173` | Web de la Mype: a donde llevan los botones de los emails |
| `EUREKA_ENABLED` / `EUREKA_HOST` / `EUREKA_PORT` | `true` / `localhost` / `8761` | Discovery Server |
| `KAFKA_ENABLED` | `true` | Consumir eventos |
| `KAFKA_BROKERS` | `localhost:9092` | Brokers separados por coma (en Docker, `kafka-broker:9094`) |
| `KAFKA_GROUP_ID` | `notification-delivery-v1` | Consumer group |
| `KAFKA_FROM_BEGINNING` | `false` | Un grupo nuevo no reenvía el histórico |
| `KAFKA_DLQ_TOPIC` | `notification.delivery.dlq` | Dónde van los mensajes que no se pudieron entregar |
| `KAFKA_MAX_RETRIES` / `KAFKA_RETRY_BASE_DELAY_MS` | `3` / `500` | Reintentos con backoff exponencial |
| `KAFKA_SSL`, `KAFKA_SASL_MECHANISM`, `KAFKA_SASL_USERNAME`, `KAFKA_SASL_PASSWORD` | — | Para un Kafka gestionado (p. ej. Azure Event Hubs) |
| `PUSH_PROVIDER` | `logging` | `logging` (escribe el push en el log) o `firebase` |
| `PUSH_TOPIC_SECRET` | secreto de desarrollo | Deriva el topic de FCM de cada usuario |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | — | Cuenta de servicio (o `GOOGLE_APPLICATION_CREDENTIALS`) |
| `EMAIL_PROVIDER` | `logging` | `logging` o `smtp` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | Mailpit local | Servidor SMTP |
| `PROFILE_SERVICE_URL` | — | Si está, se usa en vez de buscar Profile en Eureka |
| `PROFILE_SERVICE_APP_ID` / `PROFILE_SERVICE_TIMEOUT_MS` | `profile-service` / `3000` | ACL hacia Profile |
| `IDEMPOTENCY_CACHE_SIZE` / `IDEMPOTENCY_TTL_MS` | `10000` / 24 h | Memoria de eventos ya notificados |

### Local vs. desplegado

| | Local (`pnpm start:dev` o Docker) | Desplegado (Azure Container Apps) |
|---|---|---|
| Push | `PUSH_PROVIDER=logging`: FCM no tiene emulador | `firebase` + cuenta de servicio en secretos |
| Email | Mailpit (`smtp`, `mailpit:1025`), UI en http://localhost:8025 | Proveedor SMTP real (Azure Communication Services, SendGrid…) |
| Eureka | `EUREKA_ENABLED=true` | `false`: los servicios se llaman por el DNS del entorno |
| Profile | Se resuelve en Eureka | `PROFILE_SERVICE_URL=http://vankoo-profile-service` |
| Kafka | `kafka-broker:9094`, PLAINTEXT | `KAFKA_SSL=true` + SASL, o `KAFKA_ENABLED=false` hasta la fase 2 |
| Secreto de topics | El de desarrollo | Uno propio (obligatorio con `NODE_ENV=production`) |

## Ejecución del Proyecto

### Desarrollo

Con Kafka y Eureka del `docker-compose` de `vankoo-infra` levantados:

```bash
pnpm start:dev
```

Sin Kafka ni Eureka (solo la API REST):

```bash
KAFKA_ENABLED=false EUREKA_ENABLED=false pnpm start:dev
```

### Producción

```bash
pnpm build
pnpm start
```

### Docker

El servicio está en el `docker-compose.yaml` de `vankoo-infra`:

```bash
docker compose up -d --build notification-service
```

## Pruebas (Testing)

Unit tests con **Jest + ts-jest** y **supertest** para las rutas. Cada spec está junto al archivo que prueba. Los eventos de ejemplo de [upstream-events.ts](src/test-support/fixtures/upstream-events.ts) están copiados de los contratos de cada servicio.

```bash
pnpm test        # todos
pnpm test:cov    # con cobertura (mínimo 80% o falla)
pnpm lint
```

## Documentación de la API (Scalar)

- Directo: http://localhost:3001/reference (OpenAPI en `/openapi/v1.json`)
- Por el gateway: http://localhost:8080/scalar, en "Notification Service"

El documento se genera a partir de los mismos schemas de zod que validan las peticiones, así que no se desfasa del código.

| Método | Ruta (en el gateway, con prefijo `/notification`) | Descripción |
|---|---|---|
| `POST` | `/api/v1/device-registrations` | Registra el token de FCM del usuario autenticado. Cuerpo: `{ deviceToken, platform: ANDROID \| IOS }` → `201` |
| `DELETE` | `/api/v1/device-registrations/{deviceToken}` | Da de baja el dispositivo (al cerrar sesión) → `204` |
| `GET` | `/api/v1/notification-types` | Catálogo de notificaciones: tipo, destinatario, canales y evento de origen |
| `GET` | `/health/live`, `/health/ready` | Probes. `ready` responde `503` hasta que el consumidor de Kafka entra al grupo |

Las rutas `/api/v1/**` exigen el JWT en el gateway, que reenvía el usuario en `X-User-Id`. Los errores se responden como `application/problem+json`.

## Arquitectura del Microservicio

DDD con dos bounded contexts, cada uno en capas `domain`, `application`, `infrastructure` e `interfaces`, más `shared/` con lo transversal. `shared/` no es una librería compartida con otros microservicios: es lo común a los dos contextos de este servicio (config, logger, Kafka, Eureka, Firebase, middlewares, health y OpenAPI), igual que `shared/` en Risk e Invoicing.

```
src/
├── main.ts                      # arranque: config → contenedor → HTTP, Kafka, Eureka
├── app.ts                       # aplicación Express (sin efectos: la usan los tests)
├── container.ts                 # composition root: elige adaptadores e inyecta por constructor
├── shared/
│   ├── domain/model/            # DomainError
│   ├── application/errors/      # ExternalServiceError
│   ├── infrastructure/          # config (zod), logging (pino), messaging (kafkajs + DLQ),
│   │                            # discovery (Eureka), firebase (app + topics por usuario)
│   └── interfaces/              # contrato de subscribers, middlewares, health, OpenAPI/Scalar
├── devices/                     # BC Device Registration
│   ├── domain/                  # DeviceRegistration, DeviceToken, comandos, puertos
│   ├── application/internal/commandservices/
│   ├── infrastructure/push/     # Firebase (subscribeToTopic) y logging
│   └── interfaces/rest/         # router, resources (zod) y transform (assemblers)
└── notifications/               # BC Notification Delivery
    ├── domain/                  # Notification (entrega por canal), VOs, comandos, queries, puertos
    ├── application/internal/
    │   ├── commandservices/     # dedup → plantilla → email (ACL) → envío por canal
    │   ├── queryservices/       # catálogo de tipos (lado query de CQRS)
    │   └── outboundservices/acl/  # ACL hacia Profile Service
    ├── infrastructure/          # push (FCM), email (SMTP), plantillas, idempotencia, cliente HTTP de Profile
    └── interfaces/
        ├── acl/                 # ACL de entrada: normalizador de envelopes + contratos (zod) de cada servicio
        ├── events/              # un subscriber por topic + transform (evento → comando)
        └── rest/                # catálogo de tipos
```

Patrones aplicados:

- **CQRS**: los comandos (`SendNotification`, `RegisterDevice`, `UnregisterDevice`) van por los command services. El catálogo de tipos va por el query service.
- **Anti-Corruption Layer**:
  - de entrada, [integration-event-envelope.normalizer.ts](src/notifications/interfaces/acl/integration-event-envelope.normalizer.ts) unifica los tres formatos de evento de Vankoo, y cada contrato de zod valida solo lo que se usa;
  - de salida, [external-profile.service.ts](src/notifications/application/internal/outboundservices/acl/external-profile.service.ts) traduce la empresa de Profile a un `EmailAddress`.
- **Assembler**: clases estáticas `<Destino>From<Origen>Assembler` en cada `transform/`, de resource a comando, de entidad a resource y de evento a comando.
- **Puertos y adaptadores**: el dominio define `IPushNotificationSender`, `IEmailSender`, `IRecipientDirectory`, etc. `container.ts` elige la implementación según el entorno.

### Push sin base de datos: un topic de FCM por usuario

1. Al iniciar sesión, la app obtiene su token de FCM y llama `POST /notification/api/v1/device-registrations`.
2. El servicio suscribe ese token al topic `user_<HMAC-SHA256(userId, PUSH_TOPIC_SECRET)>`. Firebase recuerda qué dispositivos hay en cada topic.
3. Para notificar, se envía al topic del usuario y Firebase lo reparte a todos sus dispositivos.
4. Al cerrar sesión, `DELETE …/device-registrations/{deviceToken}` lo saca del topic.

El HMAC hace que nadie pueda adivinar el topic de otro usuario a partir de su id. **Cambiar `PUSH_TOPIC_SECRET` deja a todos los dispositivos fuera de su topic**: tendrían que volver a registrarse.

### Eventos que se notifican

Consumer group `notification-delivery-v1`.

| Topic | Evento | Notificación | Para | Canal |
|---|---|---|---|---|
| `vankoo.iam.events` | `UserCreatedEvent` (Mype o inversionista) | `USER_WELCOME` | Usuario nuevo | Email (viene en el evento) |
| `vankoo.profile.events` | `KycVerified` / `KycRejected` (`profileType=INVESTOR`) | `INVESTOR_KYC_*` | Inversionista | Push + email (viene en el evento) |
| `vankoo.profile.events` | `CompanyKycStatusChanged` v1 (`VERIFIED` / `REJECTED`) | `COMPANY_KYC_*` | Mype | Email (ACL Profile) |
| `risk.company-verifications.v1` | `CompanyVerificationIssued` (`CORRECTION_REQUIRED`) | `COMPANY_VERIFICATION_CORRECTION_REQUIRED` | Mype | Email (ACL Profile) |
| `risk.green-certifications.v1` | `GreenCertificationIssued` | `GREEN_CERTIFICATION_GRANTED` / `_DENIED` | Mype | Email (ACL Profile) |
| `invoicing.invoice-eligible-for-funding` | `InvoiceEligibleForFunding` | `INVOICE_RECEIVED` | Mype | Email (ACL Profile) |
| `investment.auction-lifecycle.v1` | `AuctionRejected` / `AuctionPublished` | `INVOICE_REJECTED` / `AUCTION_PUBLISHED` | Mype | Email (ACL Profile) |
| `vankoo.finance.events.v1` | `DepositSucceeded/Failed/CancelledEvent` (tipo en la cabecera `event-type`) | `DEPOSIT_*` | Inversionista | Push |

Para no avisar dos veces lo mismo, la decisión KYC de una empresa se notifica solo con `CompanyKycStatusChanged`: no con el `KycVerified` legacy ni con el `VERIFIED`/`REJECTED` de Risk.

### Fallos, reintentos e idempotencia

- **Mensaje que no cumple el contrato**: se registra un `warn` y se ignora. Reintentarlo no lo arreglaría.
- **Fallo de entrega** (FCM, SMTP o Profile caídos): 3 reintentos con backoff de 500 ms, 1 s y 2 s. Después el mensaje va a `notification.delivery.dlq` con las cabeceras `x-original-topic`, `x-original-partition`, `x-original-offset` y `x-error`, y la partición sigue avanzando.
- **Idempotencia**: cada canal entregado se recuerda como `<eventId>#<canal>`. Si el push salió y el email falló, el reintento solo repite el email. Para los eventos sin `eventId` (IAM y KYC legacy de Profile) se usa una clave de negocio.

### Limitaciones conocidas

- **La idempotencia es en memoria**: tras un reinicio, un evento que se vuelva a leer puede notificarse otra vez. Kafka entrega al menos una vez y el grupo confirma offsets, así que solo pasa con mensajes que estaban en vuelo.
- **No se notifica a los inversionistas sobre subastas** (`PartitionAdded`, `AuctionFullyFunded`, `AuctionExpired`, `AuctionCancelled`, `AuctionClosed`): Investment no publica sus `investorId`. Haría falta que los publique o consultarlo por REST.
- **Sin historial in-app ni preferencias por usuario** (la campanita del web): requieren base de datos.
- **Sin push web ni SMS**. Twilio sería el proveedor de SMS/WhatsApp, pero ningún evento trae el teléfono del usuario.
- Las cabeceras `X-User-Id` se confían porque el ingress es interno: el servicio no debe exponerse fuera del gateway.

### Cambios sugeridos al C4

```
notification -> profile "Resuelve el email del destinatario (ACL)" "HTTP"
notification -> broker "Publica los mensajes fallidos en la DLQ"
email = softwareSystem "Proveedor SMTP" "Envío de emails" "smtp"
notification -> email "Envía emails" "SMTP"
```

## Despliegue (preparado, fuera de alcance)

La imagen y la configuración ya están listas: `Dockerfile` de dos etapas (usuario `node`, `HEALTHCHECK`), probes `/health/live` y `/health/ready`, y la configuración por variables de entorno. Para desplegar en Azure Container Apps, siguiendo el checklist de `vankoo-infra/terraform/README.md`:

1. **Container App** en `terraform/apps/main.tf`:
   - `vankoo-notification-service`, ingress interno en el puerto `3001`.
   - Probes: `startup` y `readiness` en `/health/ready`, `liveness` en `/health/live`.
   - `lifecycle { ignore_changes = [template[0].container[0].image] }`.
2. **Secretos**: `PUSH_TOPIC_SECRET`, `FIREBASE_*`, `SMTP_*`.
3. **Variables**:
   - `NODE_ENV=production`, `EUREKA_ENABLED=false`, `PUSH_PROVIDER=firebase`, `EMAIL_PROVIDER=smtp`.
   - `PROFILE_SERVICE_URL=http://vankoo-profile-service`, `WEB_APP_URL=<URL del web>`.
   - Kafka: `KAFKA_ENABLED=false` hasta la fase 2, o los `KAFKA_SASL_*` de Event Hubs.
4. **Gateway**: `NOTIFICATION_SERVICE_URI` en su Container App y la ruta en `application-azure.yaml`. Ese perfil todavía no existe en el gateway.
5. **Imagen**: `"notification-service|vankoo-notification-service|Dockerfile"` en `SERVICES` de `scripts/azure/build-push.sh`.
6. **CI**: credenciales OIDC de `vankoo-github-ci` para este repo y descomentar el job `deliver` de [ci.yml](.github/workflows/ci.yml).

## Estándares de Código / Estilo

- Código y nombres en inglés; comentarios y documentación en español; autor `@author LiquiLabs` en cada clase.
- Archivos en kebab-case con el sufijo del tipo: `.aggregate.ts`, `.vo.ts`, `.command.ts`, `.query.ts`, `.service.ts`, `.service.impl.ts`, `.resource.ts`, `.assembler.ts`, `.subscriber.ts`, `.router.ts`, `.contract.ts`.
- Puertos como interfaces con prefijo `I`. Implementaciones con sufijo `Impl`.
- Prettier (`singleQuote`, `trailingComma: all`) y ESLint con `typescript-eslint` (reglas con tipos).
- Commits con Conventional Commits: `feat(notifications): …`.
