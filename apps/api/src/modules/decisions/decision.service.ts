import { prisma } from '@arxion/database';
import type { RecordProjectDecisionBody } from '@arxion/types';
import { emitEvent } from '../../lib/realtime.js';

/**
 * Record a new project decision.
 */
export async function recordProjectDecision(projectId: string, body: RecordProjectDecisionBody) {
  const decision = await prisma.projectDecision.create({
    data: {
      projectId,
      taskId: body.taskId ?? null,
      title: body.title,
      decision: body.decision,
      reason: body.reason ?? null,
      createdById: body.createdById,
      agentSessionId: body.agentSessionId ?? null,
      status: 'ACTIVE',
    },
    include: { createdBy: true, task: true },
  });

  await prisma.taskActivity.create({
    data: {
      projectId,
      taskId: body.taskId ?? null,
      userId: body.createdById,
      agentSessionId: body.agentSessionId ?? null,
      type: 'decision.recorded',
      message: `Project decision recorded: "${body.title}"`,
      metadata: { decisionId: decision.id },
    },
  });

  emitEvent('decision.recorded', projectId, {
    decisionId: decision.id,
    title: body.title,
  });

  return decision;
}

/**
 * Get all active project decisions.
 */
export async function getProjectDecisions(projectId: string) {
  return prisma.projectDecision.findMany({
    where: { projectId },
    include: { createdBy: true, task: true },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Supersede an existing decision with a new one.
 */
export async function supersedeDecision(
  decisionId: string,
  supersededById: string,
  projectId: string,
) {
  const decision = await prisma.projectDecision.findUnique({ where: { id: decisionId } });
  if (!decision) throw Object.assign(new Error(`Decision not found: ${decisionId}`), { statusCode: 404 });

  await prisma.projectDecision.update({
    where: { id: decisionId },
    data: { status: 'SUPERSEDED', supersededById },
  });

  emitEvent('decision.superseded', projectId, { decisionId, supersededById });
}
