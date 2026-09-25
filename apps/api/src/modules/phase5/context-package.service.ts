/**
 * Context Package Service — Phase 5
 *
 * Builds, versions, and supersedes TaskContextPackage records.
 * A context package is a structured, noise-controlled bundle of
 * all relevant project context for a task.
 *
 * Sections:
 *   critical   — things that require action before work can proceed
 *   important  — things that affect the work but aren't blockers
 *   background — informational context
 */
import { prisma } from '@arxion/database'
import type { Prisma } from '@arxion/database'
import { emitEvent } from '../../lib/realtime.js'
import { calculateReadiness } from './readiness.service.js'
import { checkBranchDivergence } from '../git/branch-divergence.service.js'
import { getActualScopeAnalysis } from '../webhooks/actual-changes.service.js'

// ─── Build + Persist ─────────────────────────────────────────────────────────

export async function buildContextPackage(taskId: string) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
    include: {
      project: true,
      dependencies: {
        include: {
          dependsOn: { select: { id: true, displayId: true, title: true, status: true } },
        },
      },
    },
  })
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 })

  // Supersede current packages
  await prisma.taskContextPackage.updateMany({
    where: { taskId: task.id, status: 'CURRENT' },
    data: { status: 'SUPERSEDED', supersededAt: new Date() },
  })

  // Determine next version
  const count = await prisma.taskContextPackage.count({ where: { taskId: task.id } })
  const version = count + 1

  // Gather all context in parallel
  const [readiness, pendingHandoffs, contracts, decisions, risks, contextUpdates, activeAgents, recoverySnapshot] =
    await Promise.all([
      calculateReadiness(task.id),
      prisma.taskHandoff.findMany({
        where: { targetTaskId: task.id, status: { in: ['PENDING', 'DELIVERED'] } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.taskContract.findMany({
        where: { taskId: task.id },
        select: { id: true, name: true, type: true, relationship: true },
      }),
      // Decisions scoped to this task + project-global ones
      prisma.projectDecision.findMany({
        where: {
          projectId: task.projectId,
          status: 'ACTIVE',
          OR: [{ taskId: task.id }, { taskId: null }],
        },
        select: { id: true, title: true, decision: true, reason: true },
        take: 20,
      }),
      prisma.coordinationRisk.findMany({
        where: {
          OR: [{ sourceTaskId: task.id }, { affectedTaskId: task.id }],
          status: 'OPEN',
        },
        select: { id: true, title: true, severity: true, type: true, description: true },
        orderBy: { detectedAt: 'desc' },
      }),
      prisma.contextUpdate.findMany({
        where: { affectedTaskId: task.id, status: { in: ['UNREAD', 'READ'] } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.agentSession.findMany({
        where: {
          projectId: task.projectId,
          status: { in: ['WORKING', 'WAITING'] },
          NOT: { taskId: task.id },
        },
        select: { id: true, taskId: true, agentType: true, lastSeenAt: true },
        take: 10,
      }),
      prisma.recoverySnapshot.findFirst({
        where: { taskId: task.id },
        orderBy: { createdAt: 'desc' },
      }),
    ])

  // Branch status (non-throwing)
  let branchStatus: Record<string, unknown> | null = null
  try {
    branchStatus = await checkBranchDivergence(task.id) as unknown as Record<string, unknown>
  } catch {
    branchStatus = null
  }

  // Actual scope (non-throwing)
  let actualScope: Record<string, unknown> | null = null
  try {
    actualScope = await getActualScopeAnalysis(task.id) as unknown as Record<string, unknown>
  } catch {
    actualScope = null
  }

  // Get latest git revision
  const gitLink = await prisma.taskGitLink.findFirst({
    where: { taskId: task.id },
    orderBy: { updatedAt: 'desc' },
    select: { latestCommitSha: true },
  })

  // ─── Noise controls ───────────────────────────────────────────────────────
  const critical: string[] = []
  const important: string[] = []
  const background: string[] = []

  if (pendingHandoffs.length > 0) {
    critical.push(`${pendingHandoffs.length} pending handoff(s) require acknowledgement before starting work`)
  }
  const criticalRisks = risks.filter((r) => ['HIGH', 'CRITICAL'].includes(r.severity))
  if (criticalRisks.length > 0) {
    critical.push(...criticalRisks.map((r) => `${r.severity} risk: ${r.title}`))
  }
  if ((branchStatus as { behindCount?: number } | null)?.behindCount && (branchStatus as { behindCount: number }).behindCount > 0) {
    important.push(`Branch is ${(branchStatus as { behindCount: number }).behindCount} commit(s) behind base`)
  }
  if (contextUpdates.length > 0) {
    important.push(`${contextUpdates.length} unread context update(s)`)
  }
  decisions.forEach((d) => background.push(`Decision: ${d.title}`))

  const contentPayload = {
    task: {
      id: task.id,
      displayId: task.displayId,
      title: task.title,
      status: task.status,
      description: task.description,
    },
    readiness: {
      state: readiness.state,
      reasons: readiness.reasons,
      evaluatedAt: new Date().toISOString(),
    },
    dependencies: task.dependencies.map((d) => d.dependsOn),
    pendingHandoffs,
    activeContracts: contracts,
    relevantDecisions: decisions,
    openRisks: risks,
    unreadContextUpdates: contextUpdates,
    branchStatus: branchStatus as Prisma.InputJsonValue | null,
    actualScope: actualScope as Prisma.InputJsonValue | null,
    activeAgents,
    recoveryState: recoverySnapshot
      ? {
          hasPreviousSession: true,
          trigger: recoverySnapshot.trigger,
          lastKnownRevision: recoverySnapshot.lastKnownRevision,
          lastProgressMessage: recoverySnapshot.lastProgressMessage,
          createdAt: recoverySnapshot.createdAt.toISOString(),
        }
      : null,
    critical,
    important,
    background,
  }

  const pkg = await prisma.taskContextPackage.create({
    data: {
      taskId: task.id,
      contextVersion: version,
      sourceProjectRevision: gitLink?.latestCommitSha ?? null,
      status: 'CURRENT',
      content: contentPayload as unknown as Prisma.InputJsonValue,
    },
  })

  emitEvent('context_package.generated', task.projectId, {
    taskId: task.id,
    packageId: pkg.id,
    contextVersion: version,
    readinessState: readiness.state,
  })

  return pkg
}

export async function getCurrentContextPackage(taskId: string) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
    select: { id: true },
  })
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 })

  return prisma.taskContextPackage.findFirst({
    where: { taskId: task.id, status: 'CURRENT' },
    orderBy: { contextVersion: 'desc' },
  })
}
