import { prisma } from '@arxion/database';
import type { RegisterGitLinkBody, ConfirmMergeBody, MergeReadiness } from '@arxion/types';
import { emitEvent } from '../../lib/realtime.js';

/**
 * Register or update a git link for a task.
 */
export async function registerGitLink(taskId: string, body: RegisterGitLinkBody) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  const existing = await prisma.taskGitLink.findFirst({
    where: { taskId: task.id },
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) {
    return prisma.taskGitLink.update({
      where: { id: existing.id },
      data: {
        repositoryUrl: body.repositoryUrl ?? existing.repositoryUrl,
        branchName: body.branchName ?? existing.branchName,
        baseBranch: body.baseBranch ?? existing.baseBranch,
        latestCommitSha: body.latestCommitSha ?? existing.latestCommitSha,
        pullRequestUrl: body.pullRequestUrl ?? existing.pullRequestUrl,
        pullRequestNumber: body.pullRequestNumber ?? existing.pullRequestNumber,
      },
    });
  }

  return prisma.taskGitLink.create({
    data: {
      taskId: task.id,
      repositoryUrl: body.repositoryUrl ?? null,
      branchName: body.branchName ?? null,
      baseBranch: body.baseBranch ?? null,
      latestCommitSha: body.latestCommitSha ?? null,
      pullRequestUrl: body.pullRequestUrl ?? null,
      pullRequestNumber: body.pullRequestNumber ?? null,
    },
  });
}

/**
 * Calculate merge readiness for a task.
 */
export async function getMergeReadiness(taskId: string): Promise<MergeReadiness> {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  const warnings: string[] = [];
  const blockers: string[] = [];

  // Check approved review
  const approvedReview = await prisma.review.findFirst({
    where: { taskId: task.id, status: 'APPROVED' },
    orderBy: { reviewVersion: 'desc' },
    include: { findings: true },
  });

  if (!approvedReview) {
    blockers.push('No approved review found.');
  }

  // Check for blocking open findings
  if (approvedReview) {
    const blockingOpen = approvedReview.findings.filter(
      (f) => f.isBlocking && f.status === 'OPEN',
    );
    if (blockingOpen.length > 0) {
      blockers.push(`${blockingOpen.length} blocking finding(s) still open.`);
    }
  }

  // Check revision match
  const gitLink = await prisma.taskGitLink.findFirst({
    where: { taskId: task.id },
    orderBy: { updatedAt: 'desc' },
  });

  const approvedRevision = approvedReview?.reviewRevision ?? null;
  const currentRevision = gitLink?.latestCommitSha ?? approvedRevision;
  const revisionsMatch = !approvedRevision || !currentRevision || approvedRevision === currentRevision;

  if (approvedReview && !revisionsMatch) {
    blockers.push(`Approved revision (${approvedRevision}) does not match current revision (${currentRevision}).`);
  }

  // Dependencies
  const deps = await prisma.taskDependency.findMany({
    where: { taskId: task.id },
    include: { dependsOn: true },
  });
  type DepRow = (typeof deps)[number];
  const blockedDeps = deps.filter((d: DepRow) => d.dependsOn.status !== 'DONE');
  if (blockedDeps.length > 0) {
    blockedDeps.forEach((d: DepRow) => {
      blockers.push(`Dependency ${d.dependsOn.displayId} is not yet DONE.`);
    });
  }

  // Stale active reservations from other tasks
  const otherReservations = await prisma.taskFileReservation.count({
    where: {
      projectId: task.projectId,
      status: 'ACTIVE',
      NOT: { taskId: task.id },
    },
  });
  if (otherReservations > 0) {
    warnings.push(`${otherReservations} active file reservation(s) from other tasks.`);
  }

  // Merge status
  if (gitLink?.mergeStatus === 'MERGED') {
    warnings.push('Branch already marked as merged.');
  }

  const status =
    blockers.length > 0
      ? 'NOT_READY'
      : warnings.length > 0
        ? 'READY_WITH_WARNINGS'
        : 'READY_TO_MERGE';

  if (status !== 'NOT_READY') {
    // Update git link merge status
    if (gitLink && gitLink.mergeStatus === 'NOT_STARTED') {
      await prisma.taskGitLink.update({
        where: { id: gitLink.id },
        data: { mergeStatus: 'READY' },
      });
      emitEvent('merge.readiness_changed', task.projectId, {
        taskId: task.id,
        status: 'READY',
      });
    }
  }

  return { status, warnings, blockers, approvedRevision, currentRevision, revisionsMatch };
}

/**
 * Confirm that a task's branch has been merged.
 */
export async function confirmMerge(taskId: string, body: ConfirmMergeBody) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  // Verify merge readiness
  const readiness = await getMergeReadiness(taskId);
  if (readiness.status === 'NOT_READY') {
    throw Object.assign(
      new Error(`Cannot confirm merge — task is not ready to merge: ${readiness.blockers.join('; ')}`),
      { statusCode: 422 },
    );
  }

  // Upsert git link with merge info
  const existing = await prisma.taskGitLink.findFirst({
    where: { taskId: task.id },
    orderBy: { updatedAt: 'desc' },
  });

  let gitLink;
  if (existing) {
    gitLink = await prisma.taskGitLink.update({
      where: { id: existing.id },
      data: {
        mergeStatus: 'MERGED',
        mergedCommitSha: body.mergedCommitSha ?? null,
        mergedAt: new Date(),
      },
    });
  } else {
    gitLink = await prisma.taskGitLink.create({
      data: {
        taskId: task.id,
        mergeStatus: 'MERGED',
        mergedCommitSha: body.mergedCommitSha ?? null,
        mergedAt: new Date(),
      },
    });
  }

  await prisma.taskActivity.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      userId: body.mergedById ?? null,
      type: 'merge.confirmed',
      message: `Merge confirmed for ${task.displayId}${body.mergedCommitSha ? ` at commit ${body.mergedCommitSha}` : ''}.`,
      metadata: { mergedCommitSha: body.mergedCommitSha },
    },
  });

  emitEvent('merge.confirmed', task.projectId, {
    taskId: task.id,
    mergedCommitSha: body.mergedCommitSha,
  });

  return gitLink;
}
