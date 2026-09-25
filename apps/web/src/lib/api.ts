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
      apiFetch<
        Array<{
          id: string;
          type: string;
          message: string;
          createdAt: string;
          user: { id: string; name: string } | null;
          task: { id: string; displayId: string; title: string } | null;
        }>
      >(`/projects/${projectId}/activity?limit=${limit}`),
  },
  agentSessions: {
    listActiveByProject: (projectId: string) =>
      apiFetch<
        Array<{
          id: string;
          agentType: string;
          status: string;
          lastSeenAt: string;
          user: { id: string; name: string };
          task: { id: string; displayId: string; title: string } | null;
        }>
      >(`/projects/${projectId}/agent-sessions`),
  },
  fileReservations: {
    listActiveByProject: (projectId: string) =>
      apiFetch<
        Array<{
          id: string;
          filePath: string;
          status: string;
          reservedAt: string;
          leaseExpiresAt: string | null;
          user: { id: string; name: string };
          task: { id: string; displayId: string; title: string };
        }>
      >(`/projects/${projectId}/files/active`),
  },
  coordination: {
    getRisks: (projectId: string) =>
      apiFetch<
        Array<{
          contractName: string;
          contractType: string;
          sourceTaskId: string;
          sourceTaskDisplayId: string;
          sourceRelationship: string;
          affectedTaskId: string;
          affectedTaskDisplayId: string;
          affectedRelationship: string;
        }>
      >(`/projects/${projectId}/coordination/risks`),
  },
};
