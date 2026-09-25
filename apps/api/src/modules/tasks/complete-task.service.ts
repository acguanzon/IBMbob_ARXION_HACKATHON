import { prisma } from '@arxion/database';
import type { Prisma } from '@arxion/database';
import type { CompleteTaskBody } from '@arxion/types';
import { emitEvent } from '../../lib/realtime.js';

/**
 * Idempotent task completion.
 *
 * Completion requires:
 * - task not already DONE
 * - review APPROVED
 * - approved revision current (or no git link)
 * - merge confirmed (mergeStatus === MERGED on any git link)
 * - no blocking finding remains
 *
 * On success (single transaction):
 * - Task → DONE
 * - Set completedAt
 * - Release active file reservations
 * - End active agent sessions
 * - Activate final contracts (DRAFT → ACTIVE, old versions → SUPERSEDED)
 * - Re-evaluate dependent tasks (unblock if all deps DONE)
 * - Record completion activity
 * - Emit task.completed
 */
export async function completeTask(taskId: string, body: CompleteTaskBody) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  // Idempotency guard
  if (task.status === 'DONE') {
    return { task, alreadyDone: true };
  }

  // Require approved review
  const approvedReview = await prisma.review.findFirst({
    where: { taskId: task.id, status: 'APPROVED' },
    include: { findings: true },
  });
  if (!approvedReview) {
    throw Object.assign(new Error('Task cannot be completed: no approved review.'), { statusCode: 422 });
  }

  // No blocking findings
  const blockingOpen = approvedReview.findings.filter((f) => f.isBlocking && f.status === 'OPEN');
  if (blockingOpen.length > 0) {
    throw Object.assign(
      new Error(`Task cannot be completed: ${blockingOpen.length} blocking finding(s) still open.`),
      { statusCode: 422 },
    );
  }

  // Require merge confirmed
  const gitLink = await prisma.taskGitLink.findFirst({
    where: { taskId: task.id },
    orderBy: { updatedAt: 'desc' },
  });
  // Only require merged if a git link exists
  if (gitLink && gitLink.mergeStatus !== 'MERGED') {
    throw Object.assign(
      new Error(`Task cannot be completed: merge not confirmed (status: ${gitLink.mergeStatus}).`),
      { statusCode: 422 },
    );
  }

  // Check approved revision is still current
  if (gitLink && approvedReview.reviewRevision && gitLink.latestCommitSha) {
    if (approvedReview.reviewRevision !== gitLink.latestCommitSha && gitLink.mergeStatus !== 'MERGED') {
      throw Object.assign(
        new Error(`Approved revision (${approvedReview.reviewRevision}) does not match current (${gitLink.latestCommitSha}).`),
        { statusCode: 422 },
      );
    }
  }

  // Execute completion transaction
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Mark task DONE
    const completedTask = await tx.task.update({
      where: { id: task.id },
      data: { status: 'DONE', completedAt: new Date() },
      include: { assignee: true, createdBy: true, dependencies: { include: { dependsOn: true } } },
    });

    // 2. Release all active file reservations for this task
    await tx.taskFileReservation.updateMany({
      where: { taskId: task.id, status: 'ACTIVE' },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });

    // 3. End all active agent sessions for this task
    await tx.agentSession.updateMany({
      where: { taskId: task.id, status: { in: ['IDLE', 'WORKING', 'WAITING'] } },
      data: { status: 'FINISHED', endedAt: new Date() },
    });

    // 4. Activate DRAFT contract versions for this task; supersede older ACTIVE versions
    const draftVersions = await tx.contractVersion.findMany({
      where: { taskId: task.id, status: 'DRAFT' },
    });

    for (const draftVersion of draftVersions) {
      // Supersede previously active versions for this contract
      await tx.contractVersion.updateMany({
        where: {
          contractId: draftVersion.contractId,
          status: 'ACTIVE',
          id: { not: draftVersion.id },
        },
        data: { status: 'SUPERSEDED' },
      });
      // Activate this version
      await tx.contractVersion.update({
        where: { id: draftVersion.id },
        data: { status: 'ACTIVE', activatedAt: new Date() },
      });
    }

    // 5. Record completion activity
    await tx.taskActivity.create({
      data: {
        projectId: task.projectId,
        taskId: task.id,
        userId: body.userId,
        type: 'task.completed',
        message: `Task ${task.displayId} marked DONE.`,
        metadata: {
          reviewId: approvedReview.id,
          reviewVersion: approvedReview.reviewVersion,
          mergedCommitSha: gitLink?.mergedCommitSha ?? null,
          contractVersionsActivated: draftVersions.length,
        },
      },
    });

    return { completedTask, draftVersions };
  });

  // Emit task.completed
  emitEvent('task.completed', task.projectId, {
    taskId: task.id,
    displayId: task.displayId,
    contractVersionsActivated: result.draftVersions.length,
  });

  // Emit contract events
  for (const v of result.draftVersions) {
    emitEvent('contract.activated', task.projectId, { contractId: v.contractId, versionId: v.id });
  }

  // 6. Re-evaluate dependent tasks (outside transaction for simplicity)
  await reevaluateDependents(task.id, task.projectId);

  return { task: result.completedTask, alreadyDone: false };
}

/**
 * Re-evaluate all tasks that depend on the given completed task.
 * If all their dependencies are DONE, unblock them (BLOCKED → TODO).
 */
async function reevaluateDependents(completedTaskId: string, projectId: string) {
  // Find all tasks that depend on this task
  const dependents = await prisma.taskDependency.findMany({
    where: { dependsOnTaskId: completedTaskId },
    include: { task: true },
  });

  for (const dep of dependents) {
    const dependentTask = dep.task;
    if (dependentTask.status !== 'BLOCKED') continue;

    // Check all dependencies for this dependent task
    const allDeps = await prisma.taskDependency.findMany({
      where: { taskId: dependentTask.id },
      include: { dependsOn: true },
    });

    type DepRow = (typeof allDeps)[number];
    const stillBlocked = allDeps.some((d: DepRow) => d.dependsOn.status !== 'DONE');

    if (!stillBlocked) {
      await prisma.task.update({
        where: { id: dependentTask.id },
        data: { status: 'TODO' },
      });

      await prisma.taskActivity.create({
        data: {
          projectId,
          taskId: dependentTask.id,
          type: 'task.unblocked',
          message: `Task ${dependentTask.displayId} automatically unblocked — all dependencies are now DONE.`,
        },
      });

      emitEvent('task.unblocked', projectId, {
        taskId: dependentTask.id,
        displayId: dependentTask.displayId,
        unlockedBy: completedTaskId,
      });
    }
  }
}
