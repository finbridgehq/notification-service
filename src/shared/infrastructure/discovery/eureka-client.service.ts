import { Eureka } from 'eureka-js-client';
import type { EurekaConfig } from 'eureka-js-client';
import type { Logger } from '../logging/logger';

/** @author LiquiLabs */
export interface EurekaClientOptions {
  appName: string;
  instanceHostname: string;
  port: number;
  eurekaHost: string;
  eurekaPort: number;
}

/**
 * @author LiquiLabs
 * @summary Registra el servicio en el Discovery Server (Eureka) y consulta dónde están los demás.
 *
 * Sigue la misma configuración que Profile Service: el nombre de la app es el que usa
 * el gateway en `lb://notification-service`. Si Eureka no responde, el servicio arranca
 * igual y se registra cuando vuelva (eureka-js-client reintenta solo).
 */
export class EurekaClientService {
  private readonly client: Eureka;

  constructor(
    options: EurekaClientOptions,
    private readonly logger: Logger,
    createClient: (config: EurekaConfig) => Eureka = (config) =>
      new Eureka(config),
  ) {
    const { appName, instanceHostname, port } = options;
    const baseUrl = `http://${instanceHostname}:${port}`;
    this.client = createClient({
      instance: {
        app: appName,
        instanceId: `${instanceHostname}:${appName}:${port}`,
        hostName: instanceHostname,
        ipAddr: instanceHostname,
        port: { $: port, '@enabled': 'true' },
        vipAddress: appName,
        statusPageUrl: `${baseUrl}/health/live`,
        healthCheckUrl: `${baseUrl}/health/ready`,
        dataCenterInfo: {
          '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
          name: 'MyOwn',
        },
      },
      eureka: {
        host: options.eurekaHost,
        port: options.eurekaPort,
        servicePath: '/eureka/apps/',
        fetchRegistry: true,
        registryFetchInterval: 30000,
      },
      logger: logger.child({ component: 'eureka' }),
    });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.client.start((error) => {
        if (error) {
          this.logger.error(
            `No se pudo registrar en el Discovery Server: ${error.message}`,
          );
        } else {
          this.logger.info('Registrado en el Discovery Server (Eureka)');
        }
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.client.stop(() => resolve());
    });
  }

  /** URL base de una instancia `UP` de otro servicio, o `null` si no hay ninguna. */
  resolveServiceUrl(appId: string): string | null {
    const instance = this.client
      .getInstancesByAppId(appId)
      .find((candidate) => candidate.status === 'UP');
    return instance ? `http://${instance.hostName}:${instance.port.$}` : null;
  }
}
