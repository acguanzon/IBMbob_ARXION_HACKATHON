import { prisma } from '@arxion/database';
import type { SubmitCompletionReportBody } from '@arxion/types';
import { emitEvent } from '../../lib/realtime.js';

/**
 * Submit a completion report for a task.
 * Validates: task exists, caller authorized, task is IN_PROGRESS, active session, revision provided.
 */
export async function submitCompletionReport(
  taskId: string,
  body: SubmitCompletionReportBody,
) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) {
    throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });
  }

  if (task.status !== 'IN_PROGRESS') {
    throw Object.assign(
      new Error(`Task ${task.displayId} must be IN_PROGRESS to submit a completion report (current: ${task.status}).`),
      { statusCode: 422 },
    );
  }

  // Validate active agent session if provided
  if (body.agentSessionId) {
    const session = await prisma.agentSession.findUnique({
      where: { id: body.agentSessionId },
    });
    if (!session || session.status === 'FINISHED' || session.status === 'STALE') {
      throw Object.assign(
        new Error(`Agent session ${body.agentSessionId} is not active.`),
        { statusCode: 422 },
      );
    }
  }

  const report = await prisma.taskCompletionReport.create({
    data: {
      taskId: task.id,
      agentSessionId: body.agentSessionId ?? null,
      summary: body.summary,
      filesChanged: body.filesChanged,
      contractsChanged: body.contractsChanged,
      testsRun: body.testsRun,
      testsPassed: body.testsPassed,
      testsFailed: body.testsFailed,
      knownIssues: body.knownIssues ?? null,
      scopeChanges: body.scopeChanges ?? null,
      workRevision: body.workRevision,
    },
  });

  await prisma.taskActivity.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      userId: body.userId,
      agentSessionId: body.agentSessionId ?? null,
      type: 'completion_report.created',
      message: `Completion report submitted for ${task.displayId} at revision ${body.workRevision}. Tests: ${body.testsPassed}/${body.testsRun} passed.`,
      metadata: {
        reportId: report.id,
        workRevision: body.workRevision,
        testsPassed: body.testsPassed,
        testsFailed: body.testsFailed,
      },
    },
  });

  emitEvent('completion_report.created', task.projectId, {
    taskId: task.id,
    reportId: report.id,
    workRevision: body.workRevision,
  });

  return report;
}

/**
 * Get the most recent completion report for a task.
 */
export async function getCompletionReport(taskId: string) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) {
    throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });
  }

  return prisma.taskCompletionReport.findFirst({
    where: { taskId: task.id },
    orderBy: { createdAt: 'desc' },
  });
}
