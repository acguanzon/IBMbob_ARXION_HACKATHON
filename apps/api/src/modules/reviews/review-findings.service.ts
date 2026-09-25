import { prisma } from '@arxion/database';
import type { AddReviewFindingBody, ResolveFindingBody } from '@arxion/types';
import { emitEvent } from '../../lib/realtime.js';

/**
 * Add a finding (AI, HUMAN, or SYSTEM) to a review.
 */
export async function addFinding(reviewId: string, body: AddReviewFindingBody) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { task: true },
  });
  if (!review) throw Object.assign(new Error(`Review not found: ${reviewId}`), { statusCode: 404 });

  if (review.status !== 'IN_REVIEW' && review.status !== 'PENDING') {
    throw Object.assign(
      new Error(`Cannot add findings to a review in status ${review.status}.`),
      { statusCode: 422 },
    );
  }

  const finding = await prisma.reviewFinding.create({
    data: {
      reviewId: review.id,
      source: body.source,
      category: body.category ?? 'GENERAL',
      severity: body.severity ?? 'MEDIUM',
      title: body.title,
      description: body.description,
      filePath: body.filePath ?? null,
      contractName: body.contractName ?? null,
      isBlocking: body.isBlocking ?? false,
      createdById: body.createdById ?? null,
    },
  });

  await prisma.taskActivity.create({
    data: {
      projectId: review.task.projectId,
      taskId: review.taskId,
      type: 'review.finding_created',
      message: `[${finding.source}] ${finding.severity} finding: "${finding.title}"${finding.isBlocking ? ' (BLOCKING)' : ''}`,
      metadata: { findingId: finding.id, reviewId: review.id, isBlocking: finding.isBlocking },
    },
  });

  emitEvent('review.finding_created', review.task.projectId, {
    reviewId: review.id,
    findingId: finding.id,
    isBlocking: finding.isBlocking,
    severity: finding.severity,
  });

  return finding;
}

/**
 * Get all findings for a review.
 */
export async function getFindings(reviewId: string) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw Object.assign(new Error(`Review not found: ${reviewId}`), { statusCode: 404 });

  return prisma.reviewFinding.findMany({
    where: { reviewId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Resolve or dismiss a finding. Never deletes — preserves audit history.
 */
export async function resolveFinding(findingId: string, body: ResolveFindingBody) {
  const finding = await prisma.reviewFinding.findUnique({
    where: { id: findingId },
    include: { review: { include: { task: true } } },
  });
  if (!finding) throw Object.assign(new Error(`Finding not found: ${findingId}`), { statusCode: 404 });

  if (finding.status !== 'OPEN') {
    throw Object.assign(
      new Error(`Finding ${findingId} is already ${finding.status}.`),
      { statusCode: 422 },
    );
  }

  const updated = await prisma.reviewFinding.update({
    where: { id: findingId },
    data: {
      status: body.status,
      resolvedAt: new Date(),
    },
  });

  await prisma.taskActivity.create({
    data: {
      projectId: finding.review.task.projectId,
      taskId: finding.review.taskId,
      userId: body.resolvedById ?? null,
      type: 'review.finding_resolved',
      message: `Finding "${finding.title}" marked as ${body.status}.`,
      metadata: { findingId: finding.id, reviewId: finding.reviewId, newStatus: body.status },
    },
  });

  emitEvent('review.finding_resolved', finding.review.task.projectId, {
    reviewId: finding.reviewId,
    findingId: finding.id,
    status: body.status,
  });

  return updated;
}
