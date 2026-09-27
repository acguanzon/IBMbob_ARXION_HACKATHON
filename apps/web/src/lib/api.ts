/**
 * API client for the Arxion backend.
 * apiFetch — server-side (no auth header, used in Server Components)
 * authFetch — client-side (injects Bearer token, handles 401 → login redirect)
 */

const API_BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

function unwrapResponse<T>(json: unknown): T {
  if (
    typeof json === 'object' &&
    json !== null &&
    'data' in json &&
    'success' in json
  ) {
    return (json as { data: T }).data;
  }

  return json as T;
}

async function getErrorMessage(res: Response): Promise<string> {
  const body = await res.text();
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message ?? `API error ${res.status}`;
  } catch {
    return body || `API error ${res.status}`;
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(typeof window !== 'undefined' && localStorage.getItem('arxion_token')
        ? { Authorization: `Bearer ${localStorage.getItem('arxion_token')}` }
        : {}),
      ...options?.headers,
    },
    // Disable Next.js default caching for data freshness in dashboard
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(await getErrorMessage(res));
  }

  return unwrapResponse<T>(await res.json());
}

/**
 * Client-side fetch that injects the stored JWT token.
 * On 401 it redirects to /login.
 */
export async function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
  // Imported lazily to avoid SSR issues
  const { getToken } = await import('@/lib/auth');
  const token = getToken();

  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error(await getErrorMessage(res));
  }

  return unwrapResponse<T>(await res.json());
}

export const api = {
  projects: {
    list: () => apiFetch<import('@arxion/types').ProjectWithMembers[]>('/projects'),
    get: (id: string) => apiFetch<import('@arxion/types').ProjectWithMembers>(`/projects/${id}`),
    create: (body: import('@arxion/types').CreateProjectBody) =>
      authFetch<import('@arxion/types').ProjectWithMembers>('/projects', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    addMember: (projectId: string, email: string, role = 'MEMBER') =>
      authFetch<{ id: string }>(`/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      }),
  },
  tasks: {
    listByProject: (projectId: string) =>
      apiFetch<import('@arxion/types').TaskWithRelations[]>(`/projects/${projectId}/tasks`),
    get: (taskId: string) =>
      apiFetch<import('@arxion/types').TaskWithRelations>(`/tasks/${taskId}`),
    create: (
      projectId: string,
      body: {
        title: string;
        description?: string;
        priority?: string;
        acceptanceCriteria?: string[];
        displayId?: string;
      },
    ) =>
      authFetch<import('@arxion/types').TaskWithRelations>(`/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (taskId: string, body: Record<string, unknown>) =>
      authFetch<import('@arxion/types').TaskWithRelations>(`/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    remove: (taskId: string) =>
      authFetch<{ id: string; displayId: string }>(`/tasks/${taskId}`, {
        method: 'DELETE',
        body: JSON.stringify({}),
      }),
    claim: (projectId: string, taskId: string, userId: string) =>
      authFetch<import('@arxion/types').TaskWithRelations>(
        `/projects/${projectId}/tasks/${taskId}/claim`,
        {
          method: 'POST',
          body: JSON.stringify({ userId }),
        },
      ),
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
    getSummary: (projectId: string) =>
      authFetch<CoordinatorSummary>(`/projects/${projectId}/coordinator-summary`),
    getReadiness: (taskId: string) =>
      authFetch<TaskReadinessResult>(`/tasks/${taskId}/readiness`),
    getHandoffs: (taskId: string) =>
      authFetch<HandoffItem[]>(`/tasks/${taskId}/handoffs`),
    getContextUpdates: (taskId: string) =>
      authFetch<ContextUpdateItem[]>(`/tasks/${taskId}/context-updates`),
    acknowledgeContextUpdate: (updateId: string) =>
      authFetch<{ acknowledged: boolean }>(`/context-updates/${updateId}/acknowledge`, {
        method: 'POST',
      }),
    acknowledgeHandoff: (handoffId: string) =>
      authFetch<{ acknowledged: boolean }>(`/handoffs/${handoffId}/acknowledge`, {
        method: 'POST',
      }),
    getParallelSafety: (projectId: string) =>
      authFetch<ParallelSafetyResult>(`/projects/${projectId}/parallel-safety`),
  },
  launch: {
    request: (projectId: string, taskId: string, body: { agentType: string; userId: string }) =>
      authFetch<LaunchRequest>(`/projects/${projectId}/tasks/${taskId}/launch`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    accept: (requestId: string) =>
      authFetch<LaunchRequest>(`/launch-requests/${requestId}/accept`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    cancel: (requestId: string) =>
      authFetch<LaunchRequest>(`/launch-requests/${requestId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    get: (requestId: string) =>
      authFetch<LaunchRequest>(`/launch-requests/${requestId}`),
    listByProject: (projectId: string) =>
      authFetch<LaunchRequest[]>(`/projects/${projectId}/launch-requests`),
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

export interface LaunchRequest {
  id: string;
  projectId: string;
  taskId: string;
  userId: string;
  agentType: string;
  status: 'PENDING' | 'ACCEPTED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
  createdAt: string;
  acceptedAt: string | null;
  agentSessionId: string | null;
  task?: { id: string; displayId: string; title: string };
}

export interface TaskReadinessResult {
  state:
    | 'READY'
    | 'AT_RISK'
    | 'BLOCKED_BY_DEPENDENCY'
    | 'WAITING_FOR_CONTEXT'
    | 'INTERRUPTED';
  reasons: string[];
  blockers?: string[];
  warnings?: string[];
}

export interface HandoffItem {
  id: string;
  fromTaskId: string;
  toTaskId: string | null;
  type: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
  fromTask?: { displayId: string; title: string };
}

export interface ContextUpdateItem {
  id: string;
  type: string;
  title: string;
  message: string;
  status: string;
  createdAt: string;
  sourceTask?: { displayId: string; title: string } | null;
}

export interface CoordinatorSummary {
  readyTasks: Array<{
    id: string;
    displayId: string;
    title: string;
    priority: string;
    assignee: { name: string } | null;
  }>;
  waitingTasks: Array<{
    id: string;
    displayId: string;
    title: string;
    waitReason: string;
  }>;
  interruptedTasks: Array<{
    id: string;
    displayId: string;
    title: string;
    interruption: string;
    recovery: string;
  }>;
  safeParallelGroups: Array<{
    groupId: string;
    tasks: Array<{ displayId: string; title: string }>;
  }>;
  highRisks: Array<{
    id?: string;
    title: string;
    severity: string;
    description: string;
    affectedTasks?: string[];
  }>;
}

export interface ParallelSafetyResult {
  safeGroups: Array<{
    groupId: string;
    tasks: Array<{ id: string; displayId: string; title: string }>;
  }>;
  conflicts: Array<{
    taskADisplayId: string;
    taskBDisplayId: string;
    reason: string;
  }>;
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
