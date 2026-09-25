import { api } from '@/lib/api';
import type { ProjectDecisionItem } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { RealtimeProvider } from '@/components/RealtimeProvider';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  SUPERSEDED: 'bg-slate-100 text-slate-400',
  DEPRECATED: 'bg-red-100 text-red-400',
};

function DecisionCard({ decision }: { decision: ProjectDecisionItem }) {
  const statusClass = STATUS_COLOR[decision.status] ?? 'bg-slate-100 text-slate-500';

  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${decision.status !== 'ACTIVE' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-slate-900">{decision.title}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
              {decision.status}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            By {decision.createdBy.name} · {new Date(decision.createdAt).toLocaleString()}
            {decision.task && (
              <span> · Task <span className="font-mono">{decision.task.displayId}</span></span>
            )}
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-700">{decision.decision}</p>
      {decision.reason && (
        <p className="mt-1 text-xs text-slate-500">
          <span className="font-medium">Reason: </span>{decision.reason}
        </p>
      )}
    </div>
  );
}

export default async function DecisionsPage() {
  let projects: Awaited<ReturnType<typeof api.projects.list>> = [];

  try {
    projects = await api.projects.list();
  } catch {
    // handled below
  }

  const firstProject = projects[0] ?? null;

  let decisions: ProjectDecisionItem[] = [];
  if (firstProject) {
    try {
      decisions = await api.decisions.listByProject(firstProject.id);
    } catch {
      // non-fatal
    }
  }

  const activeCount = decisions.filter((d) => d.status === 'ACTIVE').length;
  const supersededCount = decisions.filter((d) => d.status !== 'ACTIVE').length;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {firstProject && <RealtimeProvider projectId={firstProject.id} />}
      <Sidebar projects={projects} activeProjectId={firstProject?.id ?? null} />

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Project Decisions</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {firstProject?.name ?? 'No project selected'} — architectural and design decisions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                {activeCount} active
              </span>
            )}
            {supersededCount > 0 && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                {supersededCount} superseded
              </span>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {decisions.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="text-4xl">📝</div>
                <h2 className="mt-3 text-lg font-medium text-slate-700">No decisions recorded</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Decisions appear here when an agent calls <code className="rounded bg-slate-100 px-1">record_project_decision</code>.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl">
              {decisions.map((decision) => (
                <DecisionCard key={decision.id} decision={decision} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
