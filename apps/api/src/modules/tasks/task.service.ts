import { prisma } from '@arxion/database';
import type {
  CreateTaskBody,
  UpdateTaskBody,
  TaskWithRelations,
  Task,
} from '@arxion/types';

export async function createTask(
  projectId: string,
  body: CreateTaskBody,
  createdById: string,
): Promise<TaskWithRelations> {
  const task = await prisma.task.create({
    data: {
      projectId,
      displayId: body.displayId,
      title: body.title,
      description: body.description ?? null,
      status: body.status ?? 'BACKLOG',
      priority: body.priority ?? 'MEDIUM',
      assigneeId: body.assigneeId ?? null,
      createdById,
    },
    include: taskIncludes(),
  });

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
  // Support both cuid (internal id) and displayId (e.g. "T-102")
  const task = await prisma.task.findFirst({
    where: {
      OR: [
        { id: taskId },
        { displayId: taskId },
      ],
    },
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
    },
    include: taskIncludes(),
  });

  return task as TaskWithRelations;
}

export async function getTaskDependencies(taskId: string) {
  return prisma.taskDependency.findMany({
    where: { taskId },
    include: {
      dependsOn: {
        include: taskIncludes(),
      },
    },
  });
}

export async function requireTask(taskId: string): Promise<Task> {
  const task = await prisma.task.findFirst({
    where: {
      OR: [{ id: taskId }, { displayId: taskId }],
    },
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
    dependencies: {
      include: {
        dependsOn: true,
      },
    },
  } as const;
}
