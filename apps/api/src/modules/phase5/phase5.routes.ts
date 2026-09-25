/**
 * Phase 5 Routes
 *
 * Task Readiness, Handoffs, Context Packages, Recovery, Parallel Safety,
 * Coordinator Summary, Agent Capability Registration.
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '@arxion/database'
import { calculateReadiness, getLatestReadiness } from '../phase5/readiness.service.js'
import {
  getTaskHandoffs,
  getHandoff,
  acknowledgeHandoff,
} from '../phase5/handoff.service.js'
import {
  buildContextPackage,
  getCurrentContextPackage,
} from '../phase5/context-package.service.js'
import {
  getRecoveryContext,
  resumeTask,
  createRecoverySnapshot,
} from '../phase5/recovery.service.js'
import {
  evaluateParallelSafety,
  getSafeParallelTasks,
  getParallelWorkGroups,
} from '../phase5/parallel-safety.service.js'
import { getCoordinatorSummary } from '../phase5/coordinator.service.js'

export async function phase5Routes(app: FastifyInstance): Promise<void> {

  // ─── Readiness ──────────────────────────────────────────────────────────

  // GET /tasks/:taskId/readiness — get latest cached readiness
  app.get('/tasks/:taskId/readiness', async (req, reply) => {
    const { taskId } = req.params as { taskId: string }
    const result = await getLatestReadiness(taskId)
    if (!result) {
      // Calculate on demand
      const fresh = await calculateReadiness(taskId)
      return reply.send(fresh)
    }
    return reply.send(result)
  })

  // POST /tasks/:taskId/readiness/recalculate — force recalculation
  app.post('/tasks/:taskId/readiness/recalculate', async (req, reply) => {
    const { taskId } = req.params as { taskId: string }
    const result = await calculateReadiness(taskId)
    return reply.send(result)
  })

  // ─── Handoffs ───────────────────────────────────────────────────────────

  // GET /tasks/:taskId/handoffs — all non-superseded handoffs for a task
  app.get('/tasks/:taskId/handoffs', async (req, reply) => {
    const { taskId } = req.params as { taskId: string }
    const handoffs = await getTaskHandoffs(taskId)
    return reply.send(handoffs)
  })

  // GET /handoffs/:handoffId
  app.get('/handoffs/:handoffId', async (req, reply) => {
    const { handoffId } = req.params as { handoffId: string }
    const handoff = await getHandoff(handoffId)
    return reply.send(handoff)
  })

  // POST /handoffs/:handoffId/acknowledge
  app.post('/handoffs/:handoffId/acknowledge', async (req, reply) => {
    const { handoffId } = req.params as { handoffId: string }
    const { agentSessionId } = (req.body as { agentSessionId?: string }) ?? {}
    const updated = await acknowledgeHandoff(handoffId, agentSessionId)
    return reply.send(updated)
  })

  // ─── Context Packages ───────────────────────────────────────────────────

  // GET /tasks/:taskId/context-package — current package (or generate)
  app.get('/tasks/:taskId/context-package', async (req, reply) => {
    const { taskId } = req.params as { taskId: string }
    const existing = await getCurrentContextPackage(taskId)
    if (existing) return reply.send(existing)
    const fresh = await buildContextPackage(taskId)
    return reply.send(fresh)
  })

  // POST /tasks/:taskId/context-package/refresh — force regeneration
  app.post('/tasks/:taskId/context-package/refresh', async (req, reply) => {
    const { taskId } = req.params as { taskId: string }
    const pkg = await buildContextPackage(taskId)
    return reply.send(pkg)
  })

  // ─── Recovery ───────────────────────────────────────────────────────────

  // GET /tasks/:taskId/recovery — get recovery context + delta
  app.get('/tasks/:taskId/recovery', async (req, reply) => {
    const { taskId } = req.params as { taskId: string }
    const ctx = await getRecoveryContext(taskId)
    return reply.send(ctx)
  })

  // POST /tasks/:taskId/recovery/snapshot — manually create snapshot (USER_PAUSED)
  app.post('/tasks/:taskId/recovery/snapshot', async (req, reply) => {
    const { taskId } = req.params as { taskId: string }
    const { agentSessionId } = (req.body as { agentSessionId?: string }) ?? {}
    if (!agentSessionId) return reply.status(400).send({ error: 'agentSessionId required' })
    await createRecoverySnapshot({ taskId, previousAgentSessionId: agentSessionId, trigger: 'USER_PAUSED' })
    return reply.send({ ok: true })
  })

  // POST /tasks/:taskId/resume — resume a task with a new agent session
  app.post('/tasks/:taskId/resume', async (req, reply) => {
    const { taskId } = req.params as { taskId: string }
    const { userId, agentType } = req.body as { userId: string; agentType?: string }
    if (!userId) return reply.status(400).send({ error: 'userId required' })
    const result = await resumeTask({ taskId, userId, agentType })
    return reply.send(result)
  })

  // ─── Parallel Safety ────────────────────────────────────────────────────

  // GET /projects/:projectId/parallel-safety?taskAId=&taskBId=
  app.get('/projects/:projectId/parallel-safety', async (req, reply) => {
    const { taskAId, taskBId } = req.query as { taskAId?: string; taskBId?: string }
    if (!taskAId || !taskBId) {
      return reply.status(400).send({ error: 'taskAId and taskBId required' })
    }
    const result = await evaluateParallelSafety(taskAId, taskBId)
    return reply.send(result)
  })

  // GET /projects/:projectId/safe-parallel-tasks
  app.get('/projects/:projectId/safe-parallel-tasks', async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    const result = await getSafeParallelTasks(projectId)
    return reply.send(result)
  })

  // GET /projects/:projectId/parallel-work-groups
  app.get('/projects/:projectId/parallel-work-groups', async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    const groups = await getParallelWorkGroups(projectId)
    return reply.send(groups)
  })

  // ─── Coordinator Summary ────────────────────────────────────────────────

  // GET /projects/:projectId/coordinator-summary
  app.get('/projects/:projectId/coordinator-summary', async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    const summary = await getCoordinatorSummary(projectId)
    return reply.send(summary)
  })

  // ─── Agent Capability Registration ─────────────────────────────────────

  // POST /projects/:projectId/agent-capabilities — register/update
  app.post('/projects/:projectId/agent-capabilities', async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    const body = req.body as {
      agentType: string
      supportsMcp?: boolean
      supportsHeartbeat?: boolean
      supportsContextUpdates?: boolean
      supportsHandoffs?: boolean
      supportsRecovery?: boolean
      supportsReviewTools?: boolean
      protocolVersion?: string
    }
    if (!body.agentType) return reply.status(400).send({ error: 'agentType required' })

    const capability = await prisma.agentIntegrationCapability.upsert({
      where: { projectId_agentType: { projectId, agentType: body.agentType } },
      create: {
        projectId,
        agentType: body.agentType,
        supportsMcp: body.supportsMcp ?? false,
        supportsHeartbeat: body.supportsHeartbeat ?? false,
        supportsContextUpdates: body.supportsContextUpdates ?? false,
        supportsHandoffs: body.supportsHandoffs ?? false,
        supportsRecovery: body.supportsRecovery ?? false,
        supportsReviewTools: body.supportsReviewTools ?? false,
        protocolVersion: body.protocolVersion ?? null,
      },
      update: {
        supportsMcp: body.supportsMcp ?? false,
        supportsHeartbeat: body.supportsHeartbeat ?? false,
        supportsContextUpdates: body.supportsContextUpdates ?? false,
        supportsHandoffs: body.supportsHandoffs ?? false,
        supportsRecovery: body.supportsRecovery ?? false,
        supportsReviewTools: body.supportsReviewTools ?? false,
        protocolVersion: body.protocolVersion ?? null,
        updatedAt: new Date(),
      },
    })
    return reply.send(capability)
  })

  // GET /projects/:projectId/agent-capabilities
  app.get('/projects/:projectId/agent-capabilities', async (req, reply) => {
    const { projectId } = req.params as { projectId: string }
    const capabilities = await prisma.agentIntegrationCapability.findMany({
      where: { projectId },
      orderBy: { registeredAt: 'asc' },
    })
    return reply.send(capabilities)
  })
}
