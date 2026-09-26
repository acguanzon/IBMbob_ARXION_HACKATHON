import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateProjectBodySchema, AddMemberBodySchema, UpdateMemberRoleBodySchema } from '@arxion/types';
import {
  createProject,
  listProjects,
  getProjectById,
  getProjectMembers,
  requireProject,
} from './project.service.js';
import { authenticate } from '../../lib/auth-middleware.js';
import { requireProjectRole } from '../../lib/guards.js';
import { prisma } from '@arxion/database';

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  // POST /projects
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = CreateProjectBodySchema.parse(request.body);
    const project = await createProject(body, request.user!.id);
    await reply.status(201).send({ success: true, data: project });
  });

  // GET /projects
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const projects = request.isInternalIntegration
      ? await prisma.project.findMany({ include: { members: { include: { user: true } }, _count: { select: { tasks: true } } } })
      : await listProjects(request.user!.id);
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

  // POST /projects/:projectId/members  — add a user by email
  app.post('/:projectId/members', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    await requireProject(projectId);
    await requireProjectRole(projectId, request.user!.id, ['OWNER']);
    const body = AddMemberBodySchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      await reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: `No user found with email: ${body.email}` },
      });
      return;
    }

    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (existing) {
      await reply.status(409).send({
        success: false,
        error: { code: 'ALREADY_MEMBER', message: `${body.email} is already a member of this project` },
      });
      return;
    }

    const member = await prisma.projectMember.create({
      data: { projectId, userId: user.id, role: body.role ?? 'MEMBER' },
      include: { user: true },
    });

    await reply.status(201).send({ success: true, data: member });
  });

  // PATCH /projects/:projectId/members/:memberId  — update role
  app.patch('/:projectId/members/:memberId', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, memberId } = request.params as { projectId: string; memberId: string };
    await requireProject(projectId);
    await requireProjectRole(projectId, request.user!.id, ['OWNER']);
    const body = UpdateMemberRoleBodySchema.parse(request.body);

    const member = await prisma.projectMember.update({
      where: { id: memberId },
      data: { role: body.role },
      include: { user: true },
    });

    await reply.status(200).send({ success: true, data: member });
  });

  // DELETE /projects/:projectId/members/:memberId  — remove member
  app.delete('/:projectId/members/:memberId', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, memberId } = request.params as { projectId: string; memberId: string };
    await requireProjectRole(projectId, request.user!.id, ['OWNER']);
    const member = await prisma.projectMember.findFirst({ where: { id: memberId, projectId } });
    if (!member) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Member not found in project' } });
    if (member.userId === request.user!.id) return reply.status(400).send({ success: false, error: { code: 'OWNER_SELF_REMOVE', message: 'Owners cannot remove themselves' } });
    await prisma.projectMember.delete({ where: { id: memberId } });

    await reply.status(200).send({ success: true, data: { deleted: true } });
  });
}
