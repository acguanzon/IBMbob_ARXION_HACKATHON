'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';

interface RealtimeProviderProps {
  projectId: string;
}

const WS_URL = process.env['NEXT_PUBLIC_WS_URL'] ?? 'http://localhost:3001';

/**
 * Invisible client component.
 * Connects to the API Socket.IO server and triggers a full page refresh
 * whenever a collaboration event arrives for this project.
 */
export function RealtimeProvider({ projectId }: RealtimeProviderProps) {
  const router = useRouter();

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket'],
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      socket.emit('join', projectId);
    });

    // Refresh the server component tree whenever any project event fires
    socket.onAny((_event: string, data: { projectId?: string }) => {
      if (!data?.projectId || data.projectId === projectId) {
        router.refresh();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId, router]);

  return null;
}
