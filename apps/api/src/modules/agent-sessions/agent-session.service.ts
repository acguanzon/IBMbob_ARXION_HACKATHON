import { prisma } from '@arxion/database';
import type { CreateAgentSessionBody } from '@arxion/types';
import { emitEvent } from '../../lib/realtime.js';

const LEASE_DURATION_MS = 120_000; // 2 minutes default

export async function createAgentSession(body: CreateAgentSessionBody) {
  const session = await prisma.agentSession.create({
    data: {
      projectId: body.projectId,
      userId: body.userId,
      taskId: body.taskId ?? null,
      agentType: body.agentType ?? 'IBM_BOB',
      externalAgentId: body.externalAgentId ?? null,
      status: 'WORKING',
      lastSeenAt: new Date(),
    },
    include: { user: true, task: true },
  });

  await prisma.taskActivity.create({
    data: {
      projectId: body.projectId,
      taskId: body.taskId ?? null,
      userId: body.userId,
      agentSessionId: session.id,
      type: 'agent.started',
      message: `Agent session started (${session.agentType}).`,
    },
  });

  emitEvent('agent.started', body.projectId, { session });
  return session;
}

export async function heartbeat(sessionId: string) {
  const session = await prisma.agentSession.update({
    where: { id: sessionId },
    data: {
      lastSeenAt: new Date(),
      status: 'WORKING',
    },
    select: { id: true, projectId: true },
  });

  // Extend all active file leases for this session
  const newExpiry = new Date(Date.now() + LEASE_DURATION_MS);
  await prisma.taskFileReservation.updateMany({
    where: { agentSessionId: sessionId, status: 'ACTIVE' },
    data: { leaseExpiresAt: newExpiry },
  });

  emitEvent('agent.heartbeat', session.projectId, { sessionId });
  return { ok: true, sessionId };
}

export async function endSession(sessionId: string) {
  const session = await prisma.agentSession.update({
    where: { id: sessionId },
    data: { status: 'FINISHED', endedAt: new Date() },
    select: { id: true, projectId: true, taskId: true, userId: true },
  });

  // Release all active file reservations
  await prisma.taskFileReservation.updateMany({
    where: { agentSessionId: sessionId, status: 'ACTIVE' },
    data: { status: 'RELEASED', releasedAt: new Date() },
  });

  await prisma.taskActivity.create({
    data: {
      projectId: session.projectId,
      taskId: session.taskId ?? null,
      userId: session.userId,
      agentSessionId: sessionId,
      type: 'agent.ended',
      message: 'Agent session ended.',
    },
  });

  emitEvent('agent.ended', session.projectId, { sessionId });
  return session;
}

export async function listActiveSessionsByProject(projectId: string) {
  return prisma.agentSession.findMany({
    where: {
      projectId,
      status: { in: ['IDLE', 'WORKING', 'WAITING'] },
    },
    include: { user: true, task: true },
    orderBy: { lastSeenAt: 'desc' },
  });
}

export async function getSession(sessionId: string) {
  return prisma.agentSession.findUnique({
    where: { id: sessionId },
    include: { user: true, task: true },
  });
}
