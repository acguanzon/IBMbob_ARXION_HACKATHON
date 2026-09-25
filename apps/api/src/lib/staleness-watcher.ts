import { prisma } from '@arxion/database';
import { emitEvent } from './realtime.js';
import { createRecoverySnapshot } from '../modules/phase5/recovery.service.js';

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
  try {
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
      where: { id: { in: stale.map((s: { id: string }) => s.id) } },
      data: { status: 'STALE' },
    });

    for (const session of stale as Array<{ id: string; projectId: string; userId: string; taskId: string | null }>) {
      emitEvent('agent.stale', session.projectId, { sessionId: session.id });
      console.warn(`⚠️  Agent session ${session.id} marked STALE`);
      // Phase 5: create recovery snapshot when a session goes stale
      if (session.taskId) {
        try {
          await createRecoverySnapshot({
            taskId: session.taskId,
            previousAgentSessionId: session.id,
            trigger: 'SESSION_STALE',
          })
        } catch {
          // Non-fatal — recovery snapshot creation should not fail the watcher
        }
      }
    }
  } catch (err) {
    console.warn('⚠️  Staleness watcher: database unreachable, skipping check.', (err as Error).message);
  }
}

async function expireLeases(): Promise<void> {
  try {
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
      where: { id: { in: expired.map((r: { id: string }) => r.id) } },
      data: { status: 'EXPIRED', releasedAt: now },
    });

    for (const res of expired as Array<{ id: string; projectId: string; filePath: string; taskId: string | null }>) {
      emitEvent('file.expired', res.projectId, {
        reservationId: res.id,
        filePath: res.filePath,
        taskId: res.taskId,
      });
    }
  } catch (err) {
    console.warn('⚠️  Staleness watcher: database unreachable, skipping lease expiry.', (err as Error).message);
  }
}
