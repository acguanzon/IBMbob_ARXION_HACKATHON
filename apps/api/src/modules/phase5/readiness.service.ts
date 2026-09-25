/**
 * Task Readiness Engine — Phase 5
 *
 * Calculates a derived readiness state for a task based on:
 * - dependency completion
 * - review state
 * - open coordination risks (HIGH/CRITICAL)
 * - unacknowledged context updates
 * - agent session state (STALE → INTERRUPTED)
 * - pending handoffs
 */
import { prisma } from '@arxion/database'
import { emitEvent } from '../../lib/realtime.js'

type TaskReadinessState = 'READY' | 'BLOCKED_BY_DEPENDENCY' | 'AT_RISK' | 'WAITING_FOR_REVIEW' | 'WAITING_FOR_CONTEXT' | 'INTERRUPTED'

export interface ReadinessResult {
  taskId: string
  state: TaskReadinessState
  reasons: string[]
  sourceRevision: string | null
}

export async function calculateReadiness(taskId: string): Promise<ReadinessResult> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      dependencies: { include: { dependsOn: { select: { id: true, displayId: true, status: true } } } },
      reviews: { orderBy: { createdAt: 'desc' }, take: 1 },
      agentSessions: { where: { status: { in: ['IDLE', 'WORKING', 'WAITING', 'STALE'] } }, orderBy: { lastSeenAt: 'desc' }, take: 1 },
    },
  })
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 })

  const reasons: string[] = []
  let state: TaskReadinessState = 'READY'

  // 1. Stale session → INTERRUPTED
  const latestSession = task.agentSessions[0]
  if (latestSession?.status === 'STALE') {
    state = 'INTERRUPTED'
    reasons.push(`Agent session ${latestSession.id} is stale`)
    return persist(task.id, state, reasons, null)
  }

  // 2. Blocking dependencies
  const blockers = task.dependencies.filter((d) => d.dependsOn.status !== 'DONE')
  if (blockers.length > 0) {
    state = 'BLOCKED_BY_DEPENDENCY'
    blockers.forEach((d) => reasons.push(`Dependency ${d.dependsOn.displayId} is ${d.dependsOn.status}`))
    return persist(task.id, state, reasons, null)
  }

  // 3. Waiting for review
  const latestReview = task.reviews[0]
  if (latestReview && ['PENDING', 'IN_REVIEW', 'CHANGES_REQUESTED'].includes(latestReview.status)) {
    state = 'WAITING_FOR_REVIEW'
    reasons.push(`Review ${latestReview.id} is ${latestReview.status}`)
    return persist(task.id, state, reasons, null)
  }

  // 4. Unacknowledged CRITICAL/HIGH risks
  const criticalRisks = await prisma.coordinationRisk.findMany({
    where: { affectedTaskId: task.id, status: 'OPEN', severity: { in: ['HIGH', 'CRITICAL'] } },
    select: { id: true, title: true, severity: true },
  })
  if (criticalRisks.length > 0) {
    state = 'AT_RISK'
    criticalRisks.forEach((r) => reasons.push(`${r.severity} risk: ${r.title}`))
  }

  // 5. Pending handoffs → WAITING_FOR_CONTEXT (overrides AT_RISK)
  const pendingHandoffs = await prisma.taskHandoff.findMany({
    where: { targetTaskId: task.id, status: { in: ['PENDING', 'DELIVERED'] } },
    select: { id: true, sourceTaskId: true },
    take: 5,
  })
  if (pendingHandoffs.length > 0) {
    state = 'WAITING_FOR_CONTEXT'
    reasons.push(`${pendingHandoffs.length} pending handoff(s) require acknowledgement`)
  }

  // 6. Unread context updates
  const unreadUpdates = await prisma.contextUpdate.count({
    where: { affectedTaskId: task.id, status: { in: ['UNREAD', 'READ'] } },
  })
  if (unreadUpdates > 0 && state === 'READY') {
    state = 'AT_RISK'
    reasons.push(`${unreadUpdates} unread context update(s)`)
  }

  if (reasons.length === 0) {
    reasons.push('All dependencies complete, no HIGH or CRITICAL risks, no pending handoffs')
  }

  // Grab latest git revision for tracing
  const gitLink = await prisma.taskGitLink.findFirst({
    where: { taskId: task.id },
    orderBy: { updatedAt: 'desc' },
    select: { latestCommitSha: true },
  })

  return persist(task.id, state, reasons, gitLink?.latestCommitSha ?? null)
}

async function persist(
  taskId: string,
  state: TaskReadinessState,
  reasons: string[],
  sourceRevision: string | null,
): Promise<ReadinessResult> {
  const evaluation = await prisma.taskReadinessEvaluation.create({
    data: { taskId, state, reasons, sourceRevision },
  })

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } })
  if (task) {
    emitEvent('task.readiness_changed', task.projectId, { taskId, state, reasons })
  }

  return {
    taskId: evaluation.taskId,
    state: evaluation.state as TaskReadinessState,
    reasons: evaluation.reasons as string[],
    sourceRevision: evaluation.sourceRevision,
  }
}

export async function getLatestReadiness(taskId: string): Promise<ReadinessResult | null> {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
    select: { id: true },
  })
  if (!task) return null

  const evaluation = await prisma.taskReadinessEvaluation.findFirst({
    where: { taskId: task.id },
    orderBy: { evaluatedAt: 'desc' },
  })
  if (!evaluation) return null

  return {
    taskId: evaluation.taskId,
    state: evaluation.state as TaskReadinessState,
    reasons: evaluation.reasons as string[],
    sourceRevision: evaluation.sourceRevision,
  }
}
