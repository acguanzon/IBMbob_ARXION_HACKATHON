import { api } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { ActivityPanel } from '@/components/ActivityPanel';
import { RealtimeProvider } from '@/components/RealtimeProvider';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { AgentDock } from '@/components/dock/AgentDock';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface ProjectPageProps {
  params: { projectId: string };
}

export default async function ProjectDashboardPage({ params }: ProjectPageProps) {
  const { projectId } = params;

  let projects: Awaited<ReturnType<typeof api.projects.list>> = [];
  let error: string | null = null;

  try {
    projects = await api.projects.list();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load projects';
  }

  const project = projects.find((p) => p.id === projectId) ?? null;
  if (!project && projects.length > 0) {
    notFound();
  }

  // Fetch tasks + per-task metadata in parallel
  let tasks: Awaited<ReturnType<typeof api.tasks.listByProject>> = [];
  let taskMeta: Record<string, { activeFiles: number; contractRisks: number }> = {};
  let activeSessionCount = 0;

  if (project) {
    const [tasksResult, reservationsResult, risksResult, sessionsResult] =
      await Promise.allSettled([
        api.tasks.listByProject(project.id),
        api.fileReservations.listActiveByProject(project.id),
        api.coordination.getRisks(project.id),
        api.agentSessions.listActiveByProject(project.id),
      ]);

    if (tasksResult.status === 'fulfilled') tasks = tasksResult.value;

    if (reservationsResult.status === 'fulfilled') {
      for (const r of reservationsResult.value) {
        const tid = r.task.id;
        const entry = (taskMeta[tid] ??= { activeFiles: 0, contractRisks: 0 });
        entry.activeFiles += 1;
      }
    }

    if (risksResult.status === 'fulfilled') {
      for (const risk of risksResult.value) {
        for (const tid of [risk.sourceTaskId, risk.affectedTaskId]) {
          const entry = (taskMeta[tid] ??= { activeFiles: 0, contractRisks: 0 });
          entry.contractRisks += 1;
        }
      }
    }

    if (sessionsResult.status === 'fulfilled') {
      activeSessionCount = sessionsResult.value.length;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <RealtimeProvider projectId={projectId} />
      <Sidebar projects={projects} activeProjectId={projectId} />

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {project ? project.name : 'Project'}
            </h1>
            {project?.description && (
              <p className="mt-0.5 text-sm text-slate-500">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeSessionCount > 0 && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {activeSessionCount} agent{activeSessionCount !== 1 ? 's' : ''} active
              </span>
            )}
            <Link
              href={`/dashboard/${projectId}/coordination`}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              Intelligence
            </Link>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              API Connected
            </span>
          </div>
        </header>

        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>API Error:</strong> {error}
          </div>
        )}

        {/* Task Board */}
        <div className="flex-1 overflow-auto p-4">
          {project ? (
            <KanbanBoard tasks={tasks} projectId={project.id} taskMeta={taskMeta} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="text-4xl">📋</div>
                <h2 className="mt-3 text-lg font-medium text-slate-700">Project not found</h2>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Right activity panel */}
      <ActivityPanel project={project} />

      {/* Agent Dock */}
      {project && <AgentDock projectId={project.id} />}
    </div>
  );
}
