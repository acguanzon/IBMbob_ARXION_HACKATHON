/**
 * Webhook Routes — Phase 4
 *
 * Receives GitHub webhook deliveries.
 * The raw body must be read before JSON parsing for signature verification.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { processGitHubWebhook } from './webhook.service.js'

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /webhooks/github/:repositoryId
   *
   * GitHub sends the delivery to this endpoint.
   * The :repositoryId is the internal ProjectRepository.id so we can look up
   * the webhook secret without exposing it in the URL.
   */
  app.post(
    '/webhooks/github/:repositoryId',
    {
      config: { rawBody: true },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { repositoryId } = req.params as { repositoryId: string }

      const deliveryId =
        (req.headers['x-github-delivery'] as string | undefined) ?? `no-delivery-${Date.now()}`
      const eventType = (req.headers['x-github-event'] as string | undefined) ?? 'unknown'
      const signature = req.headers['x-hub-signature-256'] as string | undefined

      // Access raw body — Fastify does not expose it by default;
      // we use the body buffer if available (added by rawBody plugin or content-type handling).
      const rawPayload: Buffer =
        (req as FastifyRequest & { rawBody?: Buffer }).rawBody ??
        Buffer.from(JSON.stringify(req.body))

      const result = await processGitHubWebhook({
        repositoryId,
        deliveryId,
        eventType,
        signature,
        rawPayload,
      })

      const statusCode = result.status === 'FAILED' ? 400 : 200
      await reply.status(statusCode).send({ status: result.status, message: result.message })
    },
  )
}
