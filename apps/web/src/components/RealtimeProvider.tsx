'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

interface RealtimeProviderProps {
  projectId: string;
}

// Events that should trigger a dashboard refresh
const REFRESH_EVENTS = new Set([
  'task.claimed',
  'task.released',
  'task.started',
  'task.progress',
  'task.updated',
  'agent.started',
  'agent.ended',
  'agent.stale',
  'file.reserved',
  'file.released',
  'file.conflict',
  'file.expired',
  'contract.declared',
  'contract.risk_detected',
]);

/**
 * Invisible component — connects to the API Socket.IO server,
 * joins the project room, and calls router.refresh() whenever a
 * relevant domain event arrives so the server components re-fetch live data.
 */
export function RealtimeProvider({ projectId }: RealtimeProviderProps) {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

    const socket = io(apiUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_project', projectId);
    });

    socket.on('domain_event', (event: { type: string }) => {
      if (!REFRESH_EVENTS.has(event.type)) return;

      // Debounce: coalesce rapid bursts into a single refresh after 400 ms
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        router.refresh();
      }, 400);
    });

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      socket.disconnect();
    };
  }, [projectId, router]);

  return null;
}
