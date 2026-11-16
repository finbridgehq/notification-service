declare module 'eureka-js-client' {
  export interface EurekaPort {
    $: number;
    '@enabled': string;
  }

  export interface EurekaInstanceConfig {
    app: string;
    instanceId?: string;
    hostName: string;
    ipAddr: string;
    port: EurekaPort;
    vipAddress: string;
    statusPageUrl?: string;
    healthCheckUrl?: string;
    dataCenterInfo: {
      '@class': string;
      name: 'MyOwn' | 'Amazon';
    };
  }

  export interface EurekaServerConfig {
    host: string;
    port: number;
    servicePath?: string;
    fetchRegistry?: boolean;
    registryFetchInterval?: number;
  }

  export interface EurekaLogger {
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
  }

  export interface EurekaConfig {
    instance: EurekaInstanceConfig;
    eureka: EurekaServerConfig;
    logger?: EurekaLogger;
  }

  export interface EurekaInstance {
    hostName: string;
    ipAddr: string;
    status: string;
    port: EurekaPort;
  }

  export class Eureka {
    constructor(config: EurekaConfig);
    start(callback?: (error?: Error) => void): void;
    stop(callback?: (error?: Error) => void): void;
    getInstancesByAppId(appId: string): EurekaInstance[];
  }
}
