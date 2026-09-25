import { prisma } from '@arxion/database';
import type {
  CreateProjectBody,
  ProjectWithMembers,
  Project,
} from '@arxion/types';

export async function createProject(
  body: CreateProjectBody,
  createdById: string,
): Promise<ProjectWithMembers> {
  const project = await prisma.project.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      repositoryUrl: body.repositoryUrl ?? null,
      createdById,
      members: {
        create: {
          userId: createdById,
          role: 'OWNER',
        },
      },
    },
    include: {
      members: {
        include: { user: true },
      },
      _count: { select: { tasks: true } },
    },
  });

  return project as ProjectWithMembers;
}

export async function listProjects(): Promise<ProjectWithMembers[]> {
  const projects = await prisma.project.findMany({
    include: {
      members: {
        include: { user: true },
      },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return projects as ProjectWithMembers[];
}

export async function getProjectById(projectId: string): Promise<ProjectWithMembers | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: { user: true },
      },
      _count: { select: { tasks: true } },
    },
  });

  return project as ProjectWithMembers | null;
}

export async function getProjectMembers(projectId: string) {
  return prisma.projectMember.findMany({
    where: { projectId },
    include: { user: true },
    orderBy: { joinedAt: 'asc' },
  });
}

// Ensure a project exists — throws if not found
export async function requireProject(projectId: string): Promise<Project> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw Object.assign(new Error(`Project not found: ${projectId}`), { statusCode: 404 });
  }
  return project;
}
