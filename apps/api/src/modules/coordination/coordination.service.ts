import { prisma } from '@arxion/database';
import { Prisma } from '@arxion/database';
import type {
  DeclareWorkIntentBody,
  DeclareContractBody,
  CoordinationPreflight,
  FileConflict,
  ContractRisk,
} from '@arxion/types';
import { emitEvent } from '../../lib/realtime.js';
import { normalizePaths } from '../../lib/normalize-path.js';

// ─── Work Intent ──────────────────────────────────────────────────────────────

export async function declareWorkIntent(taskId: string, body: DeclareWorkIntentBody) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  const intentData = {
    files: normalizePaths(body.files ?? []),
    apis: body.apis ?? [],
    models: body.models ?? [],
    contracts: body.contracts ?? [],
    summary: body.summary ?? null,
  };

  // Manual upsert — one intent per task (taskId not yet @unique in schema)
  const existing = await prisma.taskWorkIntent.findFirst({ where: { taskId: task.id } });
  const intent = existing
    ? await prisma.taskWorkIntent.update({ where: { id: existing.id }, data: intentData })
    : await prisma.taskWorkIntent.create({ data: { taskId: task.id, ...intentData } });

  await prisma.taskActivity.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      type: 'task.intent_declared',
      message: `Work intent declared: ${body.summary ?? `${(body.files ?? []).length} file(s)`}`,
    },
  });

  emitEvent('task.updated', task.projectId, { taskId: task.id, intent });
  return intent;
}

export async function getWorkIntent(taskId: string) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  const intent = await prisma.taskWorkIntent.findFirst({ where: { taskId: task.id } });
  return intent;
}

// ─── Contracts ────────────────────────────────────────────────────────────────

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
      metadata: body.metadata != null ? (body.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  await prisma.taskActivity.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      type: 'contract.declared',
      message: `Contract declared: ${body.relationship} ${body.type} "${body.name}"`,
    },
  });

  emitEvent('contract.declared', task.projectId, { contract });

  // Check for risks after any new declaration
  const risks = await detectContractRisks(task.projectId, task.id);
  if (risks.length > 0) {
    emitEvent('contract.risk_detected', task.projectId, { taskId: task.id, risks });
  }

  return { contract, risks };
}

export async function listContracts(taskId: string) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  return prisma.taskContract.findMany({
    where: { taskId: task.id },
    orderBy: { createdAt: 'asc' },
  });
}

// ─── Contract Risk Detection ──────────────────────────────────────────────────

/**
 * Detects contract risks for a project.
 * A risk exists when one active task MODIFIES/PROVIDES a contract that another active task CONSUMES.
 */
export async function detectContractRisks(
  projectId: string,
  focusTaskId?: string,
): Promise<ContractRisk[]> {
  // Get all contracts for in-progress tasks in this project
  const activeContracts = await prisma.taskContract.findMany({
    where: {
      projectId,
      task: { status: { in: ['IN_PROGRESS', 'TODO', 'BACKLOG'] } },
    },
    include: { task: { select: { id: true, displayId: true, status: true } } },
  });

  const risks: ContractRisk[] = [];

  // Find MODIFIES/PROVIDES contracts
  const modifyingContracts = activeContracts.filter(
    (c) => c.relationship === 'MODIFIES' || c.relationship === 'PROVIDES',
  );

  // Find CONSUMES contracts
  const consumingContracts = activeContracts.filter((c) => c.relationship === 'CONSUMES');

  for (const modifier of modifyingContracts) {
    for (const consumer of consumingContracts) {
      // Skip if same task
      if (modifier.taskId === consumer.taskId) continue;

      // Contract name match (case-insensitive)
      if (modifier.name.toLowerCase() !== consumer.name.toLowerCase()) continue;

      // If focusTaskId, only include risks involving this task
      if (
        focusTaskId &&
        modifier.taskId !== focusTaskId &&
        consumer.taskId !== focusTaskId
      ) continue;

      risks.push({
        contractName: modifier.name,
        contractType: modifier.type,
        sourceTaskId: modifier.taskId,
        sourceTaskDisplayId: modifier.task.displayId,
        sourceRelationship: modifier.relationship as 'PROVIDES' | 'MODIFIES' | 'CONSUMES',
        affectedTaskId: consumer.taskId,
        affectedTaskDisplayId: consumer.task.displayId,
        affectedRelationship: 'CONSUMES',
      });
    }
  }

  return risks;
}

export async function getCoordinationRisks(projectId: string) {
  return detectContractRisks(projectId);
}

// ─── begin_task Preflight ─────────────────────────────────────────────────────

export async function beginTask(
  taskId: string,
  userId: string,
  agentType: string = 'IBM_BOB',
): Promise<CoordinationPreflight> {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
    include: { assignee: true },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  // Start or resume an agent session
  let session = await prisma.agentSession.findFirst({
    where: {
      projectId: task.projectId,
      userId,
      taskId: task.id,
      status: { in: ['WORKING', 'IDLE', 'WAITING'] },
    },
  });

  if (!session) {
    session = await prisma.agentSession.create({
      data: {
        projectId: task.projectId,
        userId,
        taskId: task.id,
        agentType: agentType as 'IBM_BOB' | 'CURSOR' | 'CLAUDE_CODE' | 'OTHER',
        status: 'WORKING',
        lastSeenAt: new Date(),
      },
    });
    emitEvent('agent.started', task.projectId, { sessionId: session.id });
  } else {
    await prisma.agentSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), status: 'WORKING' },
    });
  }

  // Dependencies
  const deps = await prisma.taskDependency.findMany({
    where: { taskId: task.id },
    include: { dependsOn: true },
  });

  const dependencies = deps.map((d) => ({
    task: d.dependsOn,
    isBlocked: d.dependsOn.status !== 'DONE',
  }));

  // Active teammates (other active sessions in same project)
  const otherSessions = await prisma.agentSession.findMany({
    where: {
      projectId: task.projectId,
      status: { in: ['WORKING', 'IDLE', 'WAITING'] },
      id: { not: session.id },
    },
    include: {
      user: { select: { id: true, name: true } },
      task: { select: { id: true, displayId: true } },
    },
  });

  const activeTeammates = otherSessions
    .filter((s) => s.task)
    .map((s) => ({
      userId: s.userId,
      userName: s.user.name,
      taskId: s.taskId!,
      taskDisplayId: s.task!.displayId,
      agentType: s.agentType as 'IBM_BOB' | 'CURSOR' | 'CLAUDE_CODE' | 'OTHER',
      status: s.status as 'IDLE' | 'WORKING' | 'WAITING' | 'FINISHED' | 'STALE',
    }));

  // File conflicts — check intent files
  const intent = await prisma.taskWorkIntent.findFirst({ where: { taskId: task.id } });
  let fileConflicts: FileConflict[] = [];

  if (intent && intent.files.length > 0) {
    const existingReservations = await prisma.taskFileReservation.findMany({
      where: {
        projectId: task.projectId,
        filePath: { in: intent.files },
        status: 'ACTIVE',
        NOT: { taskId: task.id },
      },
      include: { user: true, task: true },
    });

    fileConflicts = existingReservations.map((r) => ({
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

  // Contract risks
  const contractRisks = await detectContractRisks(task.projectId, task.id);

  const isBlocked = dependencies.some((d) => d.isBlocked);
  const hasWarnings = fileConflicts.length > 0 || contractRisks.length > 0;
  const coordinationStatus = isBlocked
    ? 'BLOCKED'
    : hasWarnings
      ? 'READY_WITH_WARNINGS'
      : 'READY';

  await prisma.taskActivity.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      userId,
      agentSessionId: session.id,
      type: 'task.started',
      message: `Agent session started for ${task.displayId} (${coordinationStatus}).`,
    },
  });

  emitEvent('task.started', task.projectId, { taskId: task.id, userId, sessionId: session.id });

  return {
    task: task as CoordinationPreflight['task'],
    sessionId: session.id,
    dependencies,
    activeTeammates,
    fileConflicts,
    contractRisks,
    coordinationStatus,
  };
}
