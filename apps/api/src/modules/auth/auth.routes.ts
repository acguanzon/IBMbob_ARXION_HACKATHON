/**
 * Auth routes
 * POST /auth/register  — create user, return token
 * POST /auth/login     — return { token, user }
 * POST /auth/logout    — revoke session
 * GET  /auth/me        — return current user
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { prisma } from '@arxion/database';
import { RegisterBodySchema, LoginBodySchema } from '@arxion/types';
import { authenticate } from '../../lib/auth-middleware.js';

const scryptAsync = promisify(scrypt);

// 30-day session lifetime
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
  return derivedKey.toString('hex') === hash;
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/register
  app.post('/auth/register', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = RegisterBodySchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      await reply.status(409).send({
        success: false,
        error: { code: 'EMAIL_TAKEN', message: 'An account with that email already exists' },
      });
      return;
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: { name: body.name, email: body.email, passwordHash },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    const token = generateToken();
    await prisma.userSession.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    await reply.status(201).send({ success: true, data: { token, user } });
  });

  // POST /auth/login
  app.post('/auth/login', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = LoginBodySchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.passwordHash) {
      await reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
      return;
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      await reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
      return;
    }

    const token = generateToken();
    await prisma.userSession.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    await reply.status(200).send({
      success: true,
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
      },
    });
  });

  // POST /auth/logout  (requires auth)
  app.post('/auth/logout', { preHandler: authenticate }, async (req: FastifyRequest, reply: FastifyReply) => {
    const authHeader = req.headers['authorization'] as string;
    const token = authHeader.slice(7);

    await prisma.userSession.updateMany({
      where: { token },
      data: { revoked: true },
    });

    await reply.status(200).send({ success: true, data: { revoked: true } });
  });

  // GET /auth/me  (requires auth)
  app.get('/auth/me', { preHandler: authenticate }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
    });

    if (!user) {
      await reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    await reply.status(200).send({ success: true, data: user });
  });
}
