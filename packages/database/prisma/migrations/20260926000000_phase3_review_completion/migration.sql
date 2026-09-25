-- Phase 3: Review, Merge Readiness, Completion, and Context Propagation

-- CreateEnum
CREATE TYPE "ContractVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ReviewFindingSource" AS ENUM ('AI', 'HUMAN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReviewFindingCategory" AS ENUM ('GENERAL', 'FILE', 'CONTRACT', 'TEST', 'ARCHITECTURE', 'SECURITY', 'DEPENDENCY', 'SCOPE');

-- CreateEnum
CREATE TYPE "ReviewFindingSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReviewFindingStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "MergeStatus" AS ENUM ('NOT_STARTED', 'READY', 'MERGED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectDecisionStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'DEPRECATED');

-- AlterEnum: add new values to ReviewStatus
ALTER TYPE "ReviewStatus" ADD VALUE 'IN_REVIEW';
ALTER TYPE "ReviewStatus" ADD VALUE 'INVALIDATED';
ALTER TYPE "ReviewStatus" ADD VALUE 'REJECTED';
ALTER TYPE "ReviewStatus" ADD VALUE 'SUPERSEDED';

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_reviewerId_fkey";

-- AlterTable: expand reviews for Phase 3 lifecycle
ALTER TABLE "reviews"
  DROP COLUMN "reviewerId",
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "invalidatedAt" TIMESTAMP(3),
  ADD COLUMN "invalidationReason" TEXT,
  ADD COLUMN "requestedById" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "reviewRevision" TEXT,
  ADD COLUMN "reviewVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "review_snapshots" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "workRevision" TEXT NOT NULL,
    "gitCommitSha" TEXT,
    "branchName" TEXT,
    "completionReportId" TEXT,
    "declaredIntentSnapshot" JSONB,
    "contractSnapshot" JSONB,
    "fileSnapshot" JSONB,
    "testSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_completion_reports" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "agentSessionId" TEXT,
    "summary" TEXT NOT NULL,
    "filesChanged" TEXT[],
    "contractsChanged" TEXT[],
    "testsRun" INTEGER NOT NULL DEFAULT 0,
    "testsPassed" INTEGER NOT NULL DEFAULT 0,
    "testsFailed" INTEGER NOT NULL DEFAULT 0,
    "knownIssues" TEXT,
    "scopeChanges" TEXT,
    "workRevision" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_completion_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_findings" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "source" "ReviewFindingSource" NOT NULL,
    "category" "ReviewFindingCategory" NOT NULL DEFAULT 'GENERAL',
    "severity" "ReviewFindingSeverity" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "filePath" TEXT,
    "contractName" TEXT,
    "status" "ReviewFindingStatus" NOT NULL DEFAULT 'OPEN',
    "isBlocking" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "review_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_git_links" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "repositoryUrl" TEXT,
    "branchName" TEXT,
    "baseBranch" TEXT,
    "latestCommitSha" TEXT,
    "pullRequestUrl" TEXT,
    "pullRequestNumber" INTEGER,
    "mergeStatus" "MergeStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "mergedCommitSha" TEXT,
    "mergedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_git_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_versions" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ContractVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "schema" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "contract_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_decisions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "agentSessionId" TEXT,
    "status" "ProjectDecisionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededById" TEXT,

    CONSTRAINT "project_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_snapshots_reviewId_key" ON "review_snapshots"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "task_work_intents_taskId_key" ON "task_work_intents"("taskId");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_snapshots" ADD CONSTRAINT "review_snapshots_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_snapshots" ADD CONSTRAINT "review_snapshots_completionReportId_fkey" FOREIGN KEY ("completionReportId") REFERENCES "task_completion_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completion_reports" ADD CONSTRAINT "task_completion_reports_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completion_reports" ADD CONSTRAINT "task_completion_reports_agentSessionId_fkey" FOREIGN KEY ("agentSessionId") REFERENCES "agent_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_findings" ADD CONSTRAINT "review_findings_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_findings" ADD CONSTRAINT "review_findings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_git_links" ADD CONSTRAINT "task_git_links_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "task_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_decisions" ADD CONSTRAINT "project_decisions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_decisions" ADD CONSTRAINT "project_decisions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_decisions" ADD CONSTRAINT "project_decisions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
