import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateProjectBodySchema } from '@arxion/types';
import {
  createProject,
  listProjects,
  getProjectById,
  getProjectMembers,
} from './project.service.js';

// Temporary: use a hardcoded system user for Phase 1
// Phase 2 will introduce proper authentication
const SYSTEM_USER_ID_PLACEHOLDER = 'seed-maki-user';

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  // POST /projects
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = CreateProjectBodySchema.parse(request.body);
    // Phase 1: derive createdById from the seed user
    // TODO Phase 2: extract from auth context
    const createdById = await resolveSystemUserId();
    const project = await createProject(body, createdById);
    await reply.status(201).send({ success: true, data: project });
  });

  // GET /projects
  app.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    const projects = await listProjects();
    await reply.status(200).send({ success: true, data: projects });
  });

  // GET /projects/:projectId
  app.get('/:projectId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const project = await getProjectById(projectId);
    if (!project) {
      await reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: `Project not found: ${projectId}` },
      });
      return;
    }
    await reply.status(200).send({ success: true, data: project });
  });

  // GET /projects/:projectId/members
  app.get('/:projectId/members', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const members = await getProjectMembers(projectId);
    await reply.status(200).send({ success: true, data: members });
  });
}

// Helper: get the first seeded user id to stand in for auth during Phase 1
async function resolveSystemUserId(): Promise<string> {
  const { prisma } = await import('@arxion/database');
  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  return user?.id ?? SYSTEM_USER_ID_PLACEHOLDER;
}
