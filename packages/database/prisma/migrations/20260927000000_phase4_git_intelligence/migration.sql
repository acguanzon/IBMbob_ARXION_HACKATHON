-- Phase 4: Git-Verified Change Intelligence and Cross-Agent Impact Propagation

-- Enums
CREATE TYPE "GitProvider" AS ENUM ('GITHUB', 'GITLAB', 'BITBUCKET');
CREATE TYPE "RepositoryStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');
CREATE TYPE "ExternalEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED');
CREATE TYPE "ActualChangeType" AS ENUM ('ADDED', 'MODIFIED', 'DELETED', 'RENAMED');
CREATE TYPE "CodeEntityType" AS ENUM ('FILE', 'API', 'TYPE', 'MODEL', 'SCHEMA', 'EVENT', 'MODULE');
CREATE TYPE "CodeRelationshipKind" AS ENUM ('PROVIDES', 'CONSUMES', 'IMPORTS', 'DEPENDS_ON', 'IMPLEMENTS', 'MODIFIES', 'DEFINES', 'CALLS');
CREATE TYPE "RelationshipSource" AS ENUM ('DETERMINISTIC', 'DECLARED', 'INFERRED');
CREATE TYPE "Confidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "ContractChangeKind" AS ENUM ('ADDED', 'REMOVED', 'MODIFIED', 'RENAMED');
CREATE TYPE "CoordinationRiskType" AS ENUM ('FILE_OVERLAP', 'CONTRACT_CHANGE', 'DEPENDENCY_CHANGE', 'SCOPE_EXPANSION', 'SCHEMA_CHANGE', 'STALE_REVIEW', 'BRANCH_DIVERGENCE', 'MERGE_CONFLICT', 'ARCHITECTURAL_CONFLICT');
CREATE TYPE "RiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "CoordinationRiskStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');
CREATE TYPE "ContextUpdateStatus" AS ENUM ('UNREAD', 'READ', 'ACKNOWLEDGED', 'RESOLVED');

-- Add Phase 4 columns to task_git_links
ALTER TABLE "task_git_links"
  ADD COLUMN "repositoryId" TEXT,
  ADD COLUMN "aheadCount" INTEGER,
  ADD COLUMN "behindCount" INTEGER,
  ADD COLUMN "divergenceCheckedAt" TIMESTAMP(3);

-- ProjectRepository
CREATE TABLE "project_repositories" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "provider" "GitProvider" NOT NULL DEFAULT 'GITHUB',
  "owner" TEXT NOT NULL,
  "repository" TEXT NOT NULL,
  "defaultBranch" TEXT NOT NULL DEFAULT 'main',
  "externalRepositoryId" TEXT,
  "webhookSecret" TEXT,
  "status" "RepositoryStatus" NOT NULL DEFAULT 'CONNECTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_repositories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_repositories_projectId_owner_repository_key"
  ON "project_repositories"("projectId", "owner", "repository");

-- FK from task_git_links to project_repositories
ALTER TABLE "task_git_links"
  ADD CONSTRAINT "task_git_links_repositoryId_fkey"
  FOREIGN KEY ("repositoryId") REFERENCES "project_repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ExternalEvent
CREATE TABLE "external_events" (
  "id" TEXT NOT NULL,
  "provider" "GitProvider" NOT NULL DEFAULT 'GITHUB',
  "externalEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "repositoryId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "status" "ExternalEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "errorMessage" TEXT,
  CONSTRAINT "external_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_events_provider_externalEventId_key"
  ON "external_events"("provider", "externalEventId");
ALTER TABLE "external_events"
  ADD CONSTRAINT "external_events_repositoryId_fkey"
  FOREIGN KEY ("repositoryId") REFERENCES "project_repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TaskActualChange
CREATE TABLE "task_actual_changes" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "repositoryId" TEXT NOT NULL,
  "commitSha" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "changeType" "ActualChangeType" NOT NULL,
  "additions" INTEGER NOT NULL DEFAULT 0,
  "deletions" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_actual_changes_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "task_actual_changes"
  ADD CONSTRAINT "task_actual_changes_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_actual_changes"
  ADD CONSTRAINT "task_actual_changes_repositoryId_fkey"
  FOREIGN KEY ("repositoryId") REFERENCES "project_repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CodeEntity
CREATE TABLE "code_entities" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "repositoryId" TEXT,
  "type" "CodeEntityType" NOT NULL,
  "name" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "symbolName" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "code_entities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "code_entities_projectId_filePath_name_type_key"
  ON "code_entities"("projectId", "filePath", "name", "type");
ALTER TABLE "code_entities"
  ADD CONSTRAINT "code_entities_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CodeRelationship
CREATE TABLE "code_relationships" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sourceEntityId" TEXT NOT NULL,
  "targetEntityId" TEXT NOT NULL,
  "relationship" "CodeRelationshipKind" NOT NULL,
  "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
  "source" "RelationshipSource" NOT NULL DEFAULT 'DETERMINISTIC',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "code_relationships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "code_relationships_sourceEntityId_targetEntityId_relationship_key"
  ON "code_relationships"("sourceEntityId", "targetEntityId", "relationship");
ALTER TABLE "code_relationships"
  ADD CONSTRAINT "code_relationships_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "code_relationships"
  ADD CONSTRAINT "code_relationships_sourceEntityId_fkey"
  FOREIGN KEY ("sourceEntityId") REFERENCES "code_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "code_relationships"
  ADD CONSTRAINT "code_relationships_targetEntityId_fkey"
  FOREIGN KEY ("targetEntityId") REFERENCES "code_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ContractChange
CREATE TABLE "contract_changes" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "previousRevision" TEXT,
  "currentRevision" TEXT,
  "changeKind" "ContractChangeKind" NOT NULL,
  "breaking" BOOLEAN,
  "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_changes_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "contract_changes"
  ADD CONSTRAINT "contract_changes_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_changes"
  ADD CONSTRAINT "contract_changes_entityId_fkey"
  FOREIGN KEY ("entityId") REFERENCES "code_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CoordinationRisk
CREATE TABLE "coordination_risks" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sourceTaskId" TEXT NOT NULL,
  "affectedTaskId" TEXT NOT NULL,
  "type" "CoordinationRiskType" NOT NULL,
  "severity" "RiskSeverity" NOT NULL DEFAULT 'MEDIUM',
  "confidence" "Confidence" NOT NULL DEFAULT 'HIGH',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "sourceEntityId" TEXT,
  "status" "CoordinationRiskStatus" NOT NULL DEFAULT 'OPEN',
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "coordination_risks_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "coordination_risks"
  ADD CONSTRAINT "coordination_risks_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coordination_risks"
  ADD CONSTRAINT "coordination_risks_sourceTaskId_fkey"
  FOREIGN KEY ("sourceTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coordination_risks"
  ADD CONSTRAINT "coordination_risks_affectedTaskId_fkey"
  FOREIGN KEY ("affectedTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coordination_risks"
  ADD CONSTRAINT "coordination_risks_sourceEntityId_fkey"
  FOREIGN KEY ("sourceEntityId") REFERENCES "code_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ContextUpdate
CREATE TABLE "context_updates" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sourceTaskId" TEXT NOT NULL,
  "affectedTaskId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "entityId" TEXT,
  "riskId" TEXT,
  "status" "ContextUpdateStatus" NOT NULL DEFAULT 'UNREAD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  CONSTRAINT "context_updates_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "context_updates"
  ADD CONSTRAINT "context_updates_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "context_updates"
  ADD CONSTRAINT "context_updates_sourceTaskId_fkey"
  FOREIGN KEY ("sourceTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "context_updates"
  ADD CONSTRAINT "context_updates_affectedTaskId_fkey"
  FOREIGN KEY ("affectedTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "context_updates"
  ADD CONSTRAINT "context_updates_entityId_fkey"
  FOREIGN KEY ("entityId") REFERENCES "code_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FK from project_repositories to projects
ALTER TABLE "project_repositories"
  ADD CONSTRAINT "project_repositories_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
