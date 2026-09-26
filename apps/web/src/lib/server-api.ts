import 'server-only';
import { cookies } from 'next/headers';
import type { ProjectWithMembers, TaskWithRelations } from '@arxion/types';
import type {
  ActivityItemWithRelations,
  AgentSessionWithRelations,
  CoordinationRisk,
  FileReservationWithRelations,
  ProjectDecisionItem,
  ReviewWithDetails,
  CoordinatorSummary,
} from './api';

const API_BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

async function serverFetch<T>(path: string): Promise<T> {
  const token = cookies().get('arxion_token')?.value;
  if (!token) throw new Error('Authentication required');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`API error ${response.status}: ${await response.text()}`);
  const json = (await response.json()) as { success?: boolean; data?: T } | T;
  return (typeof json === 'object' && json !== null && 'data' in json ? json.data : json) as T;
}

export const serverApi = {
  projects: {
    list: () => serverFetch<ProjectWithMembers[]>('/projects'),
  },
  tasks: {
    listByProject: (projectId: string) => serverFetch<TaskWithRelations[]>(`/projects/${projectId}/tasks`),
  },
  activity: {
    listByProject: (projectId: string, limit = 30) => serverFetch<ActivityItemWithRelations[]>(`/projects/${projectId}/activity?limit=${limit}`),
  },
  agentSessions: {
    listActiveByProject: (projectId: string) => serverFetch<AgentSessionWithRelations[]>(`/projects/${projectId}/agent-sessions`),
  },
  fileReservations: {
    listActiveByProject: (projectId: string) => serverFetch<FileReservationWithRelations[]>(`/projects/${projectId}/files/active`),
  },
  coordination: {
    getRisks: (projectId: string) => serverFetch<CoordinationRisk[]>(`/projects/${projectId}/coordination/risks`),
    getSummary: (projectId: string) => serverFetch<CoordinatorSummary>(`/projects/${projectId}/coordinator-summary`),
  },
  reviews: {
    listByTask: (taskId: string) => serverFetch<ReviewWithDetails[]>(`/tasks/${taskId}/reviews`),
  },
  decisions: {
    listByProject: (projectId: string) => serverFetch<ProjectDecisionItem[]>(`/projects/${projectId}/decisions`),
  },
};
