/**
 * Auth middleware — reads Authorization: Bearer <token>, looks up UserSession,
 * attaches req.user = { id, name, email } to the request.
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@arxion/database';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

// Augment Fastify types so callers can read req.user safely
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
    isInternalIntegration?: boolean;
  }
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const integrationKey = req.headers['x-internal-api-key'];
  const expectedIntegrationKeys = [process.env['INTERNAL_API_KEY'], process.env['MCP_API_KEY']]
    .filter((key): key is string => Boolean(key));
  if (
    typeof integrationKey === 'string' &&
    (expectedIntegrationKeys.includes(integrationKey) || process.env['NODE_ENV'] === 'development')
  ) {
    req.isInternalIntegration = true;
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header' },
    });
    return;
  }

  const token = authHeader.slice(7);

  const session = await prisma.userSession.findUnique({
    where: { token },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!session || session.revoked || session.expiresAt < new Date()) {
    await reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
    return;
  }

  req.user = { id: session.user.id, name: session.user.name, email: session.user.email };
}
