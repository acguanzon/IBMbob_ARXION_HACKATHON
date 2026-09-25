import { api } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { TaskBoard } from '@/components/TaskBoard';
import { ActivityPanel } from '@/components/ActivityPanel';
import { RealtimeProvider } from '@/components/RealtimeProvider';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let projects: Awaited<ReturnType<typeof api.projects.list>> = [];
  let error: string | null = null;

  try {
    projects = await api.projects.list();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load projects';
  }

  const firstProject = projects[0] ?? null;

  // Fetch tasks + Phase 2 metadata in parallel
  let tasks: Awaited<ReturnType<typeof api.tasks.listByProject>> = [];
  let taskMeta: Record<string, { activeFiles: number; contractRisks: number }> = {};

  if (firstProject) {
    const [tasksResult, reservationsResult, risksResult] = await Promise.allSettled([
      api.tasks.listByProject(firstProject.id),
      api.fileReservations.listActiveByProject(firstProject.id),
      api.coordination.getRisks(firstProject.id),
    ]);

    if (tasksResult.status === 'fulfilled') tasks = tasksResult.value;

    // Build per-task file count from active reservations
    if (reservationsResult.status === 'fulfilled') {
      for (const r of reservationsResult.value) {
        const tid = r.task.id;
        const entry = (taskMeta[tid] ??= { activeFiles: 0, contractRisks: 0 });
        entry.activeFiles += 1;
      }
    }

    // Build per-task contract risk count
    if (risksResult.status === 'fulfilled') {
      for (const risk of risksResult.value) {
        for (const tid of [risk.sourceTaskId, risk.affectedTaskId]) {
          const entry = (taskMeta[tid] ??= { activeFiles: 0, contractRisks: 0 });
          entry.contractRisks += 1;
        }
      }
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Realtime WebSocket — invisible, triggers router.refresh() on events */}
      {firstProject && <RealtimeProvider projectId={firstProject.id} />}

      {/* Left sidebar */}
      <Sidebar projects={projects} activeProjectId={firstProject?.id ?? null} />

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {firstProject ? firstProject.name : 'No Project Selected'}
            </h1>
            {firstProject?.description && (
              <p className="mt-0.5 text-sm text-slate-500">{firstProject.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              API Connected
            </span>
          </div>
        </header>

        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>API Error:</strong> {error}
            <br />
            <span className="text-xs text-red-500">
              Make sure the backend is running at {process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}
            </span>
          </div>
        )}

        {/* Task Board */}
        <div className="flex-1 overflow-auto p-6">
          {firstProject ? (
            <TaskBoard tasks={tasks} projectId={firstProject.id} taskMeta={taskMeta} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="text-4xl">📋</div>
                <h2 className="mt-3 text-lg font-medium text-slate-700">No projects found</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Run <code className="rounded bg-slate-100 px-1 py-0.5">pnpm db:seed</code> to
                  create demo data.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Right sidebar */}
      <ActivityPanel project={firstProject} />
    </div>
  );
}
