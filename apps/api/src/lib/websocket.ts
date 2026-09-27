import { Server as SocketIOServer } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { realtimeEmitter } from './realtime.js';
import type { DomainEvent } from '@arxion/types';

/**
 * Attaches Socket.IO to the Fastify HTTP server.
 * Clients join a room named after their projectId.
 * All domain events are forwarded to the matching room.
 */
export function attachWebSocket(
  app: FastifyInstance,
  corsOrigin: string | string[] | boolean,
): SocketIOServer {
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
    // Allow polling fallback for environments that block long-lived WS
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    // Client sends { projectId } on connect to subscribe to that project's events
    socket.on('join_project', (projectId: string) => {
      if (typeof projectId === 'string' && projectId.length > 0) {
        void socket.join(projectId);
      }
    });

    socket.on('leave_project', (projectId: string) => {
      if (typeof projectId === 'string') {
        void socket.leave(projectId);
      }
    });
  });

  // Forward every domain event to the matching project room
  realtimeEmitter.on_event((event: DomainEvent) => {
    io.to(event.projectId).emit('domain_event', event);
  });

  return io;
}
