import { Partitioners } from 'kafkajs';
import type {
  Consumer,
  EachMessagePayload,
  IHeaders,
  Kafka,
  KafkaMessage,
  Producer,
} from 'kafkajs';
import type { Logger } from '../logging/logger';
import type {
  IntegrationEventSubscriber,
  IntegrationMessage,
} from '../../interfaces/events/integration-event-subscriber';

/** @author LiquiLabs */
export interface KafkaConsumerRunnerOptions {
  groupId: string;
  fromBeginning: boolean;
  dlqTopic: string;
  maxRetries: number;
  retryBaseDelayMs: number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * @author LiquiLabs
 * @summary Consume los topics de los subscribers, reintenta con backoff y manda a la DLQ lo que no se pudo entregar.
 *
 * Cada mensaje se reintenta `maxRetries` veces (500 ms, 1 s, 2 s… por defecto). Si sigue
 * fallando se publica en `dlqTopic` con las cabeceras `x-original-*` y `x-error`, igual
 * que hace Invoicing, y el offset avanza para no bloquear la partición.
 */
export class KafkaConsumerRunner {
  private readonly consumer: Consumer;
  private readonly producer: Producer;
  private readonly subscribersByTopic = new Map<
    string,
    IntegrationEventSubscriber
  >();
  private ready = false;

  constructor(
    private readonly kafka: Kafka,
    subscribers: IntegrationEventSubscriber[],
    private readonly options: KafkaConsumerRunnerOptions,
    private readonly logger: Logger,
    private readonly sleep: (ms: number) => Promise<void> = defaultSleep,
  ) {
    for (const subscriber of subscribers) {
      if (this.subscribersByTopic.has(subscriber.topic)) {
        throw new Error(`Hay dos subscribers para ${subscriber.topic}`);
      }
      this.subscribersByTopic.set(subscriber.topic, subscriber);
    }
    this.consumer = kafka.consumer({ groupId: options.groupId });
    // Particionador por defecto de kafkajs 2 (murmur2, como el cliente Java); fijarlo
    // explícito evita su aviso de migración en cada arranque.
    this.producer = kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
    });
    this.consumer.on(this.consumer.events.GROUP_JOIN, () => {
      this.ready = true;
    });
    this.consumer.on(this.consumer.events.CRASH, (event) => {
      this.ready = false;
      this.logger.error(
        { error: event.payload.error.message },
        'El consumidor de Kafka se cayó; kafkajs lo reinicia',
      );
    });
    this.consumer.on(this.consumer.events.DISCONNECT, () => {
      this.ready = false;
    });
  }

  /** Para /health/ready: el consumidor ya entró al grupo y recibe mensajes. */
  isReady(): boolean {
    return this.ready;
  }

  async start(): Promise<void> {
    await this.ensureTopics();
    await this.producer.connect();
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [...this.subscribersByTopic.keys()],
      fromBeginning: this.options.fromBeginning,
    });
    await this.consumer.run({
      eachMessage: (payload) => this.process(payload),
    });
    this.logger.info(
      { topics: [...this.subscribersByTopic.keys()] },
      'Consumiendo eventos de Kafka',
    );
  }

  async stop(): Promise<void> {
    this.ready = false;
    await this.consumer.disconnect();
    await this.producer.disconnect();
  }

  /**
   * kafkajs no puede suscribirse a un tópico que no existe, y un tópico de Vankoo
   * existe recién cuando su productor publica el primer evento (o, como Investment,
   * puede tener la creación automática apagada). Se crean los que falten, más la DLQ,
   * con la configuración por defecto del broker. Si el broker no lo permite (un Kafka
   * gestionado sin permisos de admin), se avisa y se intenta igual.
   */
  private async ensureTopics(): Promise<void> {
    const admin = this.kafka.admin();
    const wanted = [...this.subscribersByTopic.keys(), this.options.dlqTopic];
    try {
      await admin.connect();
      const existing = new Set(await admin.listTopics());
      const missing = wanted.filter((topic) => !existing.has(topic));
      if (missing.length > 0) {
        await admin.createTopics({
          topics: missing.map((topic) => ({ topic })),
          waitForLeaders: true,
        });
        this.logger.info({ topics: missing }, 'Tópicos de Kafka creados');
      }
    } catch (error) {
      this.logger.warn(
        { error: (error as Error).message },
        'No se pudieron crear los tópicos que faltan',
      );
    } finally {
      await admin.disconnect();
    }
  }

  async process({
    topic,
    partition,
    message,
  }: EachMessagePayload): Promise<void> {
    const subscriber = this.subscribersByTopic.get(topic);
    if (!subscriber) return;

    let integrationMessage: IntegrationMessage;
    try {
      integrationMessage = this.read(topic, partition, message);
    } catch (error) {
      await this.sendToDlq(topic, partition, message, error);
      return;
    }

    for (let attempt = 0; ; attempt++) {
      try {
        await subscriber.handle(integrationMessage);
        return;
      } catch (error) {
        if (attempt >= this.options.maxRetries) {
          await this.sendToDlq(topic, partition, message, error);
          return;
        }
        const delay = this.options.retryBaseDelayMs * 2 ** attempt;
        this.logger.warn(
          {
            topic,
            offset: message.offset,
            attempt: attempt + 1,
            error: (error as Error).message,
          },
          `Fallo al procesar el mensaje; se reintenta en ${delay} ms`,
        );
        await this.sleep(delay);
      }
    }
  }

  private read(
    topic: string,
    partition: number,
    message: KafkaMessage,
  ): IntegrationMessage {
    const text = message.value?.toString('utf8') ?? '';
    let value: unknown;
    try {
      value = text === '' ? null : JSON.parse(text);
    } catch {
      throw new Error('El valor del mensaje no es JSON');
    }
    return {
      topic,
      partition,
      offset: message.offset,
      key: message.key?.toString('utf8') ?? null,
      value,
      headers: KafkaConsumerRunner.readHeaders(message.headers),
    };
  }

  /**
   * Spring Cloud Stream (IAM, Finance) puede escribir las cabeceras de texto como JSON,
   * con comillas: `"DepositSucceededEvent"`. Aquí se quitan para que todos lean igual.
   */
  static readHeaders(headers: IHeaders | undefined): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [name, raw] of Object.entries(headers ?? {})) {
      const first = Array.isArray(raw) ? raw[0] : raw;
      if (first === undefined) continue;
      let value = first.toString();
      if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        try {
          value = String(JSON.parse(value));
        } catch {
          // No era JSON: se deja tal cual.
        }
      }
      result[name.toLowerCase()] = value;
    }
    return result;
  }

  private async sendToDlq(
    topic: string,
    partition: number,
    message: KafkaMessage,
    error: unknown,
  ): Promise<void> {
    const reason = error instanceof Error ? error.message : String(error);
    this.logger.error(
      { topic, offset: message.offset, error: reason },
      `Mensaje enviado a ${this.options.dlqTopic}`,
    );
    // Si la DLQ también falla, se lanza: kafkajs no confirma el offset y lo reintenta.
    await this.producer.send({
      topic: this.options.dlqTopic,
      messages: [
        {
          key: message.key,
          value: message.value,
          headers: {
            ...message.headers,
            'x-original-topic': topic,
            'x-original-partition': String(partition),
            'x-original-offset': message.offset,
            'x-error': reason,
          },
        },
      ],
    });
  }
}
