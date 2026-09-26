import { prisma } from '@arxion/database';
import type { Prisma } from '@arxion/database';
import type {
  CreateTaskBody,
  UpdateTaskBody,
  TaskWithRelations,
  Task,
  ClaimTaskBody,
  ReportProgressBody,
} from '@arxion/types';
import { emitEvent } from '../../lib/realtime.js';

async function generateDisplayId(projectId: string): Promise<string> {
  const count = await prisma.task.count({ where: { projectId } });
  return `T-${count + 1}`;
}

export async function createTask(
  projectId: string,
  body: CreateTaskBody,
  createdById: string,
): Promise<TaskWithRelations> {
  const displayId = body.displayId ?? (await generateDisplayId(projectId));
  const task = await prisma.task.create({
    data: {
      projectId,
      displayId,
      title: body.title,
      description: body.description ?? null,
      status: body.status ?? 'BACKLOG',
      priority: body.priority ?? 'MEDIUM',
      assigneeId: body.assigneeId ?? null,
      createdById,
      acceptanceCriteria: body.acceptanceCriteria ?? [],
    },
    include: taskIncludes(),
  });

  await prisma.taskActivity.create({
    data: {
      projectId,
      taskId: task.id,
      userId: createdById,
      type: 'task.created',
      message: `Task ${task.displayId} "${task.title}" was created.`,
    },
  });

  emitEvent('task.created', projectId, { task });
  return task as TaskWithRelations;
}

export async function listTasksByProject(projectId: string): Promise<TaskWithRelations[]> {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: taskIncludes(),
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
  });
  return tasks as TaskWithRelations[];
}

export async function getTaskById(taskId: string): Promise<TaskWithRelations | null> {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
    include: taskIncludes(),
  });
  return task as TaskWithRelations | null;
}

export async function updateTask(
  taskId: string,
  body: UpdateTaskBody,
): Promise<TaskWithRelations | null> {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) return null;

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.assigneeId !== undefined && { assigneeId: body.assigneeId }),
      ...(body.acceptanceCriteria !== undefined && { acceptanceCriteria: body.acceptanceCriteria }),
    },
    include: taskIncludes(),
  });

  emitEvent('task.updated', existing.projectId, { task });
  return task as TaskWithRelations;
}

export async function deleteTask(
  taskId: string,
  deletedById: string,
): Promise<{ id: string; displayId: string; projectId: string } | null> {
  const existing = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
    select: { id: true, displayId: true, title: true, projectId: true },
  });
  if (!existing) return null;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Preserve project history and sessions while removing their task reference.
    await tx.agentSession.updateMany({ where: { taskId: existing.id }, data: { taskId: null } });
    await tx.taskActivity.updateMany({ where: { taskId: existing.id }, data: { taskId: null } });
    await tx.projectDecision.updateMany({ where: { taskId: existing.id }, data: { taskId: null } });

    await tx.task.delete({ where: { id: existing.id } });
    await tx.taskActivity.create({
      data: {
        projectId: existing.projectId,
        userId: deletedById,
        type: 'task.deleted',
        message: `Task ${existing.displayId} "${existing.title}" was deleted.`,
        metadata: { deletedTaskId: existing.id, displayId: existing.displayId },
      },
    });
  });

  return { id: existing.id, displayId: existing.displayId, projectId: existing.projectId };
}

/**
 * Atomically claim a task. Uses a transaction + unique constraint to prevent
 * two users claiming the same task simultaneously.
 */
export async function claimTask(
  taskId: string,
  body: ClaimTaskBody,
): Promise<{ task: TaskWithRelations } | { conflict: string }> {
  const existing = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
    include: { assignee: true },
  });

  if (!existing) {
    throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });
  }

  if (existing.assigneeId && existing.assigneeId !== body.userId) {
    const owner = existing.assignee?.name ?? existing.assigneeId;
    return { conflict: `Task ${existing.displayId} is already claimed by ${owner}.` };
  }

  const task = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const current = await tx.task.findUnique({
      where: { id: existing.id },
      select: { assigneeId: true, status: true },
    });

    if (current?.assigneeId && current.assigneeId !== body.userId) {
      throw Object.assign(new Error('TASK_ALREADY_CLAIMED'), { statusCode: 409 });
    }

    const updated = await tx.task.update({
      where: { id: existing.id },
      data: {
        assigneeId: body.userId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
      include: taskIncludes(),
    });

    await tx.taskActivity.create({
      data: {
        projectId: existing.projectId,
        taskId: existing.id,
        userId: body.userId,
        type: 'task.claimed',
        message: `Task ${existing.displayId} claimed.`,
      },
    });

    return updated;
  });

  emitEvent('task.claimed', existing.projectId, { task });
  return { task: task as TaskWithRelations };
}

export async function releaseTask(
  taskId: string,
  userId: string,
): Promise<TaskWithRelations | null> {
  const existing = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!existing) return null;

  const task = await prisma.task.update({
    where: { id: existing.id },
    data: { assigneeId: null, status: 'TODO' },
    include: taskIncludes(),
  });

  await prisma.taskActivity.create({
    data: {
      projectId: existing.projectId,
      taskId: existing.id,
      userId,
      type: 'task.released',
      message: `Task ${existing.displayId} released.`,
    },
  });

  emitEvent('task.released', existing.projectId, { task });
  return task as TaskWithRelations;
}

export async function reportProgress(
  taskId: string,
  body: ReportProgressBody,
): Promise<void> {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  await prisma.taskActivity.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      userId: body.userId,
      agentSessionId: body.agentSessionId ?? null,
      type: 'task.progress',
      message: body.message,
    },
  });

  emitEvent('task.progress', task.projectId, { taskId: task.id, message: body.message });
}

export async function getTaskDependencies(taskId: string) {
  return prisma.taskDependency.findMany({
    where: { taskId },
    include: { dependsOn: { include: taskIncludes() } },
  });
}

/**
 * Returns dependencies that are NOT yet DONE — i.e. active blockers.
 */
export async function getTaskBlockers(taskId: string) {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });

  const deps = await prisma.taskDependency.findMany({
    where: { taskId: task.id },
    include: { dependsOn: true },
  });

  type Dep = (typeof deps)[number];
  return deps
    .filter((d: Dep) => d.dependsOn.status !== 'DONE')
    .map((d: Dep) => ({
      blockingTaskId: d.dependsOnTaskId,
      blockingTask: d.dependsOn,
      reason: `${d.dependsOn.displayId} (${d.dependsOn.status}) must be completed first.`,
    }));
}

export async function requireTask(taskId: string): Promise<Task> {
  const task = await prisma.task.findFirst({
    where: { OR: [{ id: taskId }, { displayId: taskId }] },
  });
  if (!task) {
    throw Object.assign(new Error(`Task not found: ${taskId}`), { statusCode: 404 });
  }
  return task;
}

function taskIncludes() {
  return {
    assignee: true,
    createdBy: true,
    dependencies: { include: { dependsOn: true } },
  } as const;
}
