import { LRUCache } from 'lru-cache';
import type { IProcessedEventRegistry } from '../../domain/services/processed-event-registry';

/**
 * @author LiquiLabs
 * @summary Registro de entregas en memoria (LRU con TTL).
 *
 * Cubre los duplicados normales de Kafka (reintentos, rebalanceos). Limitación conocida:
 * al reiniciar el servicio se pierde, y un evento que se vuelva a leer se notificaría
 * otra vez. Para evitarlo haría falta una base de datos (fuera del C4 actual).
 */
export class InMemoryProcessedEventRegistry implements IProcessedEventRegistry {
  private readonly cache: LRUCache<string, true>;

  constructor(maxEntries: number, ttlMs: number) {
    this.cache = new LRUCache<string, true>({ max: maxEntries, ttl: ttlMs });
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  markProcessed(key: string): void {
    this.cache.set(key, true);
  }
}
