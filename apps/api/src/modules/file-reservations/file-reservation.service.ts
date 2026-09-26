import { prisma } from '@arxion/database';
import type { ReserveFilesBody, ReleaseFilesBody, FileConflict } from '@arxion/types';
import { normalizePaths } from '../../lib/normalize-path.js';
import { emitEvent } from '../../lib/realtime.js';

const DEFAULT_LEASE_SECONDS = 120;

export async function reserveFiles(
  taskId: string,
  body: ReserveFilesBody,
): Promise<{ reserved: string[]; conflicts: FileConflict[] }> {
  // Resolve task
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  const normalizedPaths = normalizePaths(body.filePaths);
  const leaseDuration = (body.leaseDurationSeconds ?? DEFAULT_LEASE_SECONDS) * 1000;
  const leaseExpiresAt = new Date(Date.now() + leaseDuration);

  // Check for existing active reservations on the same paths in the same project
  const existing = await prisma.taskFileReservation.findMany({
    where: {
      projectId: task.projectId,
      filePath: { in: normalizedPaths },
      status: 'ACTIVE',
      NOT: { taskId: task.id }, // same task can re-reserve
    },
    include: {
      user: true,
      task: true,
    },
  });

  type ExistingRes = (typeof existing)[number];
  const conflictPaths = new Set(existing.map((r: ExistingRes) => r.filePath));

  // Build conflict report
  const conflicts: FileConflict[] = existing.map((r: ExistingRes) => ({
    filePath: r.filePath,
    existingReservation: {
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      taskId: r.taskId,
      taskDisplayId: r.task.displayId,
      agentSessionId: r.agentSessionId,
      reservedAt: r.reservedAt,
      leaseExpiresAt: r.leaseExpiresAt,
    },
  }));

  // Reserve all paths (even conflicted ones — advisory model)
  const reserved: string[] = [];
  for (const filePath of normalizedPaths) {
    // Upsert: if same task already reserved this file, update the lease
    const existing_own = await prisma.taskFileReservation.findFirst({
      where: {
        projectId: task.projectId,
        taskId: task.id,
        filePath,
        status: 'ACTIVE',
      },
    });

    if (existing_own) {
      await prisma.taskFileReservation.update({
        where: { id: existing_own.id },
        data: { leaseExpiresAt },
      });
    } else {
      await prisma.taskFileReservation.create({
        data: {
          projectId: task.projectId,
          taskId: task.id,
          userId: body.userId,
          agentSessionId: body.agentSessionId ?? null,
          filePath,
          status: conflictPaths.has(filePath) ? 'CONFLICT' : 'ACTIVE',
          leaseExpiresAt,
        },
      });
    }

    reserved.push(filePath);

    const eventType = conflictPaths.has(filePath) ? 'file.conflict' : 'file.reserved';
    emitEvent(eventType, task.projectId, {
      filePath,
      taskId: task.id,
      taskDisplayId: task.displayId,
      userId: body.userId,
    });
  }

  // Log activity
  await prisma.taskActivity.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      userId: body.userId,
      agentSessionId: body.agentSessionId ?? null,
      type: 'file.reserved',
      message: `Reserved ${reserved.length} file(s): ${reserved.join(', ')}`,
      metadata: { files: reserved, conflicts: conflicts.map((c) => c.filePath) },
    },
  });

  return { reserved, conflicts };
}

export async function releaseFiles(
  taskId: string,
  body: ReleaseFilesBody,
): Promise<{ released: string[] }> {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  const normalizedPaths = normalizePaths(body.filePaths);
  const now = new Date();

  await prisma.taskFileReservation.updateMany({
    where: {
      projectId: task.projectId,
      taskId: task.id,
      filePath: { in: normalizedPaths },
      status: { in: ['ACTIVE', 'CONFLICT'] },
    },
    data: { status: 'RELEASED', releasedAt: now },
  });

  for (const filePath of normalizedPaths) {
    emitEvent('file.released', task.projectId, {
      filePath,
      taskId: task.id,
      taskDisplayId: task.displayId,
    });
  }

  await prisma.taskActivity.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      userId: body.userId,
      type: 'file.released',
      message: `Released ${normalizedPaths.length} file(s): ${normalizedPaths.join(', ')}`,
    },
  });

  return { released: normalizedPaths };
}

export async function listActiveReservations(projectId: string) {
  return prisma.taskFileReservation.findMany({
    where: {
      projectId,
      status: { in: ['ACTIVE', 'CONFLICT'] },
    },
    include: { user: true, task: true, agentSession: true },
    orderBy: { reservedAt: 'asc' },
  });
}
