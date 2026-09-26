CREATE TABLE "task_code_entities" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "task_code_entities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_code_entities_taskId_entityId_key" ON "task_code_entities"("taskId", "entityId");
CREATE INDEX "task_code_entities_projectId_entityId_idx" ON "task_code_entities"("projectId", "entityId");
ALTER TABLE "task_code_entities" ADD CONSTRAINT "task_code_entities_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_code_entities" ADD CONSTRAINT "task_code_entities_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_code_entities" ADD CONSTRAINT "task_code_entities_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "code_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
