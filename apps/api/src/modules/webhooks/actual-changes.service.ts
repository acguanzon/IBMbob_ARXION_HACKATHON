/**
 * Actual Changes Service — Phase 4
 *
 * Captures TaskActualChange records from a push event and runs:
 * 1. Scope deviation detection (declared vs actual)
 * 2. Code entity extraction
 * 3. Contract change detection
 * 4. Risk engine
 * 5. Impact analysis → context updates
 */
import { prisma } from '@arxion/database'
import { emitEvent } from '../../lib/realtime.js'
import { extractEntitiesFromFiles } from './entity-extractor.service.js'
import { detectContractChanges } from './contract-change.service.js'
import { runRiskEngine } from './risk-engine.service.js'

export interface ActualChangeInput {
  filePath: string
  changeType: 'ADDED' | 'MODIFIED' | 'DELETED' | 'RENAMED'
  additions: number
  deletions: number
  previousFilePath?: string
}

/**
 * Main pipeline: record actual changes, detect scope deviation,
 * extract entities, detect contract changes, run risk engine.
 */
export async function processActualChanges(opts: {
  projectId: string
  taskId: string
  repositoryId: string
  commitSha: string
  files: ActualChangeInput[]
}): Promise<void> {
  const { projectId, taskId, repositoryId, commitSha, files } = opts

  if (files.length === 0) return

  // 1. Upsert TaskActualChange records
  for (const file of files) {
    await prisma.taskActualChange.upsert({
      where: {
        // No unique constraint on the model — use a composite check-then-create pattern
        id: (
          await prisma.taskActualChange.findFirst({
            where: { taskId, repositoryId, commitSha, filePath: file.filePath },
            select: { id: true },
          })
        )?.id ?? '',
      },
      create: {
        taskId,
        repositoryId,
        commitSha,
        filePath: file.filePath,
        changeType: file.changeType,
        additions: file.additions,
        deletions: file.deletions,
      },
      update: {
        changeType: file.changeType,
        additions: file.additions,
        deletions: file.deletions,
      },
    })
  }

  const actualFilePaths = files.map((f) => f.filePath)

  // 2. Scope deviation analysis
  await detectScopeDeviation(projectId, taskId, actualFilePaths)

  // 3. Extract code entities
  await extractEntitiesFromFiles({ projectId, taskId, repositoryId, files })

  // 4. Detect contract changes and run risk/impact pipeline
  await detectContractChanges({ projectId, taskId, files })

  // 5. Risk engine — file overlap and scope expansion
  await runRiskEngine({ projectId, taskId, actualFilePaths })
}

// ─── Scope Deviation ─────────────────────────────────────────────────────────

async function detectScopeDeviation(
  projectId: string,
  taskId: string,
  actualFiles: string[],
): Promise<void> {
  const intent = await prisma.taskWorkIntent.findUnique({ where: { taskId } })
  if (!intent) return

  const declared = new Set(intent.files)
  const actual = new Set(actualFiles)

  const unexpected = actualFiles.filter((f) => !declared.has(f))
  if (unexpected.length === 0) return

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { displayId: true } })

  emitEvent('scope.deviation_detected', projectId, {
    taskId,
    taskDisplayId: task?.displayId,
    declaredFiles: intent.files,
    actualFiles,
    unexpectedFiles: unexpected,
  })

  await prisma.taskActivity.create({
    data: {
      projectId,
      taskId,
      type: 'scope.deviation',
      message: `Scope expansion detected: ${unexpected.length} undeclared file(s) modified. (${unexpected.slice(0, 3).join(', ')}${unexpected.length > 3 ? '...' : ''})`,
      metadata: { unexpected, declared: intent.files },
    },
  })
}

/**
 * Get actual scope analysis for a task (declared vs actual).
 */
export async function getActualScopeAnalysis(taskId: string) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  })
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 })

  const intent = await prisma.taskWorkIntent.findUnique({ where: { taskId: task.id } })
  const actualChanges = await prisma.taskActualChange.findMany({
    where: { taskId: task.id },
    select: { filePath: true },
  })

  const declaredFiles = intent?.files ?? []
  const actualFiles = [...new Set(actualChanges.map((c) => c.filePath))]

  const declaredSet = new Set(declaredFiles)
  const actualSet = new Set(actualFiles)

  const unexpectedFiles = actualFiles.filter((f) => !declaredSet.has(f))
  const missingDeclaredFiles = declaredFiles.filter((f) => !actualSet.has(f))

  // No declared intent means there is no baseline to compare against — no deviation.
  if (!intent) {
    return {
      taskId: task.id,
      declaredFiles: [],
      actualFiles,
      unexpectedFiles: [],
      missingDeclaredFiles: [],
      hasDeviation: false,
    }
  }

  return {
    taskId: task.id,
    declaredFiles,
    actualFiles,
    unexpectedFiles,
    missingDeclaredFiles,
    hasDeviation: unexpectedFiles.length > 0 || missingDeclaredFiles.length > 0,
  }
}

/**
 * Get actual changes recorded for a task.
 */
export async function getActualChanges(taskId: string) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  })
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 })

  return prisma.taskActualChange.findMany({
    where: { taskId: task.id },
    orderBy: { detectedAt: 'desc' },
  })
}
