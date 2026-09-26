/**
 * AgentLaunchRequest service
 *
 * Handles creating launch requests (developer → agent),
 * accepting them (agent polls and takes ownership), and cancellation.
 */
import { prisma } from '@arxion/database';
import { buildContextPackage } from '../phase5/context-package.service.js';
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
