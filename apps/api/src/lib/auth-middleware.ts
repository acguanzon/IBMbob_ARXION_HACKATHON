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
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const expectedIntegrationKeys = [process.env['INTERNAL_API_KEY'], process.env['MCP_API_KEY']]
    .filter((key): key is string => Boolean(key));

  const isMatchedKey =
    (typeof integrationKey === 'string' && expectedIntegrationKeys.includes(integrationKey)) ||
    (typeof bearerToken === 'string' && expectedIntegrationKeys.includes(bearerToken)) ||
    (typeof integrationKey === 'string' && process.env['NODE_ENV'] === 'development');

  if (isMatchedKey) {
    req.isInternalIntegration = true;
    const defaultUser = await prisma.user.findFirst({ select: { id: true, name: true, email: true } });
    if (defaultUser) {
      req.user = defaultUser;
    }
    return;
  }

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
