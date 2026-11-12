import { Kafka, logLevel } from 'kafkajs';
import type { SASLOptions } from 'kafkajs';
import type { AppConfig } from '../config/env.config';

/**
 * @author LiquiLabs
 * @summary Crea el cliente de Kafka. En local es PLAINTEXT; desplegado admite SSL + SASL
 * (por ejemplo el endpoint Kafka de Azure Event Hubs).
 */
export function createKafka(config: AppConfig['kafka']): Kafka {
  return new Kafka({
    clientId: config.clientId,
    brokers: config.brokers,
    ssl: config.ssl,
    sasl: config.sasl as SASLOptions | undefined,
    logLevel: logLevel.WARN,
  });
}
