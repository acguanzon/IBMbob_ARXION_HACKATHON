/**
 * Coordinator Summary Service — Phase 5
 *
 * Produces a lightweight project-level summary of:
 * - READY tasks
 * - WAITING tasks (with reasons)
 * - INTERRUPTED tasks (with recovery availability)
 * - Safe parallel groups
 * - HIGH/CRITICAL risks
 *
 * This is a derived view. It does not make decisions or assignments.
 */
import { prisma } from '@arxion/database'
import { calculateReadiness } from './readiness.service.js'
import { getParallelWorkGroups } from './parallel-safety.service.js'

export async function getCoordinatorSummary(projectId: string) {
  // Get all active tasks
  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      status: { in: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW'] },
    },
    select: { id: true, displayId: true, title: true, status: true },
    orderBy: { createdAt: 'asc' },
    take: 50,
  })

  const readyTasks: Array<{ taskId: string; displayId: string; title: string }> = []
  const waitingTasks: Array<{ taskId: string; displayId: string; title: string; reason: string }> = []
  const interruptedTasks: Array<{ taskId: string; displayId: string; title: string; hasRecovery: boolean }> = []

  for (const task of tasks) {
    const readiness = await calculateReadiness(task.id)

    switch (readiness.state) {
      case 'READY':
        readyTasks.push({ taskId: task.id, displayId: task.displayId, title: task.title })
        break
      case 'INTERRUPTED': {
        const hasRecovery = (await prisma.recoverySnapshot.count({ where: { taskId: task.id } })) > 0
        interruptedTasks.push({ taskId: task.id, displayId: task.displayId, title: task.title, hasRecovery })
        break
      }
      default:
        waitingTasks.push({
          taskId: task.id,
          displayId: task.displayId,
          title: task.title,
          reason: readiness.reasons[0] ?? readiness.state,
        })
    }
  }

  // Safe parallel groups
  const safeParallelGroups = await getParallelWorkGroups(projectId)

  // High risks
  const highRisks = await prisma.coordinationRisk.findMany({
    where: { projectId, status: 'OPEN', severity: { in: ['HIGH', 'CRITICAL'] } },
    select: { id: true, title: true, severity: true, type: true, sourceTaskId: true, affectedTaskId: true },
    orderBy: { detectedAt: 'desc' },
    take: 10,
  })

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    readyTasks,
    waitingTasks,
    interruptedTasks,
    safeParallelGroups,
    highRisks,
  }
}
