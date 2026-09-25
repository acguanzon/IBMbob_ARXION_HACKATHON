import { prisma } from '@arxion/database';

export async function getActivityFeed(
  projectId: string,
  options: { limit?: number; taskId?: string } = {},
) {
  const { limit = 50, taskId } = options;

  return prisma.taskActivity.findMany({
    where: {
      projectId,
      ...(taskId ? { taskId } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      agentSession: { select: { id: true, agentType: true, status: true } },
      task: { select: { id: true, displayId: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
