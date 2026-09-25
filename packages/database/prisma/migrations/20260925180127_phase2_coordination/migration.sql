-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('API', 'MODEL', 'SCHEMA', 'TYPE', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractRelationship" AS ENUM ('PROVIDES', 'MODIFIES', 'CONSUMES');

-- AlterEnum
ALTER TYPE "AgentSessionStatus" ADD VALUE 'STALE';

-- AlterEnum
ALTER TYPE "FileReservationStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "task_file_reservations" ADD COLUMN     "leaseExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "task_contracts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "type" "ContractType" NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" "ContractRelationship" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_work_intents" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "files" TEXT[],
    "apis" TEXT[],
    "models" TEXT[],
    "contracts" TEXT[],
    "summary" TEXT,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_work_intents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "task_contracts" ADD CONSTRAINT "task_contracts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_contracts" ADD CONSTRAINT "task_contracts_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_work_intents" ADD CONSTRAINT "task_work_intents_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
