/**
 * Branch Divergence Service — Phase 4
 *
 * Detects branch divergence against the base branch using the Git provider.
 * Updates TaskGitLink with ahead/behind counts.
 */
import { prisma } from '@arxion/database'
import { createGitHubProvider } from '../../lib/git-provider.js'
import { emitEvent } from '../../lib/realtime.js'
import type { BranchStatus } from '@arxion/types'

/**
 * Check branch divergence for a task.
 * Uses the connected ProjectRepository's provider.
 */
export async function checkBranchDivergence(taskId: string): Promise<BranchStatus> {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  })
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 })

  const gitLink = await prisma.taskGitLink.findFirst({
    where: { taskId: task.id },
    orderBy: { updatedAt: 'desc' },
    include: { repository: true },
  })

  if (!gitLink || !gitLink.branchName || !gitLink.baseBranch || !gitLink.repository) {
    return {
      taskId: task.id,
      branchName: gitLink?.branchName ?? null,
      baseBranch: gitLink?.baseBranch ?? null,
      aheadCount: gitLink?.aheadCount ?? null,
      behindCount: gitLink?.behindCount ?? null,
      latestCommitSha: gitLink?.latestCommitSha ?? null,
      divergenceCheckedAt: gitLink?.divergenceCheckedAt?.toISOString() ?? null,
      isDiverged: (gitLink?.behindCount ?? 0) > 0,
    }
  }

  try {
    const provider = createGitHubProvider()
    const comparison = await provider.getBranchComparison(
      gitLink.repository.owner,
      gitLink.repository.repository,
      gitLink.baseBranch,
      gitLink.branchName,
    )

    const isDiverged = comparison.behindBy > 0

    await prisma.taskGitLink.update({
      where: { id: gitLink.id },
      data: {
        aheadCount: comparison.aheadBy,
        behindCount: comparison.behindBy,
        divergenceCheckedAt: new Date(),
      },
    })

    if (isDiverged) {
      emitEvent('branch.diverged', task.projectId, {
        taskId: task.id,
        branchName: gitLink.branchName,
        baseBranch: gitLink.baseBranch,
        behindCount: comparison.behindBy,
        aheadCount: comparison.aheadBy,
      })

      // Check if relevant contracts changed in the upstream commits
      const relevantUpstreamFiles = comparison.files.map((f) => f.filename)
      if (relevantUpstreamFiles.length > 0) {
        await checkMergeRisk(task.projectId, task.id, relevantUpstreamFiles, gitLink)
      }
    }

    return {
      taskId: task.id,
      branchName: gitLink.branchName,
      baseBranch: gitLink.baseBranch,
      aheadCount: comparison.aheadBy,
      behindCount: comparison.behindBy,
      latestCommitSha: gitLink.latestCommitSha,
      divergenceCheckedAt: new Date().toISOString(),
      isDiverged,
    }
  } catch {
    // If GitHub API fails (no token, rate limit, etc.) return stored data
    return {
      taskId: task.id,
      branchName: gitLink.branchName,
      baseBranch: gitLink.baseBranch,
      aheadCount: gitLink.aheadCount,
      behindCount: gitLink.behindCount,
      latestCommitSha: gitLink.latestCommitSha,
      divergenceCheckedAt: gitLink.divergenceCheckedAt?.toISOString() ?? null,
      isDiverged: (gitLink.behindCount ?? 0) > 0,
    }
  }
}

/**
 * Detect basic merge risks when a branch is behind base.
 * If upstream files are also modified by this task → MERGE_CONFLICT risk.
 */
async function checkMergeRisk(
  projectId: string,
  taskId: string,
  upstreamFiles: string[],
  gitLink: { id: string; branchName: string | null },
): Promise<void> {
  const taskActualFiles = await prisma.taskActualChange.findMany({
    where: { taskId },
    select: { filePath: true },
  })

  const taskFileSet = new Set(taskActualFiles.map((c) => c.filePath))
  const overlapping = upstreamFiles.filter((f) => taskFileSet.has(f))

  if (overlapping.length === 0) return

  // Find what other tasks worked on these upstream files
  for (const filePath of overlapping) {
    const otherChanges = await prisma.taskActualChange.findMany({
      where: {
        filePath,
        NOT: { taskId },
        task: { projectId, status: { in: ['IN_PROGRESS', 'REVIEW', 'DONE'] } },
      },
      include: { task: { select: { id: true, displayId: true, status: true } } },
      distinct: ['taskId'],
    })

    for (const change of otherChanges) {
      if (change.task.id === taskId) continue

      const existing = await prisma.coordinationRisk.findFirst({
        where: {
          projectId,
          sourceTaskId: change.task.id,
          affectedTaskId: taskId,
          type: 'MERGE_CONFLICT',
          status: 'OPEN',
        },
      })
      if (existing) continue

      const risk = await prisma.coordinationRisk.create({
        data: {
          projectId,
          sourceTaskId: change.task.id,
          affectedTaskId: taskId,
          type: 'MERGE_CONFLICT',
          severity: 'HIGH',
          confidence: 'MEDIUM',
          title: `Potential merge conflict: ${filePath}`,
          description: `Branch "${gitLink.branchName}" is behind base. Upstream changes to "${filePath}" may conflict with this task's modifications.`,
          status: 'OPEN',
        },
      })

      emitEvent('merge_risk.detected', projectId, {
        riskId: risk.id,
        taskId,
        filePath,
        upstreamTaskId: change.task.id,
      })
    }
  }
}
