/**
 * Authorization guards — project-scoped access control
 */
import { prisma } from '@arxion/database';
import type { FastifyRequest } from 'fastify';

/**
 * Throws a 403 error if the given userId is not a member of the project.
 */
export async function requireProjectMember(projectId: string, userId: string): Promise<void> {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });

  if (!membership) {
    throw Object.assign(
      new Error(`User ${userId} is not a member of project ${projectId}`),
      { statusCode: 403 },
    );
  }
}

export async function requireProjectRole(
  projectId: string,
  userId: string,
  roles: Array<'OWNER' | 'MEMBER' | 'VIEWER'>,
): Promise<void> {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
  if (!membership || !roles.includes(membership.role)) {
    throw Object.assign(new Error('Insufficient project permissions'), { statusCode: 403 });
  }
}

/** Resolve the project touched by a request and enforce membership centrally. */
export async function requireRequestProjectAccess(req: FastifyRequest): Promise<void> {
  if (req.isInternalIntegration) return;
  if (!req.user) throw Object.assign(new Error('Authentication required'), { statusCode: 401 });

  const params = (req.params ?? {}) as Record<string, string | undefined>;
  let projectId = params['projectId'];

  if (!projectId && params['taskId']) {
    projectId = (await prisma.task.findFirst({
      where: { OR: [{ id: params['taskId'] }, { displayId: params['taskId'] }] },
      select: { projectId: true },
    }))?.projectId;
  }
  if (!projectId && params['reviewId']) {
    projectId = (await prisma.review.findUnique({
      where: { id: params['reviewId'] },
      select: { task: { select: { projectId: true } } },
    }))?.task.projectId;
  }
  if (!projectId && params['handoffId']) {
    projectId = (await prisma.taskHandoff.findUnique({
      where: { id: params['handoffId'] }, select: { projectId: true },
    }))?.projectId;
  }
  if (!projectId && params['updateId']) {
    projectId = (await prisma.contextUpdate.findUnique({
      where: { id: params['updateId'] }, select: { projectId: true },
    }))?.projectId;
  }
  if (!projectId && params['sessionId']) {
    projectId = (await prisma.agentSession.findUnique({
      where: { id: params['sessionId'] }, select: { projectId: true },
    }))?.projectId;
  }
  if (!projectId && params['id'] && req.url.startsWith('/launch-requests/')) {
    projectId = (await prisma.agentLaunchRequest.findUnique({
      where: { id: params['id'] }, select: { projectId: true },
    }))?.projectId;
  }

  if (projectId) await requireProjectMember(projectId, req.user.id);
}
