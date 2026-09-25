import type { ProjectWithMembers } from '@arxion/types';
import { api } from '@/lib/api';

interface ActivityPanelProps {
  project: ProjectWithMembers | null;
}

const AGENT_TYPE_LABELS: Record<string, string> = {
  IBM_BOB: 'IBM Bob',
  CURSOR: 'Cursor',
  CLAUDE_CODE: 'Claude Code',
  OTHER: 'Agent',
};

const STATUS_COLORS: Record<string, string> = {
  WORKING: 'bg-emerald-100 text-emerald-700',
  WAITING: 'bg-amber-100 text-amber-700',
  IDLE: 'bg-slate-100 text-slate-600',
  STALE: 'bg-red-100 text-red-600',
};

const EVENT_ICONS: Record<string, string> = {
  'task.created': '📋',
  'task.claimed': '🙋',
  'task.released': '↩️',
  'task.started': '▶️',
  'task.progress': '⚡',
  'task.updated': '✏️',
  'agent.started': '🤖',
  'agent.ended': '⏹️',
  'agent.stale': '⚠️',
  'agent.heartbeat': '💓',
  'file.reserved': '📌',
  'file.released': '📍',
  'file.conflict': '⚠️',
  'file.expired': '⏰',
  'contract.declared': '📝',
  'contract.risk_detected': '🚨',
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export async function ActivityPanel({ project }: ActivityPanelProps) {
  if (!project) {
    return (
      <aside className="flex w-72 flex-col border-l border-slate-200 bg-white overflow-y-auto">
        <div className="p-4 text-xs text-slate-400">No project selected</div>
      </aside>
    );
  }

  // Fetch all live data in parallel
  const [activities, sessions, reservations, risks] = await Promise.allSettled([
    api.activity.listByProject(project.id, 25),
    api.agentSessions.listActiveByProject(project.id),
    api.fileReservations.listActiveByProject(project.id),
    api.coordination.getRisks(project.id),
  ]);

  const activityItems = activities.status === 'fulfilled' ? activities.value : [];
  const sessionItems = sessions.status === 'fulfilled' ? sessions.value : [];
  const reservationItems = reservations.status === 'fulfilled' ? reservations.value : [];
  const riskItems = risks.status === 'fulfilled' ? risks.value : [];

  return (
    <aside className="flex w-72 flex-col border-l border-slate-200 bg-white overflow-y-auto">

      {/* Active Agents */}
      <section className="border-b border-slate-200 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Active Agents
          {sessionItems.length > 0 && (
            <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
              {sessionItems.length}
            </span>
          )}
        </p>
        {sessionItems.length > 0 ? (
          <ul className="space-y-2.5">
            {sessionItems.map((s) => (
              <li key={s.id} className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">{s.user.name}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {s.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {AGENT_TYPE_LABELS[s.agentType] ?? s.agentType}
                  {s.task ? ` · ${s.task.displayId}` : ''}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{relativeTime(s.lastSeenAt)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center">
            <p className="text-xs text-slate-400">No active agent sessions</p>
          </div>
        )}
      </section>

      {/* File Reservations */}
      <section className="border-b border-slate-200 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          File Reservations
          {reservationItems.length > 0 && (
            <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-blue-700">
              {reservationItems.length}
            </span>
          )}
        </p>
        {reservationItems.length > 0 ? (
          <ul className="space-y-2">
            {reservationItems.map((r) => (
              <li key={r.id} className={`rounded border p-2 ${r.status === 'CONFLICT' ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
                <p className="truncate text-xs font-mono font-medium text-slate-700" title={r.filePath}>
                  {r.status === 'CONFLICT' ? '⚠ ' : '📌 '}
                  {r.filePath.split('/').pop() ?? r.filePath}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {r.user.name} · {r.task.displayId}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center">
            <p className="text-xs text-slate-400">No active reservations</p>
          </div>
        )}
      </section>

      {/* Coordination Risks */}
      <section className="border-b border-slate-200 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Coordination Risks
          {riskItems.length > 0 && (
            <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-red-700">
              {riskItems.length}
            </span>
          )}
        </p>
        {riskItems.length > 0 ? (
          <ul className="space-y-2">
            {riskItems.map((r, i) => (
              <li key={i} className="rounded border border-red-200 bg-red-50 p-2">
                <p className="text-xs font-semibold text-red-800">
                  🚨 {r.contractType}: {r.contractName}
                </p>
                <p className="mt-0.5 text-xs text-red-600">
                  {r.sourceTaskDisplayId} {r.sourceRelationship.toLowerCase()}s it
                </p>
                <p className="text-xs text-red-600">
                  {r.affectedTaskDisplayId} consumes it
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center">
            <p className="text-xs text-slate-400">No conflicts detected</p>
          </div>
        )}
      </section>

      {/* Activity Feed */}
      <section className="p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Recent Activity
        </p>
        {activityItems.length > 0 ? (
          <ul className="space-y-2.5">
            {activityItems.map((a) => {
              const icon = EVENT_ICONS[a.type] ?? '●';
              return (
                <li key={a.id} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-sm">{icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-700 leading-snug">{a.message}</p>
                    <p className="text-xs text-slate-400">
                      {a.user?.name ?? 'System'}
                      {a.task ? ` · ${a.task.displayId}` : ''}
                      {' · '}
                      {relativeTime(a.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-xs text-slate-400">No recent activity</div>
        )}
      </section>
    </aside>
  );
}
