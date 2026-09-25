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

// Phase 3: Expanded review status
export const ReviewStatusSchema = z.enum([
  'PENDING',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'INVALIDATED',
  'REJECTED',
  'SUPERSEDED',
]);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const ContractTypeSchema = z.enum(['API', 'MODEL', 'SCHEMA', 'TYPE', 'EVENT', 'OTHER']);
export type ContractType = z.infer<typeof ContractTypeSchema>;

export const ContractRelationshipSchema = z.enum(['PROVIDES', 'MODIFIES', 'CONSUMES']);
export type ContractRelationship = z.infer<typeof ContractRelationshipSchema>;

// Phase 3
export const ContractVersionStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'DEPRECATED', 'SUPERSEDED']);
export type ContractVersionStatus = z.infer<typeof ContractVersionStatusSchema>;

export const ReviewFindingSourceSchema = z.enum(['AI', 'HUMAN', 'SYSTEM']);
export type ReviewFindingSource = z.infer<typeof ReviewFindingSourceSchema>;

export const ReviewFindingCategorySchema = z.enum([
  'GENERAL',
  'FILE',
  'CONTRACT',
  'TEST',
  'ARCHITECTURE',
  'SECURITY',
  'DEPENDENCY',
  'SCOPE',
]);
export type ReviewFindingCategory = z.infer<typeof ReviewFindingCategorySchema>;

export const ReviewFindingSeveritySchema = z.enum([
  'INFO',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);
export type ReviewFindingSeverity = z.infer<typeof ReviewFindingSeveritySchema>;

export const ReviewFindingStatusSchema = z.enum(['OPEN', 'RESOLVED', 'DISMISSED']);
export type ReviewFindingStatus = z.infer<typeof ReviewFindingStatusSchema>;

export const MergeStatusSchema = z.enum([
  'NOT_STARTED',
  'READY',
  'MERGED',
  'FAILED',
  'CANCELLED',
]);
export type MergeStatus = z.infer<typeof MergeStatusSchema>;

export const ProjectDecisionStatusSchema = z.enum(['ACTIVE', 'SUPERSEDED', 'DEPRECATED']);
export type ProjectDecisionStatus = z.infer<typeof ProjectDecisionStatusSchema>;

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

// Phase 3: Full review schema
export const ReviewSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  requestedById: z.string(),
  status: ReviewStatusSchema,
  reviewVersion: z.number().int(),
  reviewRevision: z.string().nullable(),
  comment: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  approvedAt: z.coerce.date().nullable(),
  approvedById: z.string().nullable(),
  invalidatedAt: z.coerce.date().nullable(),
  invalidationReason: z.string().nullable(),
});
export type Review = z.infer<typeof ReviewSchema>;

// Phase 3: Immutable review snapshot
export const ReviewSnapshotSchema = z.object({
  id: z.string(),
  reviewId: z.string(),
  taskId: z.string(),
  workRevision: z.string(),
  gitCommitSha: z.string().nullable(),
  branchName: z.string().nullable(),
  completionReportId: z.string().nullable(),
  declaredIntentSnapshot: z.record(z.unknown()).nullable(),
  contractSnapshot: z.record(z.unknown()).nullable(),
  fileSnapshot: z.record(z.unknown()).nullable(),
  testSnapshot: z.record(z.unknown()).nullable(),
  createdAt: z.coerce.date(),
});
export type ReviewSnapshot = z.infer<typeof ReviewSnapshotSchema>;

// Phase 3: Completion report
export const TaskCompletionReportSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  agentSessionId: z.string().nullable(),
  summary: z.string(),
  filesChanged: z.array(z.string()),
  contractsChanged: z.array(z.string()),
  testsRun: z.number().int(),
  testsPassed: z.number().int(),
  testsFailed: z.number().int(),
  knownIssues: z.string().nullable(),
  scopeChanges: z.string().nullable(),
  workRevision: z.string(),
  createdAt: z.coerce.date(),
});
export type TaskCompletionReport = z.infer<typeof TaskCompletionReportSchema>;

// Phase 3: Review finding
export const ReviewFindingSchema = z.object({
  id: z.string(),
  reviewId: z.string(),
  source: ReviewFindingSourceSchema,
  category: ReviewFindingCategorySchema,
  severity: ReviewFindingSeveritySchema,
  title: z.string(),
  description: z.string(),
  filePath: z.string().nullable(),
  contractName: z.string().nullable(),
  status: ReviewFindingStatusSchema,
  isBlocking: z.boolean(),
  createdById: z.string().nullable(),
  createdAt: z.coerce.date(),
  resolvedAt: z.coerce.date().nullable(),
});
export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;

// Phase 3: Git link
export const TaskGitLinkSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  repositoryUrl: z.string().nullable(),
  branchName: z.string().nullable(),
  baseBranch: z.string().nullable(),
  latestCommitSha: z.string().nullable(),
  pullRequestUrl: z.string().nullable(),
  pullRequestNumber: z.number().int().nullable(),
  mergeStatus: MergeStatusSchema,
  mergedCommitSha: z.string().nullable(),
  mergedAt: z.coerce.date().nullable(),
  updatedAt: z.coerce.date(),
});
export type TaskGitLink = z.infer<typeof TaskGitLinkSchema>;

// Phase 3: Contract version
export const ContractVersionSchema = z.object({
  id: z.string(),
  contractId: z.string(),
  taskId: z.string(),
  version: z.number().int(),
  status: ContractVersionStatusSchema,
  schema: z.record(z.unknown()).nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.coerce.date(),
  activatedAt: z.coerce.date().nullable(),
});
export type ContractVersion = z.infer<typeof ContractVersionSchema>;

// Phase 3: Project decision
export const ProjectDecisionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  taskId: z.string().nullable(),
  title: z.string(),
  decision: z.string(),
  reason: z.string().nullable(),
  createdById: z.string(),
  agentSessionId: z.string().nullable(),
  status: ProjectDecisionStatusSchema,
  createdAt: z.coerce.date(),
  supersededById: z.string().nullable(),
});
export type ProjectDecision = z.infer<typeof ProjectDecisionSchema>;

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

// Phase 3: Submit completion report
export const SubmitCompletionReportBodySchema = z.object({
  userId: z.string().min(1),
  agentSessionId: z.string().optional(),
  summary: z.string().min(1).max(5000),
  filesChanged: z.array(z.string()).default([]),
  contractsChanged: z.array(z.string()).default([]),
  testsRun: z.number().int().min(0).default(0),
  testsPassed: z.number().int().min(0).default(0),
  testsFailed: z.number().int().min(0).default(0),
  knownIssues: z.string().max(2000).optional(),
  scopeChanges: z.string().max(2000).optional(),
  workRevision: z.string().min(1),
});
export type SubmitCompletionReportBody = z.infer<typeof SubmitCompletionReportBodySchema>;

// Phase 3: Request review
export const RequestReviewBodySchema = z.object({
  userId: z.string().min(1),
  agentSessionId: z.string().optional(),
});
export type RequestReviewBody = z.infer<typeof RequestReviewBodySchema>;

// Phase 3: Approve review
export const ApproveReviewBodySchema = z.object({
  reviewerId: z.string().min(1),
  comment: z.string().max(2000).optional(),
});
export type ApproveReviewBody = z.infer<typeof ApproveReviewBodySchema>;

// Phase 3: Request changes
export const RequestChangesBodySchema = z.object({
  reviewerId: z.string().min(1),
  comment: z.string().min(1).max(2000),
});
export type RequestChangesBody = z.infer<typeof RequestChangesBodySchema>;

// Phase 3: Add review finding
export const AddReviewFindingBodySchema = z.object({
  source: ReviewFindingSourceSchema,
  category: ReviewFindingCategorySchema.optional().default('GENERAL'),
  severity: ReviewFindingSeveritySchema.optional().default('MEDIUM'),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  filePath: z.string().optional(),
  contractName: z.string().optional(),
  isBlocking: z.boolean().optional().default(false),
  createdById: z.string().optional(),
});
export type AddReviewFindingBody = z.infer<typeof AddReviewFindingBodySchema>;

// Phase 3: Resolve finding
export const ResolveFindingBodySchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  resolvedById: z.string().optional(),
});
export type ResolveFindingBody = z.infer<typeof ResolveFindingBodySchema>;

// Phase 3: Register git link
export const RegisterGitLinkBodySchema = z.object({
  repositoryUrl: z.string().url().optional(),
  branchName: z.string().optional(),
  baseBranch: z.string().optional(),
  latestCommitSha: z.string().optional(),
  pullRequestUrl: z.string().url().optional(),
  pullRequestNumber: z.number().int().optional(),
});
export type RegisterGitLinkBody = z.infer<typeof RegisterGitLinkBodySchema>;

// Phase 3: Confirm merge
export const ConfirmMergeBodySchema = z.object({
  mergedCommitSha: z.string().optional(),
  mergedById: z.string().optional(),
});
export type ConfirmMergeBody = z.infer<typeof ConfirmMergeBodySchema>;

// Phase 3: Complete task
export const CompleteTaskBodySchema = z.object({
  userId: z.string().min(1),
});
export type CompleteTaskBody = z.infer<typeof CompleteTaskBodySchema>;

// Phase 3: Record project decision
export const RecordProjectDecisionBodySchema = z.object({
  title: z.string().min(1).max(200),
  decision: z.string().min(1).max(5000),
  reason: z.string().max(2000).optional(),
  createdById: z.string().min(1),
  taskId: z.string().optional(),
  agentSessionId: z.string().optional(),
});
export type RecordProjectDecisionBody = z.infer<typeof RecordProjectDecisionBodySchema>;

// Phase 3: AI review request
export const RunAiReviewBodySchema = z.object({
  requestedById: z.string().optional(),
});
export type RunAiReviewBody = z.infer<typeof RunAiReviewBodySchema>;

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

// Phase 3: Review with findings and snapshot
export const ReviewWithDetailsSchema = ReviewSchema.extend({
  requestedBy: UserSchema,
  approvedBy: UserSchema.nullable(),
  findings: z.array(ReviewFindingSchema),
  snapshot: ReviewSnapshotSchema.nullable(),
});
export type ReviewWithDetails = z.infer<typeof ReviewWithDetailsSchema>;

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

// Phase 3: Review preflight result
export interface ReviewPreflight {
  status: 'READY' | 'READY_WITH_WARNINGS' | 'BLOCKED';
  warnings: string[];
  blockers: string[];
  completionReport: TaskCompletionReport | null;
  scopeDeviations: ScopeDeviation[];
  activeReservations: number;
  unresolvedRisks: ContractRisk[];
  currentRevision: string | null;
}

export interface ScopeDeviation {
  file: string;
  reason: 'UNDECLARED_FILE' | 'DECLARED_BUT_NOT_IN_REPORT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

// Phase 3: Merge readiness result
export interface MergeReadiness {
  status: 'READY_TO_MERGE' | 'READY_WITH_WARNINGS' | 'NOT_READY';
  warnings: string[];
  blockers: string[];
  approvedRevision: string | null;
  currentRevision: string | null;
  revisionsMatch: boolean;
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
  | 'task.unblocked'
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
  | 'contract.activated'
  | 'contract.superseded'
  | 'completion_report.created'
  | 'review.requested'
  | 'review.started'
  | 'review.finding_created'
  | 'review.finding_resolved'
  | 'review.changes_requested'
  | 'review.approved'
  | 'review.invalidated'
  | 'merge.readiness_changed'
  | 'merge.confirmed'
  | 'decision.recorded'
  | 'decision.superseded'
  | 'member.joined';

export interface DomainEvent<T = unknown> {
  type: DomainEventType;
  projectId: string;
  payload: T;
  timestamp: string;
}
