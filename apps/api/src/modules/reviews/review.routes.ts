import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  RequestReviewBodySchema,
  ApproveReviewBodySchema,
  RequestChangesBodySchema,
} from '@arxion/types';
import {
  runReviewPreflight,
  requestReview,
  getReview,
  getReviewsForTask,
  approveReview,
  requestChanges,
} from './review.service.js';
import { runAiReview } from './ai-review.service.js';

export async function reviewRoutes(app: FastifyInstance): Promise<void> {
  // GET /tasks/:taskId/review-preflight
  app.get('/tasks/:taskId/review-preflight', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const preflight = await runReviewPreflight(taskId);
    await reply.status(200).send({ success: true, data: preflight });
  });

  // POST /tasks/:taskId/request-review
  app.post('/tasks/:taskId/request-review', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const body = RequestReviewBodySchema.parse(req.body);
    const result = await requestReview(taskId, body);
    await reply.status(201).send({ success: true, data: result });
  });

  // GET /tasks/:taskId/reviews
  app.get('/tasks/:taskId/reviews', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const reviews = await getReviewsForTask(taskId);
    await reply.status(200).send({ success: true, data: reviews });
  });

  // GET /reviews/:reviewId
  app.get('/reviews/:reviewId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { reviewId } = req.params as { reviewId: string };
    const review = await getReview(reviewId);
    await reply.status(200).send({ success: true, data: review });
  });

  // POST /reviews/:reviewId/approve
  app.post('/reviews/:reviewId/approve', async (req: FastifyRequest, reply: FastifyReply) => {
    const { reviewId } = req.params as { reviewId: string };
    const body = ApproveReviewBodySchema.parse(req.body);
    const review = await approveReview(reviewId, body);
    await reply.status(200).send({ success: true, data: review });
  });

  // POST /reviews/:reviewId/request-changes
  app.post('/reviews/:reviewId/request-changes', async (req: FastifyRequest, reply: FastifyReply) => {
    const { reviewId } = req.params as { reviewId: string };
    const body = RequestChangesBodySchema.parse(req.body);
    await requestChanges(reviewId, body);
    await reply.status(200).send({ success: true, data: { recorded: true } });
  });

  // POST /reviews/:reviewId/ai-review
  app.post('/reviews/:reviewId/ai-review', async (req: FastifyRequest, reply: FastifyReply) => {
    const { reviewId } = req.params as { reviewId: string };
    const result = await runAiReview(reviewId);
    await reply.status(200).send({ success: true, data: result });
  });
}
