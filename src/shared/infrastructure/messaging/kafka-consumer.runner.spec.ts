import type { EachMessagePayload, Kafka, KafkaMessage } from 'kafkajs';
import { silentLogger } from '../../../test-support/silent-logger';
import type { IntegrationEventSubscriber } from '../../interfaces/events/integration-event-subscriber';
import { KafkaConsumerRunner } from './kafka-consumer.runner';

const EVENTS = {
  GROUP_JOIN: 'consumer.group_join',
  CRASH: 'consumer.crash',
  DISCONNECT: 'consumer.disconnect',
};

function fakeKafka() {
  const listeners = new Map<string, (event: any) => void>();
  const consumer = {
    events: EVENTS,
    on: jest.fn((event: string, listener: (event: any) => void) => {
      listeners.set(event, listener);
    }),
    connect: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    run: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };
  const producer = {
    connect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };
  const admin = {
    connect: jest.fn().mockResolvedValue(undefined),
    listTopics: jest.fn().mockResolvedValue(['topic.a']),
    createTopics: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };
  const kafka = {
    consumer: jest.fn(() => consumer),
    producer: jest.fn(() => producer),
    admin: jest.fn(() => admin),
  } as unknown as Kafka;
  const emit = (event: string, payload: unknown = {}) =>
    listeners.get(event)?.({ payload });
  return { kafka, consumer, producer, admin, emit };
}

function subscriber(topic: string): jest.Mocked<IntegrationEventSubscriber> {
  return { topic, handle: jest.fn().mockResolvedValue(undefined) };
}

const options = {
  groupId: 'notification-delivery-v1',
  fromBeginning: false,
  dlqTopic: 'notification.delivery.dlq',
  maxRetries: 2,
  retryBaseDelayMs: 100,
};

function payload(
  topic: string,
  value: string | null,
  headers: KafkaMessage['headers'] = {},
): EachMessagePayload {
  return {
    topic,
    partition: 3,
    message: {
      key: Buffer.from('key-1'),
      value: value === null ? null : Buffer.from(value),
      headers,
      offset: '7',
      timestamp: '0',
      attributes: 0,
    },
    heartbeat: jest.fn(),
    pause: jest.fn(),
  };
}

function setUp(subscribers = [subscriber('topic.a')]) {
  const fake = fakeKafka();
  const sleep = jest.fn().mockResolvedValue(undefined);
  const runner = new KafkaConsumerRunner(
    fake.kafka,
    subscribers,
    options,
    silentLogger(),
    sleep,
  );
  return { ...fake, runner, sleep, subscribers };
}

describe('KafkaConsumerRunner', () => {
  it('se suscribe a los topics de todos los subscribers con su grupo', async () => {
    const { runner, kafka, consumer, producer } = setUp([
      subscriber('topic.a'),
      subscriber('topic.b'),
    ]);
    await runner.start();
    expect(kafka.consumer).toHaveBeenCalledWith({
      groupId: 'notification-delivery-v1',
    });
    expect(producer.connect).toHaveBeenCalled();
    expect(consumer.subscribe).toHaveBeenCalledWith({
      topics: ['topic.a', 'topic.b'],
      fromBeginning: false,
    });
    expect(consumer.run).toHaveBeenCalled();
  });

  it('crea antes los tópicos que todavía no existen, DLQ incluida', async () => {
    const { runner, admin } = setUp([
      subscriber('topic.a'),
      subscriber('topic.b'),
    ]);
    await runner.start();
    expect(admin.createTopics).toHaveBeenCalledWith({
      topics: [{ topic: 'topic.b' }, { topic: 'notification.delivery.dlq' }],
      waitForLeaders: true,
    });
    expect(admin.disconnect).toHaveBeenCalled();
  });

  it('no crea nada si los tópicos ya existen', async () => {
    const { runner, admin } = setUp();
    admin.listTopics.mockResolvedValue([
      'topic.a',
      'notification.delivery.dlq',
    ]);
    await runner.start();
    expect(admin.createTopics).not.toHaveBeenCalled();
  });

  it('se suscribe igual si el broker no deja crear tópicos', async () => {
    const { runner, admin, consumer } = setUp();
    admin.createTopics.mockRejectedValue(
      new Error('TOPIC_AUTHORIZATION_FAILED'),
    );
    await runner.start();
    expect(consumer.subscribe).toHaveBeenCalled();
    expect(admin.disconnect).toHaveBeenCalled();
  });

  it('no admite dos subscribers del mismo topic', () => {
    expect(() => setUp([subscriber('topic.a'), subscriber('topic.a')])).toThrow(
      'dos subscribers',
    );
  });

  it('entrega al subscriber el JSON, la clave y las cabeceras normalizadas', async () => {
    const { runner, subscribers } = setUp();
    await runner.process(
      payload('topic.a', '{"id":1}', {
        'Event-Type': Buffer.from('"DepositSucceededEvent"'),
        'event-id': 'abc',
        multi: [Buffer.from('first'), Buffer.from('second')],
        broken: Buffer.from('"no-json'),
        empty: undefined,
      }),
    );
    expect(subscribers[0].handle).toHaveBeenCalledWith({
      topic: 'topic.a',
      partition: 3,
      offset: '7',
      key: 'key-1',
      value: { id: 1 },
      headers: {
        'event-type': 'DepositSucceededEvent',
        'event-id': 'abc',
        multi: 'first',
        broken: '"no-json',
      },
    });
  });

  it('entrega null si el mensaje no tiene valor', async () => {
    const { runner, subscribers } = setUp();
    await runner.process(payload('topic.a', null));
    expect(subscribers[0].handle.mock.calls[0][0].value).toBeNull();
  });

  it('ignora topics sin subscriber', async () => {
    const { runner, subscribers } = setUp();
    await runner.process(payload('topic.z', '{}'));
    expect(subscribers[0].handle).not.toHaveBeenCalled();
  });

  it('reintenta con backoff exponencial y luego manda a la DLQ', async () => {
    const { runner, subscribers, sleep, producer } = setUp();
    subscribers[0].handle.mockRejectedValue(new Error('SMTP caído'));

    await runner.process(payload('topic.a', '{"id":1}'));

    expect(subscribers[0].handle).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[100], [200]]);
    const sent = producer.send.mock.calls[0][0];
    expect(sent.topic).toBe('notification.delivery.dlq');
    expect(sent.messages[0].headers).toMatchObject({
      'x-original-topic': 'topic.a',
      'x-original-partition': '3',
      'x-original-offset': '7',
      'x-error': 'SMTP caído',
    });
  });

  it('no reintenta si el segundo intento funciona', async () => {
    const { runner, subscribers, producer } = setUp();
    subscribers[0].handle.mockRejectedValueOnce(new Error('timeout'));
    await runner.process(payload('topic.a', '{}'));
    expect(subscribers[0].handle).toHaveBeenCalledTimes(2);
    expect(producer.send).not.toHaveBeenCalled();
  });

  it('manda directo a la DLQ un valor que no es JSON', async () => {
    const { runner, subscribers, producer } = setUp();
    await runner.process(payload('topic.a', 'no es json'));
    expect(subscribers[0].handle).not.toHaveBeenCalled();
    expect(producer.send.mock.calls[0][0].messages[0].headers['x-error']).toBe(
      'El valor del mensaje no es JSON',
    );
  });

  it('está listo al entrar al grupo y deja de estarlo al caerse o parar', async () => {
    const { runner, emit, consumer, producer } = setUp();
    expect(runner.isReady()).toBe(false);
    emit(EVENTS.GROUP_JOIN);
    expect(runner.isReady()).toBe(true);
    emit(EVENTS.CRASH, { error: new Error('broker caído') });
    expect(runner.isReady()).toBe(false);
    emit(EVENTS.GROUP_JOIN);
    emit(EVENTS.DISCONNECT);
    expect(runner.isReady()).toBe(false);

    await runner.stop();
    expect(consumer.disconnect).toHaveBeenCalled();
    expect(producer.disconnect).toHaveBeenCalled();
  });
});
