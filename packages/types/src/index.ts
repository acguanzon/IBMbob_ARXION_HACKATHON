import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const TaskStatusSchema = z.enum([
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'REVIEW',
  'DONE',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const ProjectMemberRoleSchema = z.enum(['OWNER', 'MEMBER', 'VIEWER']);
export type ProjectMemberRole = z.infer<typeof ProjectMemberRoleSchema>;

export const FileReservationStatusSchema = z.enum(['ACTIVE', 'RELEASED', 'CONFLICT', 'EXPIRED']);
export type FileReservationStatus = z.infer<typeof FileReservationStatusSchema>;

export const AgentTypeSchema = z.enum(['IBM_BOB', 'CURSOR', 'CLAUDE_CODE', 'OTHER']);
export type AgentType = z.infer<typeof AgentTypeSchema>;

export const AgentSessionStatusSchema = z.enum([
  'IDLE',
  'WORKING',
  'WAITING',
  'FINISHED',
  'STALE',
]);
export type AgentSessionStatus = z.infer<typeof AgentSessionStatusSchema>;

export const ReviewStatusSchema = z.enum(['PENDING', 'APPROVED', 'CHANGES_REQUESTED']);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const ContractTypeSchema = z.enum(['API', 'MODEL', 'SCHEMA', 'TYPE', 'EVENT', 'OTHER']);
export type ContractType = z.infer<typeof ContractTypeSchema>;

export const ContractRelationshipSchema = z.enum(['PROVIDES', 'MODIFIES', 'CONSUMES']);
export type ContractRelationship = z.infer<typeof ContractRelationshipSchema>;

// ─── Core Schemas ─────────────────────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type User = z.infer<typeof UserSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  repositoryUrl: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectMemberSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  userId: z.string(),
  role: ProjectMemberRoleSchema,
  joinedAt: z.coerce.date(),
});
export type ProjectMember = z.infer<typeof ProjectMemberSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  displayId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  assigneeId: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskDependencySchema = z.object({
  id: z.string(),
  taskId: z.string(),
  dependsOnTaskId: z.string(),
  createdAt: z.coerce.date(),
});
export type TaskDependency = z.infer<typeof TaskDependencySchema>;

export const TaskFileReservationSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  taskId: z.string(),
  userId: z.string(),
  agentSessionId: z.string().nullable(),
  filePath: z.string(),
  status: FileReservationStatusSchema,
  reservedAt: z.coerce.date(),
  leaseExpiresAt: z.coerce.date().nullable(),
  releasedAt: z.coerce.date().nullable(),
});
export type TaskFileReservation = z.infer<typeof TaskFileReservationSchema>;

export const AgentSessionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  userId: z.string(),
  taskId: z.string().nullable(),
  agentType: AgentTypeSchema,
  externalAgentId: z.string().nullable(),
  status: AgentSessionStatusSchema,
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().nullable(),
  lastSeenAt: z.coerce.date(),
});
export type AgentSession = z.infer<typeof AgentSessionSchema>;

export const TaskActivitySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  taskId: z.string().nullable(),
  userId: z.string().nullable(),
  agentSessionId: z.string().nullable(),
  type: z.string(),
  message: z.string(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.coerce.date(),
});
export type TaskActivity = z.infer<typeof TaskActivitySchema>;

export const ReviewSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  reviewerId: z.string(),
  status: ReviewStatusSchema,
  comment: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Review = z.infer<typeof ReviewSchema>;

export const TaskContractSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  taskId: z.string(),
  type: ContractTypeSchema,
  name: z.string(),
  relationship: ContractRelationshipSchema,
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type TaskContract = z.infer<typeof TaskContractSchema>;

export const TaskWorkIntentSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  files: z.array(z.string()),
  apis: z.array(z.string()),
  models: z.array(z.string()),
  contracts: z.array(z.string()),
  summary: z.string().nullable(),
  declaredAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type TaskWorkIntent = z.infer<typeof TaskWorkIntentSchema>;

// ─── Request / Response Schemas ───────────────────────────────────────────────

export const CreateProjectBodySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  repositoryUrl: z.string().url().optional(),
});
export type CreateProjectBody = z.infer<typeof CreateProjectBodySchema>;

export const CreateTaskBodySchema = z.object({
  displayId: z.string().min(1).max(20),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: TaskStatusSchema.optional().default('BACKLOG'),
  priority: TaskPrioritySchema.optional().default('MEDIUM'),
  assigneeId: z.string().optional(),
});
export type CreateTaskBody = z.infer<typeof CreateTaskBodySchema>;

export const UpdateTaskBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  assigneeId: z.string().nullable().optional(),
});
export type UpdateTaskBody = z.infer<typeof UpdateTaskBodySchema>;

export const ClaimTaskBodySchema = z.object({
  userId: z.string().min(1),
});
export type ClaimTaskBody = z.infer<typeof ClaimTaskBodySchema>;

export const CreateAgentSessionBodySchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1),
  taskId: z.string().optional(),
  agentType: AgentTypeSchema.optional().default('IBM_BOB'),
  externalAgentId: z.string().optional(),
});
export type CreateAgentSessionBody = z.infer<typeof CreateAgentSessionBodySchema>;

export const ReserveFilesBodySchema = z.object({
  userId: z.string().min(1),
  agentSessionId: z.string().optional(),
  filePaths: z.array(z.string().min(1)).min(1).max(50),
  leaseDurationSeconds: z.number().int().min(30).max(3600).optional().default(120),
});
export type ReserveFilesBody = z.infer<typeof ReserveFilesBodySchema>;

export const ReleaseFilesBodySchema = z.object({
  userId: z.string().min(1),
  filePaths: z.array(z.string().min(1)).min(1),
});
export type ReleaseFilesBody = z.infer<typeof ReleaseFilesBodySchema>;

export const DeclareWorkIntentBodySchema = z.object({
  files: z.array(z.string()).default([]),
  apis: z.array(z.string()).default([]),
  models: z.array(z.string()).default([]),
  contracts: z.array(z.string()).default([]),
  summary: z.string().max(1000).optional(),
});
export type DeclareWorkIntentBody = z.infer<typeof DeclareWorkIntentBodySchema>;

export const DeclareContractBodySchema = z.object({
  type: ContractTypeSchema,
  name: z.string().min(1).max(200),
  relationship: ContractRelationshipSchema,
  metadata: z.record(z.unknown()).optional(),
});
export type DeclareContractBody = z.infer<typeof DeclareContractBodySchema>;

export const ReportProgressBodySchema = z.object({
  userId: z.string().min(1),
  message: z.string().min(1).max(2000),
  agentSessionId: z.string().optional(),
});
export type ReportProgressBody = z.infer<typeof ReportProgressBodySchema>;

// ─── Extended / Rich Schemas (with relations) ──────────────────────────────────

export const TaskWithRelationsSchema = TaskSchema.extend({
  assignee: UserSchema.nullable(),
  createdBy: UserSchema,
  dependencies: z.array(
    TaskDependencySchema.extend({
      dependsOn: TaskSchema,
    }),
  ),
});
export type TaskWithRelations = z.infer<typeof TaskWithRelationsSchema>;

export const ProjectWithMembersSchema = ProjectSchema.extend({
  members: z.array(
    ProjectMemberSchema.extend({
      user: UserSchema,
    }),
  ),
  _count: z.object({ tasks: z.number() }),
});
export type ProjectWithMembers = z.infer<typeof ProjectWithMembersSchema>;

// ─── Coordination types ────────────────────────────────────────────────────────

export interface FileConflict {
  filePath: string;
  existingReservation: {
    id: string;
    userId: string;
    userName: string;
    taskId: string;
    taskDisplayId: string;
    agentSessionId: string | null;
    reservedAt: Date;
    leaseExpiresAt: Date | null;
  };
}

export interface ContractRisk {
  contractName: string;
  contractType: string;
  sourceTaskId: string;
  sourceTaskDisplayId: string;
  sourceRelationship: ContractRelationship;
  affectedTaskId: string;
  affectedTaskDisplayId: string;
  affectedRelationship: ContractRelationship;
}

export interface CoordinationPreflight {
  task: Task & { assignee: User | null };
  sessionId: string;
  dependencies: Array<{ task: Task; isBlocked: boolean }>;
  activeTeammates: Array<{
    userId: string;
    userName: string;
    taskId: string;
    taskDisplayId: string;
    agentType: AgentType;
    status: AgentSessionStatus;
  }>;
  fileConflicts: FileConflict[];
  contractRisks: ContractRisk[];
  coordinationStatus: 'READY' | 'READY_WITH_WARNINGS' | 'BLOCKED';
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ─── Domain Event Types ────────────────────────────────────────────────────────

export type DomainEventType =
  | 'task.created'
  | 'task.claimed'
  | 'task.released'
  | 'task.started'
  | 'task.updated'
  | 'task.progress'
  | 'task.review_requested'
  | 'task.completed'
  | 'file.reserved'
  | 'file.released'
  | 'file.conflict'
  | 'file.expired'
  | 'agent.started'
  | 'agent.heartbeat'
  | 'agent.stale'
  | 'agent.ended'
  | 'agent.updated'
  | 'contract.declared'
  | 'contract.risk_detected'
  | 'member.joined';

export interface DomainEvent<T = unknown> {
  type: DomainEventType;
  projectId: string;
  payload: T;
  timestamp: string;
}
