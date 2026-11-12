import { config as loadDotenv } from 'dotenv';
import { createApp } from './app';
import { buildContainer } from './container';
import { loadAppConfig } from './shared/infrastructure/config/env.config';
import { createLogger } from './shared/infrastructure/logging/logger';

/**
 * @author LiquiLabs
 * @summary Punto de entrada: configuración → contenedor → HTTP, Kafka y Eureka.
 */
function bootstrap(): void {
  // En local lee el .env; en Docker y Azure las variables ya vienen del entorno.
  loadDotenv({ quiet: true });
  const config = loadAppConfig();
  const logger = createLogger(config.logLevel);
  const container = buildContainer(config, logger);

  const app = createApp({ logger, ...container });
  const server = app.listen(config.port, () => {
    logger.info(
      `Notification Service escuchando en el puerto ${config.port} (docs en /reference)`,
    );
  });

  // Kafka y Eureka no bloquean el arranque: /health/ready dice cuándo está listo.
  container.kafkaRunner?.start().catch((error: Error) => {
    logger.fatal({ error: error.message }, 'No se pudo conectar a Kafka');
    process.exit(1);
  });
  void container.eureka?.start();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} recibido: deteniendo el servicio`);
    server.close();
    await Promise.allSettled([
      container.kafkaRunner?.stop(),
      container.eureka?.stop(),
    ]);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

try {
  bootstrap();
} catch (error) {
  // Sin logger todavía: la configuración inválida se reporta por la consola.
  console.error((error as Error).message);
  process.exit(1);
}
