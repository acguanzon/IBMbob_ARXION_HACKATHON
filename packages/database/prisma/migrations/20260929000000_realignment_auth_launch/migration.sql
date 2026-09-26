-- Migration: realignment_auth_launch
-- Adds: passwordHash to users, UserSession, AgentLaunchRequest, acceptanceCriteria to tasks

-- Add passwordHash to users
ALTER TABLE "users" ADD COLUMN "passwordHash" TEXT;

-- Add acceptanceCriteria to tasks
ALTER TABLE "tasks" ADD COLUMN "acceptanceCriteria" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AgentLaunchStatus enum
CREATE TYPE "AgentLaunchStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED', 'FAILED');

-- UserSession table
CREATE TABLE "user_sessions" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "token"     TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked"   BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_sessions_token_key" ON "user_sessions"("token");

ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AgentLaunchRequest table
CREATE TABLE "agent_launch_requests" (
    "id"               TEXT NOT NULL,
    "projectId"        TEXT NOT NULL,
    "taskId"           TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "agentType"        TEXT NOT NULL,
    "status"           "AgentLaunchStatus" NOT NULL DEFAULT 'PENDING',
    "contextPackageId" TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt"       TIMESTAMP(3),
    "expiredAt"        TIMESTAMP(3),
    "agentSessionId"   TEXT,

    CONSTRAINT "agent_launch_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "agent_launch_requests" ADD CONSTRAINT "agent_launch_requests_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_launch_requests" ADD CONSTRAINT "agent_launch_requests_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_launch_requests" ADD CONSTRAINT "agent_launch_requests_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
