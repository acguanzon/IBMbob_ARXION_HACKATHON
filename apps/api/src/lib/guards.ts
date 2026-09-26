/**
 * Authorization guards — project-scoped access control
 */
import { prisma } from '@arxion/database';

/**
 * Throws a 403 error if the given userId is not a member of the project.
 */
export async function requireProjectMember(projectId: string, userId: string): Promise<void> {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });

  if (!membership) {
    throw Object.assign(
      new Error(`User ${userId} is not a member of project ${projectId}`),
      { statusCode: 403 },
    );
  }
}
