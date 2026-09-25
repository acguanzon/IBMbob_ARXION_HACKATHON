/**
 * Server-side API client for the Arxion backend.
 * Used in Next.js Server Components and Server Actions.
 */

const API_BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    // Disable Next.js default caching for data freshness in dashboard
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { success: boolean; data: T };
  return json.data;
}

export const api = {
  projects: {
    list: () => apiFetch<import('@arxion/types').ProjectWithMembers[]>('/projects'),
    get: (id: string) => apiFetch<import('@arxion/types').ProjectWithMembers>(`/projects/${id}`),
  },
  tasks: {
    listByProject: (projectId: string) =>
      apiFetch<import('@arxion/types').TaskWithRelations[]>(`/projects/${projectId}/tasks`),
    get: (taskId: string) =>
      apiFetch<import('@arxion/types').TaskWithRelations>(`/tasks/${taskId}`),
  },
  activity: {
    listByProject: (projectId: string, limit = 30) =>
      apiFetch<ActivityItemWithRelations[]>(`/projects/${projectId}/activity?limit=${limit}`),
  },
  agentSessions: {
    listActiveByProject: (projectId: string) =>
      apiFetch<AgentSessionWithRelations[]>(`/projects/${projectId}/agent-sessions`),
  },
  fileReservations: {
    listActiveByProject: (projectId: string) =>
      apiFetch<FileReservationWithRelations[]>(`/projects/${projectId}/files/active`),
  },
  coordination: {
    getRisks: (projectId: string) =>
      apiFetch<CoordinationRisk[]>(`/projects/${projectId}/coordination/risks`),
  },
  // Phase 3
  reviews: {
    listByTask: (taskId: string) =>
      apiFetch<ReviewWithDetails[]>(`/tasks/${taskId}/reviews`),
    get: (reviewId: string) =>
      apiFetch<ReviewWithDetails>(`/reviews/${reviewId}`),
    getFindings: (reviewId: string) =>
      apiFetch<ReviewFindingItem[]>(`/reviews/${reviewId}/findings`),
    approve: (reviewId: string, reviewerId: string, comment?: string) =>
      apiFetch<ReviewWithDetails>(`/reviews/${reviewId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reviewerId, comment }),
      }),
    requestChanges: (reviewId: string, reviewerId: string, comment: string) =>
      apiFetch<{ recorded: boolean }>(`/reviews/${reviewId}/request-changes`, {
        method: 'POST',
        body: JSON.stringify({ reviewerId, comment }),
      }),
  },
  decisions: {
    listByProject: (projectId: string) =>
      apiFetch<ProjectDecisionItem[]>(`/projects/${projectId}/decisions`),
  },
  mergeReadiness: {
    get: (taskId: string) =>
      apiFetch<MergeReadinessResult>(`/tasks/${taskId}/merge-readiness`),
  },
};

// ── API response types ────────────────────────────────────────────────────────

export interface AgentSessionWithRelations {
  id: string;
  userId: string;
  taskId: string | null;
  agentType: string;
  status: string;
  startedAt: string;
  lastSeenAt: string;
  user: { id: string; name: string; email: string };
  task: { id: string; displayId: string; title: string } | null;
}

export interface FileReservationWithRelations {
  id: string;
  filePath: string;
  status: string;
  reservedAt: string;
  leaseExpiresAt: string | null;
  user: { id: string; name: string };
  task: { id: string; displayId: string; title: string };
  agentSession: { id: string; agentType: string } | null;
}

export interface ActivityItemWithRelations {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  user: { id: string; name: string } | null;
  task: { id: string; displayId: string; title: string } | null;
  agentSession: { id: string; agentType: string; status: string } | null;
}

export interface CoordinationRisk {
  contractName: string;
  contractType: string;
  sourceTaskId: string;
  sourceTaskDisplayId: string;
  sourceRelationship: string;
  affectedTaskId: string;
  affectedTaskDisplayId: string;
  affectedRelationship: string;
}

// Phase 3 types
export interface ReviewFindingItem {
  id: string;
  source: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  isBlocking: boolean;
  filePath: string | null;
  contractName: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ReviewWithDetails {
  id: string;
  taskId: string;
  requestedById: string;
  status: string;
  reviewVersion: number;
  reviewRevision: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedById: string | null;
  invalidatedAt: string | null;
  invalidationReason: string | null;
  requestedBy: { id: string; name: string; email: string };
  approvedBy: { id: string; name: string; email: string } | null;
  findings: ReviewFindingItem[];
  snapshot: {
    workRevision: string;
    gitCommitSha: string | null;
    branchName: string | null;
    fileSnapshot: Record<string, unknown> | null;
    testSnapshot: Record<string, unknown> | null;
  } | null;
}

export interface ProjectDecisionItem {
  id: string;
  projectId: string;
  taskId: string | null;
  title: string;
  decision: string;
  reason: string | null;
  status: string;
  createdAt: string;
  createdBy: { id: string; name: string };
  task: { id: string; displayId: string; title: string } | null;
}

export interface MergeReadinessResult {
  status: 'READY_TO_MERGE' | 'READY_WITH_WARNINGS' | 'NOT_READY';
  warnings: string[];
  blockers: string[];
  approvedRevision: string | null;
  currentRevision: string | null;
  revisionsMatch: boolean;
}
