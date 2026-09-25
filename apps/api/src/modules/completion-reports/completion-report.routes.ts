import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SubmitCompletionReportBodySchema } from '@arxion/types';
import { submitCompletionReport, getCompletionReport } from './completion-report.service.js';

export async function completionReportRoutes(app: FastifyInstance): Promise<void> {
  // POST /tasks/:taskId/completion-report
  app.post('/tasks/:taskId/completion-report', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const body = SubmitCompletionReportBodySchema.parse(req.body);
    const report = await submitCompletionReport(taskId, body);
    await reply.status(201).send({ success: true, data: report });
  });

  // GET /tasks/:taskId/completion-report
  app.get('/tasks/:taskId/completion-report', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const report = await getCompletionReport(taskId);
    if (!report) {
      await reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: `No completion report for task ${taskId}` },
      });
      return;
    }
    await reply.status(200).send({ success: true, data: report });
  });
}
