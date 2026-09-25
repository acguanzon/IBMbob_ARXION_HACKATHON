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

export const FileReservationStatusSchema = z.enum(['ACTIVE', 'RELEASED', 'CONFLICT']);
export type FileReservationStatus = z.infer<typeof FileReservationStatusSchema>;

export const AgentTypeSchema = z.enum(['IBM_BOB', 'CURSOR', 'CLAUDE_CODE', 'OTHER']);
export type AgentType = z.infer<typeof AgentTypeSchema>;

export const AgentSessionStatusSchema = z.enum(['IDLE', 'WORKING', 'WAITING', 'FINISHED']);
export type AgentSessionStatus = z.infer<typeof AgentSessionStatusSchema>;

export const ReviewStatusSchema = z.enum(['PENDING', 'APPROVED', 'CHANGES_REQUESTED']);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

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
// Lightweight event type used by the realtime layer

export type DomainEventType =
  | 'task.created'
  | 'task.claimed'
  | 'task.started'
  | 'task.updated'
  | 'task.progress'
  | 'task.review_requested'
  | 'task.completed'
  | 'file.reserved'
  | 'file.released'
  | 'file.conflict'
  | 'agent.started'
  | 'agent.updated'
  | 'agent.ended'
  | 'member.joined';

export interface DomainEvent<T = unknown> {
  type: DomainEventType;
  projectId: string;
  payload: T;
  timestamp: string;
}
