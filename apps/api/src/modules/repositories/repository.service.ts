/**
 * Repository Service — Phase 4
 * Manages ProjectRepository records and repository connection lifecycle.
 */
import { prisma } from '@arxion/database'
import type { ConnectRepositoryBody } from '@arxion/types'
import { emitEvent } from '../../lib/realtime.js'

/**
 * Connect a Git repository to a project.
 */
export async function connectRepository(projectId: string, body: ConnectRepositoryBody) {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) throw Object.assign(new Error(`Project not found: ${projectId}`), { statusCode: 404 })

  const existing = await prisma.projectRepository.findFirst({
    where: { projectId, owner: body.owner, repository: body.repository },
  })

  if (existing) {
    const updated = await prisma.projectRepository.update({
      where: { id: existing.id },
      data: {
        provider: body.provider ?? 'GITHUB',
        defaultBranch: body.defaultBranch ?? 'main',
        webhookSecret: body.webhookSecret ?? existing.webhookSecret,
        status: 'CONNECTED',
      },
    })

    await prisma.taskActivity.create({
      data: {
        projectId,
        type: 'repository.reconnected',
        message: `Repository ${body.owner}/${body.repository} reconnected.`,
      },
    })

    emitEvent('repository.connected', projectId, {
      repositoryId: updated.id,
      owner: body.owner,
      repository: body.repository,
    })

    return updated
  }

  const repo = await prisma.projectRepository.create({
    data: {
      projectId,
      provider: body.provider ?? 'GITHUB',
      owner: body.owner,
      repository: body.repository,
      defaultBranch: body.defaultBranch ?? 'main',
      webhookSecret: body.webhookSecret ?? null,
      status: 'CONNECTED',
    },
  })

  await prisma.taskActivity.create({
    data: {
      projectId,
      type: 'repository.connected',
      message: `Repository ${body.owner}/${body.repository} connected (${body.provider ?? 'GITHUB'}).`,
    },
  })

  emitEvent('repository.connected', projectId, {
    repositoryId: repo.id,
    owner: body.owner,
    repository: body.repository,
  })

  return repo
}

/**
 * List repositories for a project.
 */
export async function listRepositories(projectId: string) {
  return prisma.projectRepository.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      projectId: true,
      provider: true,
      owner: true,
      repository: true,
      defaultBranch: true,
      externalRepositoryId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      // never expose webhookSecret
    },
  })
}

/**
 * Get a single repository by ID (without exposing the webhook secret).
 */
export async function getRepository(repositoryId: string) {
  return prisma.projectRepository.findUnique({
    where: { id: repositoryId },
    select: {
      id: true,
      projectId: true,
      provider: true,
      owner: true,
      repository: true,
      defaultBranch: true,
      externalRepositoryId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

/**
 * Disconnect a repository (soft disconnect — preserves history).
 */
export async function disconnectRepository(repositoryId: string) {
  const repo = await prisma.projectRepository.findUnique({ where: { id: repositoryId } })
  if (!repo) throw Object.assign(new Error(`Repository not found: ${repositoryId}`), { statusCode: 404 })

  const updated = await prisma.projectRepository.update({
    where: { id: repositoryId },
    data: { status: 'DISCONNECTED' },
  })

  await prisma.taskActivity.create({
    data: {
      projectId: repo.projectId,
      type: 'repository.disconnected',
      message: `Repository ${repo.owner}/${repo.repository} disconnected.`,
    },
  })

  return updated
}
