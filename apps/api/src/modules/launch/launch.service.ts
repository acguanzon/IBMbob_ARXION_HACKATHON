/**
 * AgentLaunchRequest service
 *
 * Handles creating launch requests (developer → agent),
 * accepting them (agent polls and takes ownership), and cancellation.
 */
import { prisma } from '@arxion/database';
import { AgentTypeSchema } from '@arxion/types';
import { buildContextPackage } from '../phase5/context-package.service.js';
import { beginTask } from '../coordination/coordination.service.js';
import { endSession } from '../agent-sessions/agent-session.service.js';
import { emitEvent } from '../../lib/realtime.js';

export async function createLaunchRequest(opts: {
  projectId: string;
  taskId: string;
  userId: string;
  agentType: string;
}) {
  const { projectId, taskId, userId, agentType } = opts;

  // Resolve taskId (may be displayId)
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }], projectId },
    select: { id: true },
  });
  if (!task) {
    throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });
  }

  // Build context package for the agent
  const contextPackage = await buildContextPackage(task.id);

  const request = await prisma.agentLaunchRequest.create({
    data: {
      projectId,
      taskId: task.id,
      userId,
      agentType,
      contextPackageId: contextPackage.id,
      status: 'PENDING',
    },
    include: { task: { select: { displayId: true, title: true } }, user: { select: { name: true, email: true } } },
  });

  emitEvent('agent.launch_requested', projectId, {
    launchRequestId: request.id,
    taskId: task.id,
    agentType,
    userId,
  });

  return request;
}

export async function listPendingLaunchRequests(projectId: string) {
  return prisma.agentLaunchRequest.findMany({
    where: { projectId, status: 'PENDING' },
    include: {
      task: { select: { id: true, displayId: true, title: true, status: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getLaunchRequest(id: string) {
  const req = await prisma.agentLaunchRequest.findUnique({
    where: { id },
    include: {
      task: { select: { id: true, displayId: true, title: true, status: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!req) throw Object.assign(new Error(`Launch request not found: ${id}`), { statusCode: 404 });
  return req;
}

export async function acceptLaunchRequest(id: string, agentSessionId?: string) {
  const existing = await prisma.agentLaunchRequest.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error(`Launch request not found: ${id}`), { statusCode: 404 });
  if (existing.status !== 'PENDING') {
    throw Object.assign(
      new Error(`Launch request is not PENDING (current status: ${existing.status})`),
      { statusCode: 409 },
    );
  }

  const updated = await prisma.agentLaunchRequest.update({
    where: { id },
    data: {
      status: 'ACCEPTED',
      acceptedAt: new Date(),
      agentSessionId: agentSessionId ?? null,
    },
    include: {
      task: { select: { id: true, displayId: true, title: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  emitEvent('agent.launch_accepted', existing.projectId, {
    launchRequestId: id,
    agentSessionId,
  });

  return updated;
}

/**
 * Turn a launch request into a real, bound agent session.
 *
 * This is the endpoint used by local IDE bridges and agent adapters. A launch is
 * not considered "working" until beginTask has completed and the resulting
 * session ID is attached to the request.
 */
export async function startLaunchRequest(id: string, externalAgentId?: string) {
  const existing = await prisma.agentLaunchRequest.findUnique({
    where: { id },
    include: {
      task: { select: { id: true, displayId: true, title: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!existing) {
    throw Object.assign(new Error(`Launch request not found: ${id}`), { statusCode: 404 });
  }

  if (existing.status === 'ACCEPTED' && existing.agentSessionId) {
    return { launchRequest: existing, preflight: null, alreadyStarted: true };
  }

  if (existing.status !== 'PENDING') {
    throw Object.assign(
      new Error(`Launch request cannot be started from status ${existing.status}`),
      { statusCode: 409 },
    );
  }

  const agentType = AgentTypeSchema.parse(existing.agentType);
  let sessionId: string | null = null;

  try {
    const preflight = await beginTask(
      existing.taskId,
      existing.userId,
      agentType,
      externalAgentId ?? `launch:${existing.id}`,
    );
    sessionId = preflight.sessionId;

    const claimed = await prisma.agentLaunchRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        agentSessionId: preflight.sessionId,
      },
    });

    if (claimed.count !== 1) {
      await endSession(preflight.sessionId);
      sessionId = null;
      throw Object.assign(new Error('Launch request was claimed by another adapter'), {
        statusCode: 409,
      });
    }

    const launchRequest = await getLaunchRequest(id);
    emitEvent('agent.launch_started', existing.projectId, {
      launchRequestId: id,
      taskId: existing.taskId,
      agentSessionId: preflight.sessionId,
      agentType,
    });

    sessionId = null;
    return { launchRequest, preflight, alreadyStarted: false };
  } catch (error) {
    if (sessionId) {
      try {
        await endSession(sessionId);
      } catch {
        // The original launch failure is more useful than a cleanup failure.
      }
    }

    await prisma.agentLaunchRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
    throw error;
  }
}

export async function cancelLaunchRequest(id: string) {
  const existing = await prisma.agentLaunchRequest.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error(`Launch request not found: ${id}`), { statusCode: 404 });

  const updated = await prisma.agentLaunchRequest.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  emitEvent('agent.launch_cancelled', existing.projectId, {
    launchRequestId: id,
  });

  return updated;
}
