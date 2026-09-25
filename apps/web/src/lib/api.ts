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
    get: (id: string) =>
      apiFetch<import('@arxion/types').ProjectWithMembers>(`/projects/${id}`),
  },
  tasks: {
    listByProject: (projectId: string) =>
      apiFetch<import('@arxion/types').TaskWithRelations[]>(`/projects/${projectId}/tasks`),
    get: (taskId: string) =>
      apiFetch<import('@arxion/types').TaskWithRelations>(`/tasks/${taskId}`),
  },
  agentSessions: {
    listByProject: (projectId: string) =>
      apiFetch<AgentSessionWithRelations[]>(`/projects/${projectId}/agent-sessions`),
  },
  fileReservations: {
    listActive: (projectId: string) =>
      apiFetch<FileReservationWithRelations[]>(`/projects/${projectId}/files/active`),
  },
  activity: {
    listByProject: (projectId: string, limit = 30) =>
      apiFetch<ActivityItemWithRelations[]>(`/projects/${projectId}/activity?limit=${limit}`),
  },
};

// ── Inline types for Phase 2 API responses ────────────────────────────────────

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
