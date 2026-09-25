import { EventEmitter } from 'node:events';
import type { DomainEvent, DomainEventType } from '@arxion/types';

/**
 * Lightweight in-process domain event bus.
 * The API emits events here; the WebSocket layer subscribes and forwards to clients.
 * Designed to be swappable with a real broker later without changing call sites.
 */
class RealtimeEmitter extends EventEmitter {
  emit_event<T>(event: DomainEvent<T>): void {
    this.emit('domain_event', event);
    this.emit(event.type, event);
  }

  on_event(handler: (event: DomainEvent) => void): void {
    this.on('domain_event', handler);
  }
}

export const realtimeEmitter = new RealtimeEmitter();
realtimeEmitter.setMaxListeners(50);

export function emitEvent<T>(
  type: DomainEventType,
  projectId: string,
  payload: T,
): void {
  realtimeEmitter.emit_event({
    type,
    projectId,
    payload,
    timestamp: new Date().toISOString(),
  });
}
