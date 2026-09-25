-- Phase 5: Reliable Multi-Agent Handoffs, Context Delivery, Recovery, and Safe Parallel Work

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "TaskReadinessState" AS ENUM (
  'READY',
  'BLOCKED_BY_DEPENDENCY',
  'AT_RISK',
  'WAITING_FOR_REVIEW',
  'WAITING_FOR_CONTEXT',
  'INTERRUPTED'
);

CREATE TYPE "HandoffStatus" AS ENUM (
  'PENDING',
  'DELIVERED',
  'ACKNOWLEDGED',
  'SUPERSEDED'
);

CREATE TYPE "ContextPackageStatus" AS ENUM (
  'CURRENT',
  'STALE',
  'SUPERSEDED'
);

CREATE TYPE "ParallelSafetyState" AS ENUM (
  'SAFE',
  'SAFE_WITH_WARNINGS',
  'UNSAFE',
  'UNKNOWN'
);

CREATE TYPE "RecoveryTrigger" AS ENUM (
  'SESSION_STALE',
  'SESSION_ENDED_UNEXPECTEDLY',
  'USER_PAUSED'
);

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- Task Readiness Evaluation
CREATE TABLE "task_readiness_evaluations" (
  "id"             TEXT NOT NULL,
  "taskId"         TEXT NOT NULL,
  "state"          "TaskReadinessState" NOT NULL,
  "reasons"        JSONB NOT NULL DEFAULT '[]',
  "sourceRevision" TEXT,
  "evaluatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "task_readiness_evaluations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_readiness_evaluations_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Task Handoff
CREATE TABLE "task_handoffs" (
  "id"                           TEXT NOT NULL,
  "projectId"                    TEXT NOT NULL,
  "sourceTaskId"                 TEXT NOT NULL,
  "targetTaskId"                 TEXT NOT NULL,
  "sourceRevision"               TEXT,
  "status"                       "HandoffStatus" NOT NULL DEFAULT 'PENDING',
  "summary"                      TEXT NOT NULL,
  "payload"                      JSONB NOT NULL DEFAULT '{}',
  "createdAt"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt"                  TIMESTAMP(3),
  "acknowledgedAt"               TIMESTAMP(3),
  "acknowledgedByAgentSessionId" TEXT,
  "supersededById"               TEXT,

  CONSTRAINT "task_handoffs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_handoffs_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_handoffs_sourceTaskId_fkey"
    FOREIGN KEY ("sourceTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_handoffs_targetTaskId_fkey"
    FOREIGN KEY ("targetTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Task Context Package
CREATE TABLE "task_context_packages" (
  "id"                    TEXT NOT NULL,
  "taskId"                TEXT NOT NULL,
  "contextVersion"        INTEGER NOT NULL DEFAULT 1,
  "generatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sourceProjectRevision" TEXT,
  "status"                "ContextPackageStatus" NOT NULL DEFAULT 'CURRENT',
  "content"               JSONB NOT NULL DEFAULT '{}',
  "supersededAt"          TIMESTAMP(3),

  CONSTRAINT "task_context_packages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_context_packages_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Recovery Snapshot
CREATE TABLE "recovery_snapshots" (
  "id"                     TEXT NOT NULL,
  "taskId"                 TEXT NOT NULL,
  "projectId"              TEXT NOT NULL,
  "previousAgentSessionId" TEXT,
  "trigger"                "RecoveryTrigger" NOT NULL,
  "lastKnownRevision"      TEXT,
  "lastProgressMessage"    TEXT,
  "activeWorkIntent"       JSONB,
  "actualScope"            JSONB,
  "activeContracts"        JSONB,
  "openRisks"              JSONB,
  "pendingContextUpdates"  JSONB,
  "pendingHandoffs"        JSONB,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recovery_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recovery_snapshots_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Parallel Safety Evaluation
CREATE TABLE "parallel_safety_evaluations" (
  "id"          TEXT NOT NULL,
  "projectId"   TEXT NOT NULL,
  "taskAId"     TEXT NOT NULL,
  "taskBId"     TEXT NOT NULL,
  "state"       "ParallelSafetyState" NOT NULL,
  "reasons"     JSONB NOT NULL DEFAULT '[]',
  "warnings"    JSONB NOT NULL DEFAULT '[]',
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "parallel_safety_evaluations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "parallel_safety_evaluations_taskAId_taskBId_key" UNIQUE ("taskAId", "taskBId"),
  CONSTRAINT "parallel_safety_evaluations_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "parallel_safety_evaluations_taskAId_fkey"
    FOREIGN KEY ("taskAId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "parallel_safety_evaluations_taskBId_fkey"
    FOREIGN KEY ("taskBId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Agent Integration Capability
CREATE TABLE "agent_integration_capabilities" (
  "id"                     TEXT NOT NULL,
  "projectId"              TEXT NOT NULL,
  "agentType"              TEXT NOT NULL,
  "supportsMcp"            BOOLEAN NOT NULL DEFAULT false,
  "supportsHeartbeat"      BOOLEAN NOT NULL DEFAULT false,
  "supportsContextUpdates" BOOLEAN NOT NULL DEFAULT false,
  "supportsHandoffs"       BOOLEAN NOT NULL DEFAULT false,
  "supportsRecovery"       BOOLEAN NOT NULL DEFAULT false,
  "supportsReviewTools"    BOOLEAN NOT NULL DEFAULT false,
  "protocolVersion"        TEXT,
  "registeredAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL,

  CONSTRAINT "agent_integration_capabilities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agent_integration_capabilities_projectId_agentType_key" UNIQUE ("projectId", "agentType"),
  CONSTRAINT "agent_integration_capabilities_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX "task_readiness_evaluations_taskId_idx" ON "task_readiness_evaluations"("taskId");
CREATE INDEX "task_handoffs_projectId_idx" ON "task_handoffs"("projectId");
CREATE INDEX "task_handoffs_sourceTaskId_idx" ON "task_handoffs"("sourceTaskId");
CREATE INDEX "task_handoffs_targetTaskId_idx" ON "task_handoffs"("targetTaskId");
CREATE INDEX "task_handoffs_status_idx" ON "task_handoffs"("status");
CREATE INDEX "task_context_packages_taskId_idx" ON "task_context_packages"("taskId");
CREATE INDEX "task_context_packages_status_idx" ON "task_context_packages"("status");
CREATE INDEX "recovery_snapshots_taskId_idx" ON "recovery_snapshots"("taskId");
CREATE INDEX "recovery_snapshots_projectId_idx" ON "recovery_snapshots"("projectId");
CREATE INDEX "parallel_safety_evaluations_projectId_idx" ON "parallel_safety_evaluations"("projectId");
