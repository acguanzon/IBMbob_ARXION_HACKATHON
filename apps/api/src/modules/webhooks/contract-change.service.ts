/**
 * Contract Change Detection Service — Phase 4
 *
 * Detects changes to exported contracts (types, interfaces, models, APIs)
 * and links them to affected consumers.
 */
import { prisma } from '@arxion/database'
import { emitEvent } from '../../lib/realtime.js'
import type { ActualChangeInput } from './actual-changes.service.js'

/**
 * Detect contract changes based on changed files and known entities.
 * For each modified/deleted file that has associated CodeEntities, record a ContractChange
 * and trigger impact analysis.
 */
export async function detectContractChanges(opts: {
  projectId: string
  taskId: string
  files: ActualChangeInput[]
}): Promise<void> {
  const { projectId, taskId, files } = opts

  const modifiedOrDeleted = files.filter(
    (f) => f.changeType === 'MODIFIED' || f.changeType === 'DELETED',
  )
  if (modifiedOrDeleted.length === 0) return

  for (const file of modifiedOrDeleted) {
    // Find all code entities in this file that are TYPE, MODEL, SCHEMA, API
    const entities = await prisma.codeEntity.findMany({
      where: {
        projectId,
        filePath: file.filePath,
        type: { in: ['TYPE', 'MODEL', 'SCHEMA', 'API'] },
      },
    })

    for (const entity of entities) {
      const changeKind = file.changeType === 'DELETED' ? 'REMOVED' : 'MODIFIED'

      // Avoid duplicate ContractChanges for the same task+entity in rapid succession
      const existing = await prisma.contractChange.findFirst({
        where: {
          taskId,
          entityId: entity.id,
          changeKind,
          detectedAt: { gte: new Date(Date.now() - 60_000) }, // within last minute
        },
      })
      if (existing) continue

      const contractChange = await prisma.contractChange.create({
        data: {
          projectId,
          taskId,
          entityId: entity.id,
          changeKind,
          breaking: changeKind === 'REMOVED' ? true : null, // REMOVED is always breaking; MODIFIED is undetermined
          confidence: 'HIGH',
        },
      })

      emitEvent('contract.change_detected', projectId, {
        taskId,
        entityId: entity.id,
        entityName: entity.name,
        entityType: entity.type,
        changeKind,
        contractChangeId: contractChange.id,
      })

      // Run impact analysis for this entity
      await runImpactAnalysis({ projectId, taskId, entity, contractChange })
    }
  }
}

// ─── Impact Analysis ─────────────────────────────────────────────────────────

/**
 * Find all tasks that consume the changed entity and create:
 * 1. CoordinationRisk records
 * 2. ContextUpdate records for affected agents
 */
async function runImpactAnalysis(opts: {
  projectId: string
  taskId: string
  entity: { id: string; name: string; type: string; filePath: string }
  contractChange: { id: string; changeKind: string; breaking: boolean | null }
}): Promise<void> {
  const { projectId, taskId, entity, contractChange } = opts

  // Find entities that CONSUME or IMPORTS or DEPENDS_ON this entity
  const consumerRelationships = await prisma.codeRelationship.findMany({
    where: {
      targetEntityId: entity.id,
      relationship: { in: ['CONSUMES', 'IMPORTS', 'DEPENDS_ON'] },
    },
    include: { sourceEntity: true },
  })

  // Also find tasks that declare CONSUMES contract relationship (Phase 2 declared contracts)
  const declaredConsumers = await prisma.taskContract.findMany({
    where: {
      projectId,
      name: entity.name,
      relationship: 'CONSUMES',
      NOT: { taskId },
    },
    include: { task: true },
  })

  // Gather all affected task IDs
  const affectedTaskIds = new Set<string>()

  // From code relationships: find active tasks that own consumer files
  for (const rel of consumerRelationships) {
    const activeTasks = await prisma.task.findMany({
      where: {
        projectId,
        status: { in: ['IN_PROGRESS', 'REVIEW'] },
        NOT: { id: taskId },
        workIntents: {
          some: {
            files: { has: rel.sourceEntity.filePath },
          },
        },
      },
      select: { id: true },
    })
    activeTasks.forEach((t) => affectedTaskIds.add(t.id))
  }

  // From declared contracts: add tasks that explicitly declared CONSUMES
  for (const dc of declaredConsumers) {
    if (dc.task.status === 'IN_PROGRESS' || dc.task.status === 'REVIEW') {
      affectedTaskIds.add(dc.taskId)
    }
  }

  if (affectedTaskIds.size === 0) return

  const severity = contractChange.breaking === true ? 'CRITICAL' : 'HIGH'
  const riskTitle = `${entity.name} changed by another task`
  const riskDesc = `Task changed ${entity.type} "${entity.name}" (${entity.filePath}). Change kind: ${contractChange.changeKind}.`

  for (const affectedTaskId of affectedTaskIds) {
    // Avoid duplicate open risks
    const existingRisk = await prisma.coordinationRisk.findFirst({
      where: {
        projectId,
        sourceTaskId: taskId,
        affectedTaskId,
        type: 'CONTRACT_CHANGE',
        sourceEntityId: entity.id,
        status: 'OPEN',
      },
    })

    let riskId: string
    if (existingRisk) {
      await prisma.coordinationRisk.update({
        where: { id: existingRisk.id },
        data: { severity, description: riskDesc },
      })
      riskId = existingRisk.id
      emitEvent('risk.updated', projectId, { riskId, sourceTaskId: taskId, affectedTaskId })
    } else {
      const risk = await prisma.coordinationRisk.create({
        data: {
          projectId,
          sourceTaskId: taskId,
          affectedTaskId,
          type: 'CONTRACT_CHANGE',
          severity,
          confidence: 'HIGH',
          title: riskTitle,
          description: riskDesc,
          sourceEntityId: entity.id,
          status: 'OPEN',
        },
      })
      riskId = risk.id
      emitEvent('risk.created', projectId, { riskId, sourceTaskId: taskId, affectedTaskId })

      // Coordination metric: log risk creation in activity feed
      await prisma.taskActivity.create({
        data: {
          projectId,
          taskId,
          type: 'risk.created',
          message: `Coordination risk detected: [${severity}] ${entity.name} changed — affects task ${affectedTaskId}`,
          metadata: { riskId, riskType: 'CONTRACT_CHANGE', affectedTaskId, severity, entityName: entity.name },
        },
      })
    }

    // Avoid duplicate UNREAD context updates
    const existingUpdate = await prisma.contextUpdate.findFirst({
      where: {
        projectId,
        sourceTaskId: taskId,
        affectedTaskId,
        entityId: entity.id,
        status: { in: ['UNREAD', 'READ'] },
      },
    })
    if (existingUpdate) continue

    const affectedTask = await prisma.task.findUnique({
      where: { id: affectedTaskId },
      select: { displayId: true },
    })
    const sourceTask = await prisma.task.findUnique({
      where: { id: taskId },
      select: { displayId: true },
    })

    const update = await prisma.contextUpdate.create({
      data: {
        projectId,
        sourceTaskId: taskId,
        affectedTaskId,
        type: 'CONTRACT_CHANGE',
        title: `${entity.name} was changed`,
        message: `Task ${sourceTask?.displayId ?? taskId} modified ${entity.type} "${entity.name}". Your task (${affectedTask?.displayId ?? affectedTaskId}) consumes this contract. Re-check your integration before continuing.`,
        entityId: entity.id,
        riskId,
        status: 'UNREAD',
      },
    })

    emitEvent('context_update.created', projectId, {
      updateId: update.id,
      affectedTaskId,
      sourceTaskId: taskId,
      entityName: entity.name,
    })

    // Coordination metric: log context update delivery in activity feed
    await prisma.taskActivity.create({
      data: {
        projectId,
        taskId: affectedTaskId,
        type: 'context_update.delivered',
        message: `Context update delivered: ${entity.name} changed by another task`,
        metadata: { updateId: update.id, sourceTaskId: taskId, entityName: entity.name, entityType: entity.type },
      },
    })
  }
}

/**
 * Get impact analysis for a specific code entity.
 */
export async function getImpactAnalysis(entityId: string) {
  const entity = await prisma.codeEntity.findUnique({ where: { id: entityId } })
  if (!entity) throw Object.assign(new Error(`Entity not found: ${entityId}`), { statusCode: 404 })

  const consumerRelationships = await prisma.codeRelationship.findMany({
    where: {
      targetEntityId: entityId,
      relationship: { in: ['CONSUMES', 'IMPORTS', 'DEPENDS_ON'] },
    },
    include: { sourceEntity: true },
  })

  const result = await Promise.all(
    consumerRelationships.map(async (rel) => {
      const activeTasks = await prisma.task.findMany({
        where: {
          projectId: entity.projectId,
          status: { in: ['IN_PROGRESS', 'REVIEW'] },
          workIntents: {
            some: { files: { has: rel.sourceEntity.filePath } },
          },
        },
        select: { id: true, displayId: true, title: true },
      })

      return {
        entity: rel.sourceEntity,
        relationship: rel.relationship,
        confidence: rel.confidence,
        activeTasks: activeTasks.map((t) => ({
          taskId: t.id,
          taskDisplayId: t.displayId,
          taskTitle: t.title,
        })),
      }
    }),
  )

  return {
    changedEntity: entity,
    directConsumers: result,
    totalAffectedTasks: new Set(result.flatMap((r) => r.activeTasks.map((t) => t.taskId))).size,
  }
}
