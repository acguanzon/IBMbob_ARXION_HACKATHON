/**
 * Handoff Service — Phase 5
 *
 * Creates, delivers, acknowledges, and supersedes TaskHandoff records.
 * A handoff is automatically created when an upstream task completes
 * and a downstream task depends on it or consumes its contracts.
 */
import { prisma } from '@arxion/database'
import type { Prisma } from '@arxion/database'
import { emitEvent } from '../../lib/realtime.js'
import { calculateReadiness } from './readiness.service.js'

interface HandoffPayload {
  sourceTaskDisplayId: string
  targetTaskDisplayId: string
  completedRevision: string | null
  finalContracts: Array<{ name: string; type: string; relationship: string }>
  relevantDecisions: Array<{ title: string; decision: string }>
  relevantChanges: Array<{ filePath: string; changeType: string }>
  resolvedRisks: Array<{ title: string }>
  remainingRisks: Array<{ title: string; severity: string }>
  recommendedNextCheck: string | null
}

// ─── Create handoffs when a task completes ───────────────────────────────────

export async function createHandoffsForCompletedTask(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: true,
      dependents: {
        include: {
          task: { select: { id: true, displayId: true, title: true, status: true } },
        },
      },
    },
  })
  if (!task) return

  const providedContracts = await prisma.taskContract.findMany({
    where: { taskId: task.id, relationship: { in: ['PROVIDES', 'MODIFIES'] } },
    select: { name: true, type: true },
  })
  const contractConsumers = providedContracts.length === 0 ? [] : await prisma.task.findMany({
    where: {
      projectId: task.projectId,
      id: { not: task.id },
      contracts: { some: { relationship: 'CONSUMES', OR: providedContracts.map((contract) => ({ name: contract.name, type: contract.type })) } },
    },
    select: { id: true, displayId: true, title: true, status: true },
  })
  const downstreamTasks = [...new Map(
    [...task.dependents.map((d) => d.task), ...contractConsumers].map((target) => [target.id, target]),
  ).values()]

  for (const target of downstreamTasks) {
    // Skip already-done targets
    if (target.status === 'DONE') continue

    // Check if a non-superseded handoff already exists
    const existing = await prisma.taskHandoff.findFirst({
      where: {
        projectId: task.projectId,
        sourceTaskId: task.id,
        targetTaskId: target.id,
        status: { notIn: ['SUPERSEDED'] },
      },
    })
    if (existing) continue

    const payload = await buildHandoffPayload(task, target)

    const handoff = await prisma.taskHandoff.create({
      data: {
        projectId: task.projectId,
        sourceTaskId: task.id,
        targetTaskId: target.id,
        sourceRevision: await getLatestRevision(task.id),
        status: 'PENDING',
        summary: `Handoff from ${task.displayId} to ${target.displayId}: ${task.title} completed`,
        payload: payload as unknown as Prisma.InputJsonValue,
        deliveredAt: new Date(),
      },
    })

    emitEvent('handoff.created', task.projectId, {
      handoffId: handoff.id,
      sourceTaskId: task.id,
      targetTaskId: target.id,
    })

    // Recalculate target readiness (may flip to WAITING_FOR_CONTEXT)
    await calculateReadiness(target.id)
  }
}

// ─── Build payload ───────────────────────────────────────────────────────────

async function buildHandoffPayload(
  sourceTask: { id: string; displayId: string; projectId: string },
  targetTask: { id: string; displayId: string },
): Promise<HandoffPayload> {
  const [contracts, decisions, actualChanges, resolvedRisks, remainingRisks] = await Promise.all([
    // Contracts provided/modified by source task that target consumes
    prisma.taskContract.findMany({
      where: { taskId: sourceTask.id, relationship: { in: ['PROVIDES', 'MODIFIES'] } },
      select: { name: true, type: true, relationship: true },
    }),
    // Relevant decisions scoped to source task
    prisma.projectDecision.findMany({
      where: { taskId: sourceTask.id, status: 'ACTIVE' },
      select: { title: true, decision: true },
    }),
    // Actual file changes
    prisma.taskActualChange.findMany({
      where: { taskId: sourceTask.id },
      select: { filePath: true, changeType: true },
      distinct: ['filePath'],
      take: 20,
    }),
    // Resolved coordination risks on source task
    prisma.coordinationRisk.findMany({
      where: { sourceTaskId: sourceTask.id, status: { in: ['RESOLVED', 'ACKNOWLEDGED'] } },
      select: { title: true },
      take: 10,
    }),
    // Open risks that target task needs to be aware of
    prisma.coordinationRisk.findMany({
      where: { affectedTaskId: targetTask.id, status: 'OPEN' },
      select: { title: true, severity: true },
      take: 10,
    }),
  ])

  return {
    sourceTaskDisplayId: sourceTask.displayId,
    targetTaskDisplayId: targetTask.displayId,
    completedRevision: await getLatestRevision(sourceTask.id),
    finalContracts: contracts.map((c) => ({
      name: c.name,
      type: c.type,
      relationship: c.relationship,
    })),
    relevantDecisions: decisions.map((d) => ({ title: d.title, decision: d.decision })),
    relevantChanges: actualChanges.map((c) => ({ filePath: c.filePath, changeType: c.changeType })),
    resolvedRisks: resolvedRisks.map((r) => ({ title: r.title })),
    remainingRisks: remainingRisks.map((r) => ({ title: r.title, severity: r.severity })),
    recommendedNextCheck:
      contracts.length > 0
        ? `Validate integration against ${contracts.map((c) => c.name).join(', ')}`
        : null,
  }
}

// ─── Get handoffs ─────────────────────────────────────────────────────────────

export async function getTaskHandoffs(taskId: string) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  })
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 })

  return prisma.taskHandoff.findMany({
    where: {
      OR: [{ sourceTaskId: task.id }, { targetTaskId: task.id }],
      status: { not: 'SUPERSEDED' },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getHandoff(handoffId: string) {
  const handoff = await prisma.taskHandoff.findUnique({ where: { id: handoffId } })
  if (!handoff) throw Object.assign(new Error(`Handoff not found: ${handoffId}`), { statusCode: 404 })
  return handoff
}

// ─── Acknowledge ──────────────────────────────────────────────────────────────

export async function acknowledgeHandoff(handoffId: string, agentSessionId?: string) {
  const handoff = await prisma.taskHandoff.findUnique({ where: { id: handoffId } })
  if (!handoff) throw Object.assign(new Error(`Handoff not found: ${handoffId}`), { statusCode: 404 })
  if (handoff.status === 'ACKNOWLEDGED') return handoff
  if (handoff.status === 'SUPERSEDED') {
    throw Object.assign(new Error('Cannot acknowledge a superseded handoff'), { statusCode: 409 })
  }

  const updated = await prisma.taskHandoff.update({
    where: { id: handoffId },
    data: {
      status: 'ACKNOWLEDGED',
      acknowledgedAt: new Date(),
      acknowledgedByAgentSessionId: agentSessionId ?? null,
    },
  })

  emitEvent('handoff.acknowledged', updated.projectId, {
    handoffId,
    targetTaskId: updated.targetTaskId,
    agentSessionId,
  })

  // Recalculate readiness for the target task (may flip to READY)
  await calculateReadiness(updated.targetTaskId)

  return updated
}

// ─── Supersede ────────────────────────────────────────────────────────────────

export async function supersedeHandoff(oldHandoffId: string, newHandoffId: string): Promise<void> {
  const old = await prisma.taskHandoff.findUnique({ where: { id: oldHandoffId } })
  if (!old) return
  if (old.status === 'ACKNOWLEDGED') return // Never silently mutate acknowledged handoffs

  await prisma.taskHandoff.update({
    where: { id: oldHandoffId },
    data: { status: 'SUPERSEDED', supersededById: newHandoffId },
  })

  emitEvent('handoff.superseded', old.projectId, { oldHandoffId, newHandoffId })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getLatestRevision(taskId: string): Promise<string | null> {
  const link = await prisma.taskGitLink.findFirst({
    where: { taskId },
    orderBy: { updatedAt: 'desc' },
    select: { latestCommitSha: true },
  })
  return link?.latestCommitSha ?? null
}
