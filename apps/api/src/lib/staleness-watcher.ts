import { prisma } from '@arxion/database';
import { emitEvent } from './realtime.js';

// Check every 30 seconds
const STALE_CHECK_INTERVAL_MS = 30_000;
// Sessions stale after 90 seconds without heartbeat
const STALE_THRESHOLD_MS = 90_000;

let watcherInterval: ReturnType<typeof setInterval> | null = null;

export function startStalenessWatcher(_emitter: unknown): void {
  if (watcherInterval) return; // already started

  console.info('🔍 Staleness watcher started');

  watcherInterval = setInterval(() => {
    void checkStaleSessions();
    void expireLeases();
  }, STALE_CHECK_INTERVAL_MS);

  // Don't block process exit
  watcherInterval.unref();
}

export function stopStalenessWatcher(): void {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
  }
}

async function checkStaleSessions(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  const stale = await prisma.agentSession.findMany({
    where: {
      status: { in: ['WORKING', 'WAITING', 'IDLE'] },
      lastSeenAt: { lt: cutoff },
    },
    select: { id: true, projectId: true, userId: true, taskId: true },
  });

  if (stale.length === 0) return;

  await prisma.agentSession.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { status: 'STALE' },
  });

  for (const session of stale) {
    emitEvent('agent.stale', session.projectId, { sessionId: session.id });
    console.warn(`⚠️  Agent session ${session.id} marked STALE`);
  }
}

async function expireLeases(): Promise<void> {
  const now = new Date();

  const expired = await prisma.taskFileReservation.findMany({
    where: {
      status: 'ACTIVE',
      leaseExpiresAt: { lt: now },
    },
    select: { id: true, projectId: true, filePath: true, taskId: true },
  });

  if (expired.length === 0) return;

  await prisma.taskFileReservation.updateMany({
    where: { id: { in: expired.map((r) => r.id) } },
    data: { status: 'EXPIRED', releasedAt: now },
  });

  for (const res of expired) {
    emitEvent('file.expired', res.projectId, {
      reservationId: res.id,
      filePath: res.filePath,
      taskId: res.taskId,
    });
  }
}
