import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  // Zod validation errors
  if (error instanceof ZodError) {
    void reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.flatten(),
      },
    });
    return;
  }

  // Fastify validation errors (schema-based)
  if (error.statusCode === 400) {
    void reply.status(400).send({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: error.message,
      },
    });
    return;
  }

  // Not found
  if (error.statusCode === 404) {
    void reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: error.message || 'Resource not found',
      },
    });
    return;
  }

  // Generic server error
  void reply.status(error.statusCode ?? 500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env['NODE_ENV'] === 'production' ? 'Internal server error' : error.message,
    },
  });
}

export function notFound(message: string): FastifyError {
  const err = new Error(message) as FastifyError;
  err.statusCode = 404;
  return err;
}
