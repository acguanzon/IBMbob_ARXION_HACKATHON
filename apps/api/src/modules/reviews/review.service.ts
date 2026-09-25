import { prisma } from '@arxion/database';
import type {
  RequestReviewBody,
  ApproveReviewBody,
  RequestChangesBody,
  ReviewPreflight,
  ScopeDeviation,
  ContractRisk,
} from '@arxion/types';
import { emitEvent } from '../../lib/realtime.js';
import { detectContractRisks } from '../coordination/coordination.service.js';

// ─── Review State Machine ──────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['IN_REVIEW'],
  IN_REVIEW: ['CHANGES_REQUESTED', 'APPROVED'],
  CHANGES_REQUESTED: ['IN_REVIEW'],
  APPROVED: ['INVALIDATED'],
  INVALIDATED: ['IN_REVIEW'],
};

function assertValidTransition(from: string, to: string): void {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw Object.assign(
      new Error(`Invalid review state transition: ${from} → ${to}`),
      { statusCode: 422 },
    );
  }
}

// ─── Review Preflight ──────────────────────────────────────────────────────────

/**
 * Run a full review preflight check.
 * Returns READY / READY_WITH_WARNINGS / BLOCKED.
 */
export async function runReviewPreflight(taskId: string): Promise<ReviewPreflight> {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  const warnings: string[] = [];
  const blockers: string[] = [];

  // Must be IN_PROGRESS
  if (task.status !== 'IN_PROGRESS') {
    blockers.push(`Task must be IN_PROGRESS to request review (current: ${task.status}).`);
  }

  // Completion report
  const completionReport = await prisma.taskCompletionReport.findFirst({
    where: { taskId: task.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!completionReport) {
    blockers.push('No completion report found. Submit a completion report before requesting review.');
  }

  // Dependencies check
  const deps = await prisma.taskDependency.findMany({
    where: { taskId: task.id },
    include: { dependsOn: true },
  });
  type DepRow = (typeof deps)[number];
  const blockedDeps = deps.filter((d: DepRow) => d.dependsOn.status !== 'DONE');
  if (blockedDeps.length > 0) {
    blockedDeps.forEach((d: DepRow) => {
      blockers.push(`Dependency ${d.dependsOn.displayId} (${d.dependsOn.status}) is not yet complete.`);
    });
  }

  // Active file reservations by other tasks
  const activeReservations = await prisma.taskFileReservation.count({
    where: {
      projectId: task.projectId,
      status: 'ACTIVE',
      NOT: { taskId: task.id },
    },
  });
  if (activeReservations > 0) {
    warnings.push(`${activeReservations} active file reservation(s) from other tasks exist.`);
  }

  // Contract risks
  const unresolvedRisks: ContractRisk[] = await detectContractRisks(task.id, task.projectId);
  if (unresolvedRisks.length > 0) {
    warnings.push(`${unresolvedRisks.length} contract risk(s) detected.`);
  }

  // Scope deviation analysis
  const workIntent = await prisma.taskWorkIntent.findFirst({
    where: { taskId: task.id },
  });
  const scopeDeviations: ScopeDeviation[] = [];

  if (completionReport && workIntent) {
    const declared = new Set(workIntent.files);
    const actual = new Set(completionReport.filesChanged);

    // Files in report but not declared
    for (const file of actual) {
      if (!declared.has(file)) {
        scopeDeviations.push({ file, reason: 'UNDECLARED_FILE', severity: 'MEDIUM' });
      }
    }
    // Files declared but not in report
    for (const file of declared) {
      if (!actual.has(file)) {
        scopeDeviations.push({ file, reason: 'DECLARED_BUT_NOT_IN_REPORT', severity: 'LOW' });
      }
    }

    if (scopeDeviations.length > 0) {
      warnings.push(`${scopeDeviations.length} scope deviation(s) detected.`);
    }
  }

  // Known issues
  if (completionReport?.knownIssues) {
    warnings.push(`Known issues reported: ${completionReport.knownIssues.substring(0, 100)}`);
  }

  // Test failures
  if (completionReport && completionReport.testsFailed > 0) {
    warnings.push(`${completionReport.testsFailed} test(s) failed.`);
  }

  const currentRevision = completionReport?.workRevision ?? null;

  const status =
    blockers.length > 0
      ? 'BLOCKED'
      : warnings.length > 0
        ? 'READY_WITH_WARNINGS'
        : 'READY';

  return {
    status,
    warnings,
    blockers,
    completionReport: completionReport ?? null,
    scopeDeviations,
    activeReservations,
    unresolvedRisks,
    currentRevision,
  };
}

// ─── Request Review ────────────────────────────────────────────────────────────

export async function requestReview(taskId: string, body: RequestReviewBody) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  const preflight = await runReviewPreflight(taskId);
  if (preflight.status === 'BLOCKED') {
    throw Object.assign(
      new Error(`Review blocked: ${preflight.blockers.join('; ')}`),
      { statusCode: 422, details: preflight },
    );
  }

  // Get latest completion report
  const completionReport = await prisma.taskCompletionReport.findFirst({
    where: { taskId: task.id },
    orderBy: { createdAt: 'desc' },
  });

  // Determine next review version
  const previousReview = await prisma.review.findFirst({
    where: { taskId: task.id },
    orderBy: { reviewVersion: 'desc' },
  });
  const nextVersion = previousReview ? previousReview.reviewVersion + 1 : 1;

  // Supersede previous review if any
  if (previousReview && previousReview.status !== 'SUPERSEDED') {
    await prisma.review.update({
      where: { id: previousReview.id },
      data: { status: 'SUPERSEDED' },
    });
  }

  // Get work intent and contracts for snapshot
  const workIntent = await prisma.taskWorkIntent.findFirst({ where: { taskId: task.id } });
  const contracts = await prisma.taskContract.findMany({ where: { taskId: task.id } });
  const gitLink = await prisma.taskGitLink.findFirst({
    where: { taskId: task.id },
    orderBy: { updatedAt: 'desc' },
  });

  const workRevision = completionReport?.workRevision ?? gitLink?.latestCommitSha ?? `manual-v${nextVersion}`;

  // Create the review
  const review = await prisma.review.create({
    data: {
      taskId: task.id,
      requestedById: body.userId,
      status: 'IN_REVIEW',
      reviewVersion: nextVersion,
      reviewRevision: workRevision,
    },
    include: { requestedBy: true, approvedBy: true, findings: true, snapshot: true },
  });

  // Create immutable snapshot
  await prisma.reviewSnapshot.create({
    data: {
      reviewId: review.id,
      taskId: task.id,
      workRevision,
      gitCommitSha: gitLink?.latestCommitSha ?? null,
      branchName: gitLink?.branchName ?? null,
      completionReportId: completionReport?.id ?? null,
      declaredIntentSnapshot: workIntent
        ? ({ files: workIntent.files, apis: workIntent.apis, models: workIntent.models, contracts: workIntent.contracts } as object)
        : undefined,
      contractSnapshot: { contracts: contracts.map((c) => ({ name: c.name, type: c.type, relationship: c.relationship })) } as object,
      fileSnapshot: { filesChanged: completionReport?.filesChanged ?? [] } as object,
      testSnapshot: completionReport
        ? ({
            testsRun: completionReport.testsRun,
            testsPassed: completionReport.testsPassed,
            testsFailed: completionReport.testsFailed,
          } as object)
        : undefined,
    },
  });

  // Transition task to REVIEW
  await prisma.task.update({
    where: { id: task.id },
    data: { status: 'REVIEW' },
  });

  await prisma.taskActivity.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      userId: body.userId,
      agentSessionId: body.agentSessionId ?? null,
      type: 'review.requested',
      message: `Review v${nextVersion} requested for ${task.displayId} at revision ${workRevision}.`,
      metadata: { reviewId: review.id, workRevision, warnings: preflight.warnings },
    },
  });

  emitEvent('review.requested', task.projectId, {
    taskId: task.id,
    reviewId: review.id,
    reviewVersion: nextVersion,
    workRevision,
  });

  return { review, preflight };
}

// ─── Get Review ───────────────────────────────────────────────────────────────

export async function getReview(reviewId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      requestedBy: true,
      approvedBy: true,
      findings: { orderBy: { createdAt: 'asc' } },
      snapshot: true,
    },
  });
  if (!review) throw Object.assign(new Error(`Review not found: ${reviewId}`), { statusCode: 404 });
  return review;
}

export async function getReviewsForTask(taskId: string) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  return prisma.review.findMany({
    where: { taskId: task.id },
    include: {
      requestedBy: true,
      approvedBy: true,
      findings: { orderBy: { createdAt: 'asc' } },
      snapshot: true,
    },
    orderBy: { reviewVersion: 'desc' },
  });
}

// ─── Approve Review ───────────────────────────────────────────────────────────

export async function approveReview(reviewId: string, body: ApproveReviewBody) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { task: true, findings: true, snapshot: true },
  });
  if (!review) throw Object.assign(new Error(`Review not found: ${reviewId}`), { statusCode: 404 });

  assertValidTransition(review.status, 'APPROVED');

  // Check all blocking findings are resolved/dismissed
  const blockingOpen = review.findings.filter(
    (f) => f.isBlocking && f.status === 'OPEN',
  );
  if (blockingOpen.length > 0) {
    throw Object.assign(
      new Error(`Cannot approve: ${blockingOpen.length} blocking finding(s) still open.`),
      { statusCode: 422, details: { blockingFindings: blockingOpen.map((f) => f.id) } },
    );
  }

  // Verify snapshot revision is still current
  const gitLink = await prisma.taskGitLink.findFirst({
    where: { taskId: review.taskId },
    orderBy: { updatedAt: 'desc' },
  });
  const currentRevision = gitLink?.latestCommitSha ?? review.reviewRevision;
  if (currentRevision && review.reviewRevision && currentRevision !== review.reviewRevision) {
    // Invalidate instead
    const invalidated = await prisma.review.update({
      where: { id: review.id },
      data: {
        status: 'INVALIDATED',
        invalidatedAt: new Date(),
        invalidationReason: `Work changed after review was created (approved: ${review.reviewRevision}, current: ${currentRevision}).`,
      },
    });
    emitEvent('review.invalidated', review.task.projectId, { reviewId: review.id, reason: invalidated.invalidationReason });
    throw Object.assign(
      new Error(`Review invalidated: revision changed since review was created (was ${review.reviewRevision}, now ${currentRevision}).`),
      { statusCode: 422 },
    );
  }

  const updated = await prisma.review.update({
    where: { id: review.id },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedById: body.reviewerId,
      comment: body.comment ?? null,
    },
    include: { requestedBy: true, approvedBy: true, findings: true, snapshot: true },
  });

  await prisma.taskActivity.create({
    data: {
      projectId: review.task.projectId,
      taskId: review.taskId,
      userId: body.reviewerId,
      type: 'review.approved',
      message: `Review v${review.reviewVersion} approved by reviewer at revision ${review.reviewRevision}.`,
      metadata: { reviewId: review.id, reviewVersion: review.reviewVersion },
    },
  });

  emitEvent('review.approved', review.task.projectId, {
    taskId: review.taskId,
    reviewId: review.id,
    reviewVersion: review.reviewVersion,
    approvedById: body.reviewerId,
  });

  return updated;
}

// ─── Request Changes ──────────────────────────────────────────────────────────

export async function requestChanges(reviewId: string, body: RequestChangesBody) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { task: true },
  });
  if (!review) throw Object.assign(new Error(`Review not found: ${reviewId}`), { statusCode: 404 });

  assertValidTransition(review.status, 'CHANGES_REQUESTED');

  await prisma.review.update({
    where: { id: review.id },
    data: { status: 'CHANGES_REQUESTED', comment: body.comment },
  });

  // Return task to IN_PROGRESS
  await prisma.task.update({
    where: { id: review.taskId },
    data: { status: 'IN_PROGRESS' },
  });

  await prisma.taskActivity.create({
    data: {
      projectId: review.task.projectId,
      taskId: review.taskId,
      userId: body.reviewerId,
      type: 'review.changes_requested',
      message: `Changes requested on Review v${review.reviewVersion}: "${body.comment}"`,
      metadata: { reviewId: review.id, reviewVersion: review.reviewVersion },
    },
  });

  emitEvent('review.changes_requested', review.task.projectId, {
    taskId: review.taskId,
    reviewId: review.id,
    comment: body.comment,
  });

  return review;
}
