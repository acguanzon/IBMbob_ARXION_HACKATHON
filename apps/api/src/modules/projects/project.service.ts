import { prisma } from '@arxion/database';
import type { CreateProjectBody, ProjectWithMembers, Project } from '@arxion/types';
import {
  createGitHubProvider,
  parseGitHubRepositoryUrl,
  type GitRepository,
} from '../../lib/git-provider.js';

async function prepareRepository(body: CreateProjectBody): Promise<GitRepository | null> {
  const setup = body.repositorySetup;
  if (!setup) return null;

  const provider = createGitHubProvider();
  const { owner, repository } = parseGitHubRepositoryUrl(setup.repositoryUrl);
  return provider.getRepository(owner, repository);
}

export async function createProject(
  body: CreateProjectBody,
  createdById: string,
): Promise<ProjectWithMembers> {
  const repository = await prepareRepository(body);
  const repositoryUrl = repository?.url ?? body.repositoryUrl ?? null;
  const project = await prisma.project.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      repositoryUrl,
      createdById,
      members: {
        create: {
          userId: createdById,
          role: 'OWNER',
        },
      },
      ...(repository
        ? {
            repositories: {
              create: {
                provider: 'GITHUB',
                owner: repository.owner,
                repository: repository.name,
                defaultBranch: repository.defaultBranch || 'main',
                externalRepositoryId: repository.id,
                status: 'CONNECTED',
              },
            },
          }
        : {}),
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

export async function listProjects(userId: string): Promise<ProjectWithMembers[]> {
  const projects = await prisma.project.findMany({
    where: { members: { some: { userId } } },
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
