/**
 * Recovery Service — Phase 5
 *
 * Handles:
 * - Creating RecoverySnapshot when a session goes stale / ends unexpectedly
 * - getRecoveryContext — returns snapshot + delta (what changed while away)
 * - resumeTask — starts a new agent session, loads context, computes delta
 *
 * Recovery rules:
 * - Stale reservations are NOT automatically inherited
 * - The new session gets current context + recovery history
 * - Delta shows what changed since the snapshot was taken
 */
import { prisma, Prisma } from '@arxion/database'
import { emitEvent } from '../../lib/realtime.js'
import { buildContextPackage } from './context-package.service.js'

// ─── Create snapshot ─────────────────────────────────────────────────────────

export async function createRecoverySnapshot(opts: {
  taskId: string
  previousAgentSessionId: string
  trigger: 'SESSION_STALE' | 'SESSION_ENDED_UNEXPECTEDLY' | 'USER_PAUSED'
}): Promise<void> {
  const { taskId, previousAgentSessionId, trigger } = opts

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true },
  })
  if (!task) return

  // Gather snapshot data
  const [intent, actualChanges, contracts, risks, contextUpdates, handoffs, gitLink] = await Promise.all([
    prisma.taskWorkIntent.findUnique({ where: { taskId } }),
    prisma.taskActualChange.findMany({
      where: { taskId },
      select: { filePath: true, changeType: true },
      distinct: ['filePath'],
    }),
    prisma.taskContract.findMany({
      where: { taskId },
      select: { id: true, name: true, type: true, relationship: true },
    }),
    prisma.coordinationRisk.findMany({
      where: { affectedTaskId: taskId, status: 'OPEN' },
      select: { id: true, title: true, severity: true, type: true },
    }),
    prisma.contextUpdate.findMany({
      where: { affectedTaskId: taskId, status: { in: ['UNREAD', 'READ'] } },
      select: { id: true, title: true, type: true, createdAt: true },
    }),
    prisma.taskHandoff.findMany({
      where: { targetTaskId: taskId, status: { in: ['PENDING', 'DELIVERED'] } },
      select: { id: true, sourceTaskId: true, summary: true },
    }),
    prisma.taskGitLink.findFirst({
      where: { taskId },
      orderBy: { updatedAt: 'desc' },
      select: { latestCommitSha: true },
    }),
  ])

  // Get last progress message from activities
  const lastActivity = await prisma.taskActivity.findFirst({
    where: { taskId, type: 'progress' },
    orderBy: { createdAt: 'desc' },
    select: { message: true },
  })

  const snapshot = await prisma.recoverySnapshot.create({
    data: {
      taskId,
      projectId: task.projectId,
      previousAgentSessionId,
      trigger,
      lastKnownRevision: gitLink?.latestCommitSha ?? null,
      lastProgressMessage: lastActivity?.message ?? null,
      activeWorkIntent: intent
        ? ({ files: intent.files, apis: intent.apis, models: intent.models } as Prisma.InputJsonValue)
        : Prisma.DbNull,
      actualScope: actualChanges.map((c) => c.filePath) as Prisma.InputJsonValue,
      activeContracts: contracts as unknown as Prisma.InputJsonValue,
      openRisks: risks as unknown as Prisma.InputJsonValue,
      pendingContextUpdates: contextUpdates as unknown as Prisma.InputJsonValue,
      pendingHandoffs: handoffs as unknown as Prisma.InputJsonValue,
    },
  })

  emitEvent('recovery_snapshot.created', task.projectId, {
    snapshotId: snapshot.id,
    taskId,
    trigger,
    previousAgentSessionId,
  })
}

// ─── Get recovery context ────────────────────────────────────────────────────

export async function getRecoveryContext(taskId: string) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
    select: { id: true, projectId: true },
  })
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 })

  const snapshot = await prisma.recoverySnapshot.findFirst({
    where: { taskId: task.id },
    orderBy: { createdAt: 'desc' },
  })
  if (!snapshot) {
    throw Object.assign(new Error(`No recovery snapshot for task: ${taskId}`), { statusCode: 404 })
  }

  const delta = await computeDelta(snapshot)
  const currentContext = await buildContextPackage(task.id)

  return { snapshot, delta, currentContext }
}

// ─── Resume task ──────────────────────────────────────────────────────────────

export async function resumeTask(opts: {
  taskId: string
  userId: string
  agentType?: string
}) {
  const { taskId, userId, agentType = 'IBM_BOB' } = opts

  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  })
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 })

  emitEvent('task.resume_started', task.projectId, { taskId: task.id, userId })

  // Create a fresh agent session — do NOT inherit old reservations
  const session = await prisma.agentSession.create({
    data: {
      projectId: task.projectId,
      userId,
      taskId: task.id,
      agentType: agentType as 'IBM_BOB' | 'CURSOR' | 'CLAUDE_CODE' | 'OTHER',
      status: 'WORKING',
    },
  })

  // Load snapshot and compute delta
  const snapshot = await prisma.recoverySnapshot.findFirst({
    where: { taskId: task.id },
    orderBy: { createdAt: 'desc' },
  })

  const delta = snapshot ? await computeDelta(snapshot) : null

  // Build fresh context package
  const contextPackage = await buildContextPackage(task.id)

  await prisma.taskActivity.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      userId,
      agentSessionId: session.id,
      type: 'resume',
      message: `Task resumed by new agent session ${session.id}`,
    },
  })

  emitEvent('task.resume_completed', task.projectId, {
    taskId: task.id,
    sessionId: session.id,
    hasDelta: !!delta,
  })

  return { session, snapshot, delta, contextPackage }
}

// ─── Delta computation ────────────────────────────────────────────────────────

async function computeDelta(snapshot: {
  taskId: string
  createdAt: Date
  lastKnownRevision: unknown
}) {
  const since = snapshot.createdAt

  const [newDecisions, newRisks, newContextUpdates, newHandoffs] = await Promise.all([
    prisma.projectDecision.findMany({
      where: {
        createdAt: { gt: since },
      },
      select: { id: true, title: true, decision: true, createdAt: true },
      take: 10,
    }),
    prisma.coordinationRisk.findMany({
      where: {
        affectedTaskId: snapshot.taskId,
        detectedAt: { gt: since },
      },
      select: { id: true, title: true, severity: true, type: true },
      take: 10,
    }),
    prisma.contextUpdate.findMany({
      where: {
        affectedTaskId: snapshot.taskId,
        createdAt: { gt: since },
      },
      select: { id: true, title: true, type: true, createdAt: true },
      take: 10,
    }),
    prisma.taskHandoff.findMany({
      where: {
        targetTaskId: snapshot.taskId,
        createdAt: { gt: since },
      },
      select: { id: true, summary: true, status: true },
      take: 10,
    }),
  ])

  // Estimate commits advanced (if we have git data)
  const currentRevision = await prisma.taskGitLink.findFirst({
    where: { taskId: snapshot.taskId },
    orderBy: { updatedAt: 'desc' },
    select: { aheadCount: true, behindCount: true },
  })
  const branchAdvancedBy = currentRevision?.behindCount ?? 0

  return {
    newDecisions,
    newRisks,
    branchAdvancedBy,
    newContextUpdates,
    newHandoffs,
  }
}
