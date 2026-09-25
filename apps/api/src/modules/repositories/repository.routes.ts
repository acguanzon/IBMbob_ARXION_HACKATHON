import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ConnectRepositoryBodySchema } from '@arxion/types'
import {
  connectRepository,
  listRepositories,
  getRepository,
  disconnectRepository,
} from './repository.service.js'

export async function repositoryRoutes(app: FastifyInstance): Promise<void> {
  // POST /projects/:projectId/repositories
  app.post(
    '/projects/:projectId/repositories',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string }
      const body = ConnectRepositoryBodySchema.parse(req.body)
      const repo = await connectRepository(projectId, body)
      await reply.status(201).send({ success: true, data: repo })
    },
  )

  // GET /projects/:projectId/repositories
  app.get(
    '/projects/:projectId/repositories',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string }
      const repos = await listRepositories(projectId)
      await reply.status(200).send({ success: true, data: repos })
    },
  )

  // GET /repositories/:repositoryId
  app.get(
    '/repositories/:repositoryId',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { repositoryId } = req.params as { repositoryId: string }
      const repo = await getRepository(repositoryId)
      if (!repo) {
        await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Repository not found.' } })
        return
      }
      await reply.status(200).send({ success: true, data: repo })
    },
  )

  // DELETE /repositories/:repositoryId
  app.delete(
    '/repositories/:repositoryId',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { repositoryId } = req.params as { repositoryId: string }
      const repo = await disconnectRepository(repositoryId)
      await reply.status(200).send({ success: true, data: repo })
    },
  )
}
