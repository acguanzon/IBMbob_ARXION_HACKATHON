import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AcknowledgeRiskBodySchema } from '@arxion/types'
import {
  getProjectRisks,
  getTaskRisks,
  acknowledgeRisk,
} from '../webhooks/risk-engine.service.js'
import { getImpactAnalysis } from '../webhooks/contract-change.service.js'
import { getActualChanges, getActualScopeAnalysis } from '../webhooks/actual-changes.service.js'
import {
  getContextUpdates,
  acknowledgeContextUpdate,
} from '../webhooks/context-update.service.js'
import { AcknowledgeContextUpdateBodySchema } from '@arxion/types'
import { checkBranchDivergence } from '../git/branch-divergence.service.js'

export async function phase4Routes(app: FastifyInstance): Promise<void> {
  // ── Risks ──────────────────────────────────────────────────────────────────

  // GET /projects/:projectId/risks
  app.get('/projects/:projectId/risks', async (req: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = req.params as { projectId: string }
    const { status } = req.query as { status?: string }
    const risks = await getProjectRisks(projectId, status)
    await reply.status(200).send({ success: true, data: risks })
  })

  // GET /tasks/:taskId/risks
  app.get('/tasks/:taskId/risks', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string }
    const risks = await getTaskRisks(taskId)
    await reply.status(200).send({ success: true, data: risks })
  })

  // PATCH /risks/:riskId/acknowledge
  app.patch('/risks/:riskId/acknowledge', async (req: FastifyRequest, reply: FastifyReply) => {
    const { riskId } = req.params as { riskId: string }
    const body = AcknowledgeRiskBodySchema.parse(req.body)
    const risk = await acknowledgeRisk(riskId, body.status)
    await reply.status(200).send({ success: true, data: risk })
  })

  // ── Impact Analysis ────────────────────────────────────────────────────────

  // GET /entities/:entityId/impact
  app.get('/entities/:entityId/impact', async (req: FastifyRequest, reply: FastifyReply) => {
    const { entityId } = req.params as { entityId: string }
    const analysis = await getImpactAnalysis(entityId)
    await reply.status(200).send({ success: true, data: analysis })
  })

  // ── Actual Changes ─────────────────────────────────────────────────────────

  // GET /tasks/:taskId/actual-changes
  app.get('/tasks/:taskId/actual-changes', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string }
    const changes = await getActualChanges(taskId)
    await reply.status(200).send({ success: true, data: changes })
  })

  // GET /tasks/:taskId/scope-analysis
  app.get('/tasks/:taskId/scope-analysis', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string }
    const analysis = await getActualScopeAnalysis(taskId)
    await reply.status(200).send({ success: true, data: analysis })
  })

  // ── Context Updates ────────────────────────────────────────────────────────

  // GET /tasks/:taskId/context-updates
  app.get('/tasks/:taskId/context-updates', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string }
    const { status } = req.query as { status?: string }
    const updates = await getContextUpdates(taskId, status)
    await reply.status(200).send({ success: true, data: updates })
  })

  // PATCH /context-updates/:updateId/acknowledge
  app.patch(
    '/context-updates/:updateId/acknowledge',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { updateId } = req.params as { updateId: string }
      const body = AcknowledgeContextUpdateBodySchema.parse(req.body)
      const update = await acknowledgeContextUpdate(updateId, body.status)
      await reply.status(200).send({ success: true, data: update })
    },
  )

  // ── Branch Status ──────────────────────────────────────────────────────────

  // GET /tasks/:taskId/branch-status
  app.get('/tasks/:taskId/branch-status', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string }
    const status = await checkBranchDivergence(taskId)
    await reply.status(200).send({ success: true, data: status })
  })
}
