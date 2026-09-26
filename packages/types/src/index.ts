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

export const AgentTypeSchema = z.enum(['IBM_BOB', 'CODEX', 'CURSOR', 'CLAUDE_CODE', 'OTHER']);
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
  acceptanceCriteria: z.array(z.string()),
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
  displayId: z.string().min(1).max(20).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: TaskStatusSchema.optional().default('BACKLOG'),
  priority: TaskPrioritySchema.optional().default('MEDIUM'),
  assigneeId: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional().default([]),
});
export type CreateTaskBody = z.infer<typeof CreateTaskBodySchema>;

export const UpdateTaskBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  assigneeId: z.string().nullable().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
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
  // Phase 4 additions
  contextUpdates?: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    status: string;
    createdAt: Date;
    sourceTask: { displayId: string; title: string } | null;
    entity: { name: string; type: string } | null;
  }>;
  activeRisks?: Array<{
    id: string;
    type: string;
    severity: string;
    confidence: string;
    title: string;
    description: string;
    detectedAt: Date;
    sourceTask: { displayId: string; title: string } | null;
    sourceEntity: { name: string; type: string } | null;
  }>;
  gitLink?: {
    branchName: string | null;
    baseBranch: string | null;
    latestCommitSha: string | null;
    aheadCount: number | null;
    behindCount: number | null;
    mergeStatus: string;
  } | null;
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

// ─── Phase 4 Enums ────────────────────────────────────────────────────────────

export const GitProviderSchema = z.enum(['GITHUB', 'GITLAB', 'BITBUCKET'])
export type GitProvider = z.infer<typeof GitProviderSchema>

export const RepositoryStatusSchema = z.enum(['CONNECTED', 'DISCONNECTED', 'ERROR'])
export type RepositoryStatus = z.infer<typeof RepositoryStatusSchema>

export const ExternalEventStatusSchema = z.enum(['RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED'])
export type ExternalEventStatus = z.infer<typeof ExternalEventStatusSchema>

export const ActualChangeTypeSchema = z.enum(['ADDED', 'MODIFIED', 'DELETED', 'RENAMED'])
export type ActualChangeType = z.infer<typeof ActualChangeTypeSchema>

export const CodeEntityTypeSchema = z.enum(['FILE', 'API', 'TYPE', 'MODEL', 'SCHEMA', 'EVENT', 'MODULE'])
export type CodeEntityType = z.infer<typeof CodeEntityTypeSchema>

export const CodeRelationshipKindSchema = z.enum([
  'PROVIDES', 'CONSUMES', 'IMPORTS', 'DEPENDS_ON', 'IMPLEMENTS', 'MODIFIES', 'DEFINES', 'CALLS',
])
export type CodeRelationshipKind = z.infer<typeof CodeRelationshipKindSchema>

export const RelationshipSourceSchema = z.enum(['DETERMINISTIC', 'DECLARED', 'INFERRED'])
export type RelationshipSource = z.infer<typeof RelationshipSourceSchema>

export const ConfidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW'])
export type Confidence = z.infer<typeof ConfidenceSchema>

export const ContractChangeKindSchema = z.enum(['ADDED', 'REMOVED', 'MODIFIED', 'RENAMED'])
export type ContractChangeKind = z.infer<typeof ContractChangeKindSchema>

export const CoordinationRiskTypeSchema = z.enum([
  'FILE_OVERLAP', 'CONTRACT_CHANGE', 'DEPENDENCY_CHANGE', 'SCOPE_EXPANSION',
  'SCHEMA_CHANGE', 'STALE_REVIEW', 'BRANCH_DIVERGENCE', 'MERGE_CONFLICT', 'ARCHITECTURAL_CONFLICT',
])
export type CoordinationRiskType = z.infer<typeof CoordinationRiskTypeSchema>

export const RiskSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
export type RiskSeverity = z.infer<typeof RiskSeveritySchema>

export const CoordinationRiskStatusSchema = z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'])
export type CoordinationRiskStatus = z.infer<typeof CoordinationRiskStatusSchema>

export const ContextUpdateStatusSchema = z.enum(['UNREAD', 'READ', 'ACKNOWLEDGED', 'RESOLVED'])
export type ContextUpdateStatus = z.infer<typeof ContextUpdateStatusSchema>

// ─── Phase 4 Models ───────────────────────────────────────────────────────────

export const ProjectRepositorySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  provider: GitProviderSchema,
  owner: z.string(),
  repository: z.string(),
  defaultBranch: z.string(),
  externalRepositoryId: z.string().nullable(),
  status: RepositoryStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type ProjectRepository = z.infer<typeof ProjectRepositorySchema>

export const ExternalEventSchema = z.object({
  id: z.string(),
  provider: GitProviderSchema,
  externalEventId: z.string(),
  eventType: z.string(),
  repositoryId: z.string(),
  payloadHash: z.string(),
  receivedAt: z.string(),
  processedAt: z.string().nullable(),
  status: ExternalEventStatusSchema,
  errorMessage: z.string().nullable(),
})
export type ExternalEvent = z.infer<typeof ExternalEventSchema>

export const TaskActualChangeSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  repositoryId: z.string(),
  commitSha: z.string(),
  filePath: z.string(),
  changeType: ActualChangeTypeSchema,
  additions: z.number().int(),
  deletions: z.number().int(),
  metadata: z.unknown().nullable(),
  detectedAt: z.string(),
})
export type TaskActualChange = z.infer<typeof TaskActualChangeSchema>

export const CodeEntitySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  repositoryId: z.string().nullable(),
  type: CodeEntityTypeSchema,
  name: z.string(),
  filePath: z.string(),
  symbolName: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type CodeEntity = z.infer<typeof CodeEntitySchema>

export const CodeRelationshipSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceEntityId: z.string(),
  targetEntityId: z.string(),
  relationship: CodeRelationshipKindSchema,
  confidence: ConfidenceSchema,
  source: RelationshipSourceSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type CodeRelationship = z.infer<typeof CodeRelationshipSchema>

export const ContractChangeSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  taskId: z.string(),
  entityId: z.string(),
  previousRevision: z.string().nullable(),
  currentRevision: z.string().nullable(),
  changeKind: ContractChangeKindSchema,
  breaking: z.boolean().nullable(),
  confidence: ConfidenceSchema,
  detectedAt: z.string(),
})
export type ContractChange = z.infer<typeof ContractChangeSchema>

export const CoordinationRiskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceTaskId: z.string(),
  affectedTaskId: z.string(),
  type: CoordinationRiskTypeSchema,
  severity: RiskSeveritySchema,
  confidence: ConfidenceSchema,
  title: z.string(),
  description: z.string(),
  sourceEntityId: z.string().nullable(),
  status: CoordinationRiskStatusSchema,
  detectedAt: z.string(),
  resolvedAt: z.string().nullable(),
})
export type CoordinationRisk = z.infer<typeof CoordinationRiskSchema>

export const ContextUpdateSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceTaskId: z.string(),
  affectedTaskId: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  entityId: z.string().nullable(),
  riskId: z.string().nullable(),
  status: ContextUpdateStatusSchema,
  createdAt: z.string(),
  acknowledgedAt: z.string().nullable(),
})
export type ContextUpdate = z.infer<typeof ContextUpdateSchema>

// ─── Phase 4 Request Bodies ───────────────────────────────────────────────────

export const ConnectRepositoryBodySchema = z.object({
  provider: GitProviderSchema.optional().default('GITHUB'),
  owner: z.string().min(1),
  repository: z.string().min(1),
  defaultBranch: z.string().optional().default('main'),
  webhookSecret: z.string().optional(),
})
export type ConnectRepositoryBody = z.infer<typeof ConnectRepositoryBodySchema>

export const AcknowledgeRiskBodySchema = z.object({
  status: z.enum(['ACKNOWLEDGED', 'DISMISSED']),
})
export type AcknowledgeRiskBody = z.infer<typeof AcknowledgeRiskBodySchema>

export const AcknowledgeContextUpdateBodySchema = z.object({
  status: z.enum(['READ', 'ACKNOWLEDGED', 'RESOLVED']),
})
export type AcknowledgeContextUpdateBody = z.infer<typeof AcknowledgeContextUpdateBodySchema>

// ─── Phase 4 Response Types ───────────────────────────────────────────────────

export interface ActualScopeAnalysis {
  taskId: string
  declaredFiles: string[]
  actualFiles: string[]
  unexpectedFiles: string[]
  missingDeclaredFiles: string[]
  hasDeviation: boolean
}

export interface BranchStatus {
  taskId: string
  branchName: string | null
  baseBranch: string | null
  aheadCount: number | null
  behindCount: number | null
  latestCommitSha: string | null
  divergenceCheckedAt: string | null
  isDiverged: boolean
}

export interface ImpactAnalysis {
  changedEntity: CodeEntity
  directConsumers: Array<{
    entity: CodeEntity
    relationship: CodeRelationshipKind
    confidence: Confidence
    activeTasks: Array<{ taskId: string; taskDisplayId: string; taskTitle: string }>
  }>
  totalAffectedTasks: number
}

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
  | 'member.joined'
  // Phase 4
  | 'repository.connected'
  | 'git.push_received'
  | 'git.change_detected'
  | 'scope.deviation_detected'
  | 'code_entity.changed'
  | 'contract.change_detected'
  | 'risk.created'
  | 'risk.updated'
  | 'risk.resolved'
  | 'context_update.created'
  | 'context_update.acknowledged'
  | 'branch.diverged'
  | 'merge_risk.detected'
  // Phase 5
  | 'task.readiness_changed'
  | 'handoff.created'
  | 'handoff.delivered'
  | 'handoff.acknowledged'
  | 'handoff.superseded'
  | 'context_package.generated'
  | 'context_package.superseded'
  | 'recovery_snapshot.created'
  | 'task.resume_started'
  | 'task.resume_completed'
  | 'parallel_safety.changed'
  // Realignment
  | 'agent.launch_requested'
  | 'agent.launch_accepted'
  | 'agent.launch_cancelled';

export interface DomainEvent<T = unknown> {
  type: DomainEventType;
  projectId: string;
  payload: T;
  timestamp: string;
}

// ─── Phase 5: Enums ───────────────────────────────────────────────────────────

export const TaskReadinessStateSchema = z.enum([
  'READY',
  'BLOCKED_BY_DEPENDENCY',
  'AT_RISK',
  'WAITING_FOR_REVIEW',
  'WAITING_FOR_CONTEXT',
  'INTERRUPTED',
]);
export type TaskReadinessState = z.infer<typeof TaskReadinessStateSchema>;

export const HandoffStatusSchema = z.enum([
  'PENDING',
  'DELIVERED',
  'ACKNOWLEDGED',
  'SUPERSEDED',
]);
export type HandoffStatus = z.infer<typeof HandoffStatusSchema>;

export const ContextPackageStatusSchema = z.enum(['CURRENT', 'STALE', 'SUPERSEDED']);
export type ContextPackageStatus = z.infer<typeof ContextPackageStatusSchema>;

export const ParallelSafetyStateSchema = z.enum([
  'SAFE',
  'SAFE_WITH_WARNINGS',
  'UNSAFE',
  'UNKNOWN',
]);
export type ParallelSafetyState = z.infer<typeof ParallelSafetyStateSchema>;

export const RecoveryTriggerSchema = z.enum([
  'SESSION_STALE',
  'SESSION_ENDED_UNEXPECTEDLY',
  'USER_PAUSED',
]);
export type RecoveryTrigger = z.infer<typeof RecoveryTriggerSchema>;

// ─── Phase 5: Schemas + Types ─────────────────────────────────────────────────

export const TaskReadinessEvaluationSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  state: TaskReadinessStateSchema,
  reasons: z.array(z.string()),
  sourceRevision: z.string().nullable(),
  evaluatedAt: z.string(),
});
export type TaskReadinessEvaluation = z.infer<typeof TaskReadinessEvaluationSchema>;

export const HandoffPayloadSchema = z.object({
  sourceTaskDisplayId: z.string(),
  targetTaskDisplayId: z.string(),
  completedRevision: z.string().nullable(),
  finalContracts: z.array(z.object({ name: z.string(), type: z.string(), relationship: z.string() })),
  relevantDecisions: z.array(z.object({ title: z.string(), decision: z.string() })),
  relevantChanges: z.array(z.object({ filePath: z.string(), changeType: z.string() })),
  resolvedRisks: z.array(z.object({ title: z.string() })),
  remainingRisks: z.array(z.object({ title: z.string(), severity: z.string() })),
  recommendedNextCheck: z.string().nullable(),
});
export type HandoffPayload = z.infer<typeof HandoffPayloadSchema>;

export const TaskHandoffSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceTaskId: z.string(),
  targetTaskId: z.string(),
  sourceRevision: z.string().nullable(),
  status: HandoffStatusSchema,
  summary: z.string(),
  payload: HandoffPayloadSchema,
  createdAt: z.string(),
  deliveredAt: z.string().nullable(),
  acknowledgedAt: z.string().nullable(),
  acknowledgedByAgentSessionId: z.string().nullable(),
  supersededById: z.string().nullable(),
});
export type TaskHandoff = z.infer<typeof TaskHandoffSchema>;

export const TaskContextPackageSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  contextVersion: z.number(),
  generatedAt: z.string(),
  sourceProjectRevision: z.string().nullable(),
  status: ContextPackageStatusSchema,
  content: z.object({
    task: z.record(z.unknown()),
    readiness: TaskReadinessEvaluationSchema.optional(),
    dependencies: z.array(z.record(z.unknown())),
    pendingHandoffs: z.array(z.record(z.unknown())),
    activeContracts: z.array(z.record(z.unknown())),
    relevantDecisions: z.array(z.record(z.unknown())),
    openRisks: z.array(z.record(z.unknown())),
    unreadContextUpdates: z.array(z.record(z.unknown())),
    branchStatus: z.record(z.unknown()).nullable(),
    actualScope: z.record(z.unknown()).nullable(),
    activeAgents: z.array(z.record(z.unknown())),
    recoveryState: z.record(z.unknown()).nullable(),
    critical: z.array(z.string()),
    important: z.array(z.string()),
    background: z.array(z.string()),
  }),
  supersededAt: z.string().nullable(),
});
export type TaskContextPackage = z.infer<typeof TaskContextPackageSchema>;

export const RecoverySnapshotSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  projectId: z.string(),
  previousAgentSessionId: z.string().nullable(),
  trigger: RecoveryTriggerSchema,
  lastKnownRevision: z.string().nullable(),
  lastProgressMessage: z.string().nullable(),
  activeWorkIntent: z.unknown().nullable(),
  actualScope: z.unknown().nullable(),
  activeContracts: z.unknown().nullable(),
  openRisks: z.unknown().nullable(),
  pendingContextUpdates: z.unknown().nullable(),
  pendingHandoffs: z.unknown().nullable(),
  createdAt: z.string(),
});
export type RecoverySnapshot = z.infer<typeof RecoverySnapshotSchema>;

export const RecoveryContextSchema = z.object({
  snapshot: RecoverySnapshotSchema,
  delta: z.object({
    newDecisions: z.array(z.record(z.unknown())),
    newRisks: z.array(z.record(z.unknown())),
    branchAdvancedBy: z.number(),
    newContextUpdates: z.array(z.record(z.unknown())),
    newHandoffs: z.array(z.record(z.unknown())),
  }),
  currentContext: z.record(z.unknown()),
});
export type RecoveryContext = z.infer<typeof RecoveryContextSchema>;

export const ParallelSafetyEvaluationSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  taskAId: z.string(),
  taskBId: z.string(),
  state: ParallelSafetyStateSchema,
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
  evaluatedAt: z.string(),
});
export type ParallelSafetyEvaluation = z.infer<typeof ParallelSafetyEvaluationSchema>;

export const AgentIntegrationCapabilitySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  agentType: z.string(),
  supportsMcp: z.boolean(),
  supportsHeartbeat: z.boolean(),
  supportsContextUpdates: z.boolean(),
  supportsHandoffs: z.boolean(),
  supportsRecovery: z.boolean(),
  supportsReviewTools: z.boolean(),
  protocolVersion: z.string().nullable(),
  registeredAt: z.string(),
  updatedAt: z.string(),
});
export type AgentIntegrationCapability = z.infer<typeof AgentIntegrationCapabilitySchema>;

export const CoordinatorSummarySchema = z.object({
  projectId: z.string(),
  generatedAt: z.string(),
  readyTasks: z.array(z.object({ taskId: z.string(), displayId: z.string(), title: z.string() })),
  waitingTasks: z.array(z.object({ taskId: z.string(), displayId: z.string(), title: z.string(), reason: z.string() })),
  interruptedTasks: z.array(z.object({ taskId: z.string(), displayId: z.string(), title: z.string(), hasRecovery: z.boolean() })),
  safeParallelGroups: z.array(z.array(z.object({ taskId: z.string(), displayId: z.string(), title: z.string() }))),
  highRisks: z.array(z.record(z.unknown())),
});
export type CoordinatorSummary = z.infer<typeof CoordinatorSummarySchema>;

// ─── Realignment: Auth & Launch enums ────────────────────────────────────────

export const AgentLaunchStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'EXPIRED',
  'CANCELLED',
  'FAILED',
]);
export type AgentLaunchStatus = z.infer<typeof AgentLaunchStatusSchema>;

// ─── Realignment: Core Schemas ────────────────────────────────────────────────

export const UserSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  token: z.string(),
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  revoked: z.boolean(),
});
export type UserSession = z.infer<typeof UserSessionSchema>;

export const AgentLaunchRequestSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  taskId: z.string(),
  userId: z.string(),
  agentType: z.string(),
  status: AgentLaunchStatusSchema,
  contextPackageId: z.string().nullable(),
  createdAt: z.coerce.date(),
  acceptedAt: z.coerce.date().nullable(),
  expiredAt: z.coerce.date().nullable(),
  agentSessionId: z.string().nullable(),
});
export type AgentLaunchRequest = z.infer<typeof AgentLaunchRequestSchema>;

// ─── Realignment: Request Bodies ─────────────────────────────────────────────

export const RegisterBodySchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type RegisterBody = z.infer<typeof RegisterBodySchema>;

export const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

export const AddMemberBodySchema = z.object({
  email: z.string().email(),
  role: ProjectMemberRoleSchema.optional().default('MEMBER'),
});
export type AddMemberBody = z.infer<typeof AddMemberBodySchema>;

export const UpdateMemberRoleBodySchema = z.object({
  role: ProjectMemberRoleSchema,
});
export type UpdateMemberRoleBody = z.infer<typeof UpdateMemberRoleBodySchema>;

export const CreateLaunchRequestBodySchema = z.object({
  agentType: z.string().min(1).default('IBM_BOB'),
  userId: z.string().min(1),
});
export type CreateLaunchRequestBody = z.infer<typeof CreateLaunchRequestBodySchema>;

export const AcceptLaunchRequestBodySchema = z.object({
  agentSessionId: z.string().optional(),
});
export type AcceptLaunchRequestBody = z.infer<typeof AcceptLaunchRequestBodySchema>;
