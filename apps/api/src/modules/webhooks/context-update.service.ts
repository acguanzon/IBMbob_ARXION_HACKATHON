/**
 * Context Update Service — Phase 4
 *
 * Manages ContextUpdate records — notifications delivered to affected tasks/agents.
 */
import { prisma } from '@arxion/database'
import { emitEvent } from '../../lib/realtime.js'

/**
 * Get all context updates for a task.
 */
export async function getContextUpdates(taskId: string, status?: string) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  })
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 })

  return prisma.contextUpdate.findMany({
    where: {
      affectedTaskId: task.id,
      ...(status ? { status: status as 'UNREAD' | 'READ' | 'ACKNOWLEDGED' | 'RESOLVED' } : {}),
    },
    include: {
      sourceTask: { select: { id: true, displayId: true, title: true } },
      entity: { select: { id: true, name: true, type: true, filePath: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Get unread context updates for a task.
 */
export async function getUnreadContextUpdates(taskId: string) {
  return getContextUpdates(taskId, 'UNREAD')
}

/**
 * Acknowledge a context update.
 * Optionally pass projectId to enforce cross-project access control.
 */
export async function acknowledgeContextUpdate(
  updateId: string,
  status: 'READ' | 'ACKNOWLEDGED' | 'RESOLVED',
  callerProjectId?: string,
) {
  const update = await prisma.contextUpdate.findUnique({ where: { id: updateId } })
  if (!update) throw Object.assign(new Error(`Context update not found: ${updateId}`), { statusCode: 404 })

  // Cross-project access guard
  if (callerProjectId && update.projectId !== callerProjectId) {
    throw Object.assign(new Error('Access denied: context update belongs to a different project.'), { statusCode: 403 })
  }

  const updated = await prisma.contextUpdate.update({
    where: { id: updateId },
    data: {
      status,
      acknowledgedAt: status !== 'READ' ? new Date() : undefined,
    },
  })

  emitEvent('context_update.acknowledged', update.projectId, {
    updateId,
    affectedTaskId: update.affectedTaskId,
    status,
  })

  return updated
}
