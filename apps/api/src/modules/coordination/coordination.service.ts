import { prisma } from '@arxion/database';
import type {
  DeclareWorkIntentBody,
  DeclareContractBody,
  CoordinationPreflight,
  FileConflict,
  ContractRisk,
} from '@arxion/types';
import { normalizePaths } from '../../lib/normalize-path.js';
import { emitEvent } from '../../lib/realtime.js';

const DEFAULT_LEASE_SECONDS = 120;
void DEFAULT_LEASE_SECONDS; // reserved for future use

/**
 * Core "begin_task" preflight:
 *  1. Claim the task (if not already claimed by this user)
 *  2. Create an agent session
 *  3. Detect active teammates on overlapping tasks
 *  4. Detect file conflicts from any declared work intent
 *  5. Detect contract risks from existing contracts
 *  6. Return a full CoordinationPreflight summary
 */
export async function beginTask(
  taskId: string,
  userId: string,
  agentType: 'IBM_BOB' | 'CURSOR' | 'CLAUDE_CODE' | 'OTHER' = 'IBM_BOB',
  externalAgentId?: string,
): Promise<CoordinationPreflight> {
  // Resolve task
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
    include: { assignee: true },
  });
  if (!task) {
    throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });
  }

  // Claim if not already claimed by this user
  if (!task.assigneeId || task.assigneeId !== userId) {
    if (task.assigneeId && task.assigneeId !== userId) {
      throw Object.assign(
        new Error(`Task ${task.displayId} is already claimed by another user.`),
        { statusCode: 409 },
      );
    }
    await prisma.task.update({
      where: { id: task.id },
      data: { assigneeId: userId, status: 'IN_PROGRESS', startedAt: new Date() },
    });
    await prisma.taskActivity.create({
      data: {
        projectId: task.projectId,
        taskId: task.id,
        userId,
        type: 'task.claimed',
        message: `Task ${task.displayId} claimed via begin_task.`,
      },
    });
    emitEvent('task.claimed', task.projectId, { taskId: task.id });
  }

  // Reload task with fresh assignee
  const freshTask = await prisma.task.findUnique({
    where: { id: task.id },
    include: { assignee: true },
  });

  // Create agent session
  const session = await prisma.agentSession.create({
    data: {
      projectId: task.projectId,
      userId,
      taskId: task.id,
      agentType,
      externalAgentId: externalAgentId ?? null,
      status: 'WORKING',
      lastSeenAt: new Date(),
    },
  });

  await prisma.taskActivity.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      userId,
      agentSessionId: session.id,
      type: 'agent.started',
      message: `Agent session started for ${task.displayId} (${agentType}).`,
    },
  });

  emitEvent('agent.started', task.projectId, { sessionId: session.id, taskId: task.id });

  // Detect active teammates
  const activeSessions = await prisma.agentSession.findMany({
    where: {
      projectId: task.projectId,
      status: { in: ['WORKING', 'WAITING', 'IDLE'] },
      id: { not: session.id },
      taskId: { not: null },
    },
    include: { user: true, task: true },
  });

  type ActiveSession = (typeof activeSessions)[number];
  const activeTeammates = activeSessions.map((s: ActiveSession) => ({
    userId: s.userId,
    userName: s.user.name,
    taskId: s.taskId!,
    taskDisplayId: s.task?.displayId ?? s.taskId!,
    agentType: s.agentType as 'IBM_BOB' | 'CURSOR' | 'CLAUDE_CODE' | 'OTHER',
    status: s.status as 'IDLE' | 'WORKING' | 'WAITING' | 'FINISHED' | 'STALE',
  }));

  // Dependencies / blockers
  const deps = await prisma.taskDependency.findMany({
    where: { taskId: task.id },
    include: { dependsOn: true },
  });

  type DepRow = (typeof deps)[number];
  const dependencies = deps.map((d: DepRow) => ({
    task: d.dependsOn,
    isBlocked: d.dependsOn.status !== 'DONE',
  }));

  // Detect file conflicts from any declared work intent for this task
  const workIntent = await prisma.taskWorkIntent.findFirst({
    where: { taskId: task.id },
    orderBy: { declaredAt: 'desc' },
  });

  let fileConflicts: FileConflict[] = [];
  if (workIntent && workIntent.files.length > 0) {
    const conflicting = await prisma.taskFileReservation.findMany({
      where: {
        projectId: task.projectId,
        filePath: { in: workIntent.files },
        status: 'ACTIVE',
        NOT: { taskId: task.id },
      },
      include: { user: true, task: true },
    });

    type ConflictRow = (typeof conflicting)[number];
    fileConflicts = conflicting.map((r: ConflictRow) => ({
      filePath: r.filePath,
      existingReservation: {
        id: r.id,
        userId: r.userId,
        userName: r.user.name,
        taskId: r.taskId,
        taskDisplayId: r.task.displayId,
        agentSessionId: r.agentSessionId,
        reservedAt: r.reservedAt,
        leaseExpiresAt: r.leaseExpiresAt,
      },
    }));
  }

  // Detect contract risks
  const contractRisks = await detectContractRisks(task.id, task.projectId);

  if (contractRisks.length > 0) {
    emitEvent('contract.risk_detected', task.projectId, {
      taskId: task.id,
      risks: contractRisks,
    });
  }

  // Determine coordination status
  type DepItem = (typeof dependencies)[number];
  const hasBlockedDeps = dependencies.some((d: DepItem) => d.isBlocked);
  const hasWarnings = fileConflicts.length > 0 || contractRisks.length > 0 || activeTeammates.length > 0;

  const coordinationStatus: 'READY' | 'READY_WITH_WARNINGS' | 'BLOCKED' = hasBlockedDeps
    ? 'BLOCKED'
    : hasWarnings
      ? 'READY_WITH_WARNINGS'
      : 'READY';

  // Phase 4: Fetch unread context updates for this task
  const contextUpdates = await prisma.contextUpdate.findMany({
    where: { affectedTaskId: task.id, status: { in: ['UNREAD', 'READ'] } },
    include: {
      sourceTask: { select: { displayId: true, title: true } },
      entity: { select: { name: true, type: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  // Phase 4: Fetch open coordination risks affecting this task
  const activeRisks = await prisma.coordinationRisk.findMany({
    where: { affectedTaskId: task.id, status: 'OPEN' },
    include: {
      sourceTask: { select: { displayId: true, title: true } },
      sourceEntity: { select: { name: true, type: true } },
    },
    orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
    take: 10,
  });

  // Phase 4: Fetch branch/git status for this task
  const gitLink = await prisma.taskGitLink.findFirst({
    where: { taskId: task.id },
    orderBy: { updatedAt: 'desc' },
  });

  const hasUnreadUpdates = contextUpdates.length > 0;
  const hasOpenRisks = activeRisks.length > 0;

  // Upgrade coordination status if there are phase-4 risks
  let finalCoordinationStatus: 'READY' | 'READY_WITH_WARNINGS' | 'BLOCKED' = coordinationStatus;
  if (coordinationStatus === 'READY' && (hasUnreadUpdates || hasOpenRisks)) {
    finalCoordinationStatus = 'READY_WITH_WARNINGS';
  }

  return {
    task: freshTask! as typeof freshTask & { assignee: NonNullable<typeof freshTask>['assignee'] },
    sessionId: session.id,
    dependencies,
    activeTeammates,
    fileConflicts,
    contractRisks,
    coordinationStatus: finalCoordinationStatus,
    // Phase 4 additions
    contextUpdates,
    activeRisks,
    gitLink: gitLink
      ? {
          branchName: gitLink.branchName,
          baseBranch: gitLink.baseBranch,
          latestCommitSha: gitLink.latestCommitSha,
          aheadCount: gitLink.aheadCount,
          behindCount: gitLink.behindCount,
          mergeStatus: gitLink.mergeStatus,
        }
      : null,
  };
}

/**
 * Declare or update work intent for a task (upsert — one intent per task).
 */
export async function declareWorkIntent(taskId: string, body: DeclareWorkIntentBody) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  const normalizedFiles = normalizePaths(body.files ?? []);

  // Upsert: one work intent per task (update if exists)
  const existing = await prisma.taskWorkIntent.findFirst({ where: { taskId: task.id } });

  let intent;
  if (existing) {
    intent = await prisma.taskWorkIntent.update({
      where: { id: existing.id },
      data: {
        files: normalizedFiles,
        apis: body.apis ?? [],
        models: body.models ?? [],
        contracts: body.contracts ?? [],
        summary: body.summary ?? null,
        updatedAt: new Date(),
      },
    });
  } else {
    intent = await prisma.taskWorkIntent.create({
      data: {
        taskId: task.id,
        files: normalizedFiles,
        apis: body.apis ?? [],
        models: body.models ?? [],
        contracts: body.contracts ?? [],
        summary: body.summary ?? null,
      },
    });
  }

  await prisma.taskActivity.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      type: 'task.updated',
      message: `Work intent declared for ${task.displayId}: ${normalizedFiles.length} file(s), ${body.apis?.length ?? 0} API(s).`,
    },
  });

  return intent;
}

/**
 * Get the current work intent for a task.
 */
export async function getWorkIntent(taskId: string) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  return prisma.taskWorkIntent.findFirst({
    where: { taskId: task.id },
    orderBy: { declaredAt: 'desc' },
  });
}

/**
 * Declare a contract for a task.
 */
export async function declareContract(taskId: string, body: DeclareContractBody) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  const contract = await prisma.taskContract.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      type: body.type,
      name: body.name,
      relationship: body.relationship,
      metadata: body.metadata ? JSON.parse(JSON.stringify(body.metadata)) : undefined,
    },
  });

  await prisma.taskActivity.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      type: 'contract.declared',
      message: `Contract declared: ${body.relationship} ${body.type} "${body.name}".`,
    },
  });

  emitEvent('contract.declared', task.projectId, { contract, taskId: task.id });
  return contract;
}

/**
 * Get all contracts for a task.
 */
export async function getContracts(taskId: string) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  return prisma.taskContract.findMany({
    where: { taskId: task.id },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Detect contract risks for a task:
 * A risk exists when another task MODIFIES or PROVIDES a contract that this task CONSUMES,
 * or when this task MODIFIES a contract that another task CONSUMES.
 */
export async function detectContractRisks(
  taskId: string,
  projectId: string,
): Promise<ContractRisk[]> {
  const thisContracts = await prisma.taskContract.findMany({
    where: { taskId },
    include: { task: true },
  });

  if (thisContracts.length === 0) return [];

  type ContractRow = (typeof thisContracts)[number];
  const contractNames = thisContracts.map((c: ContractRow) => c.name);

  const otherContracts = await prisma.taskContract.findMany({
    where: {
      projectId,
      name: { in: contractNames },
      taskId: { not: taskId },
    },
    include: { task: true },
  });

  const risks: ContractRisk[] = [];

  for (const mine of thisContracts) {
    for (const other of otherContracts) {
      if (mine.name !== other.name) continue;

      const isRisk =
        (mine.relationship === 'CONSUMES' && other.relationship === 'MODIFIES') ||
        (mine.relationship === 'MODIFIES' && other.relationship === 'CONSUMES') ||
        (mine.relationship === 'MODIFIES' && other.relationship === 'MODIFIES');

      if (isRisk) {
        risks.push({
          contractName: mine.name,
          contractType: mine.type,
          sourceTaskId: taskId,
          sourceTaskDisplayId: mine.task.displayId,
          sourceRelationship: mine.relationship,
          affectedTaskId: other.taskId,
          affectedTaskDisplayId: other.task.displayId,
          affectedRelationship: other.relationship,
        });
      }
    }
  }

  return risks;
}

/**
 * Get contract risks for a task (standalone endpoint).
 */
export async function getContractRisks(taskId: string): Promise<ContractRisk[]> {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  return detectContractRisks(task.id, task.projectId);
}

/**
 * Get all contract risks for a project (used by the dashboard panel).
 * Scans all tasks in the project for MODIFIES/PROVIDES vs CONSUMES conflicts.
 */
export async function getCoordinationRisks(projectId: string): Promise<ContractRisk[]> {
  const allContracts = await prisma.taskContract.findMany({
    where: { projectId },
    include: { task: true },
  });

  const modifying = allContracts.filter(
    (c) => c.relationship === 'MODIFIES' || c.relationship === 'PROVIDES',
  );
  const consuming = allContracts.filter((c) => c.relationship === 'CONSUMES');

  const risks: ContractRisk[] = [];

  for (const mod of modifying) {
    for (const con of consuming) {
      if (mod.taskId === con.taskId) continue;
      if (mod.name.toLowerCase() !== con.name.toLowerCase()) continue;

      risks.push({
        contractName: mod.name,
        contractType: mod.type,
        sourceTaskId: mod.taskId,
        sourceTaskDisplayId: mod.task.displayId,
        sourceRelationship: mod.relationship,
        affectedTaskId: con.taskId,
        affectedTaskDisplayId: con.task.displayId,
        affectedRelationship: con.relationship,
      });
    }
  }

  return risks;
}
