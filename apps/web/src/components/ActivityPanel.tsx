import type {
  AgentSessionWithRelations,
  FileReservationWithRelations,
  ActivityItemWithRelations,
} from '@/lib/api';

interface ActivityPanelProps {
  sessions: AgentSessionWithRelations[];
  reservations: FileReservationWithRelations[];
  activity: ActivityItemWithRelations[];
}

export function ActivityPanel({ sessions, reservations, activity }: ActivityPanelProps) {
  const conflicts = reservations.filter((r) => r.status === 'CONFLICT');

  return (
    <aside className="flex w-72 flex-col border-l border-slate-200 bg-white overflow-y-auto shrink-0">

      {/* Active Agents */}
      <section className="border-b border-slate-200 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Active Agents
          {sessions.length > 0 && (
            <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
              {sessions.length}
            </span>
          )}
        </p>
        {sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center">
            <p className="text-xs text-slate-400">No active agent sessions</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-start gap-2">
                <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${statusColor(s.status)}`} />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-700">
                    {s.user.name}
                    <span className="ml-1 text-slate-400">({s.agentType.replace('_', ' ')})</span>
                  </p>
                  {s.task && (
                    <p className="text-xs text-slate-400 truncate">
                      {s.task.displayId} — {s.task.title}
                    </p>
                  )}
                  <p className="text-xs text-slate-300">{s.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* File Reservations */}
      <section className="border-b border-slate-200 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          File Reservations
          {reservations.length > 0 && (
            <span className="ml-2 rounded-full bg-blue-100 px-1.5 py-0.5 text-blue-700">
              {reservations.length}
            </span>
          )}
        </p>
        {reservations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center">
            <p className="text-xs text-slate-400">No active reservations</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {reservations.map((r) => (
              <li key={r.id} className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0 text-sm">{r.status === 'CONFLICT' ? '⚡' : '📄'}</span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-700">{r.filePath}</p>
                  <p className="text-xs text-slate-400">
                    {r.user.name} · {r.task.displayId}
                  </p>
                  {r.leaseExpiresAt && (
                    <p className="text-xs text-slate-300">
                      expires {new Date(r.leaseExpiresAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <section className="border-b border-slate-200 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-400">
            ⚡ Conflicts ({conflicts.length})
          </p>
          <ul className="space-y-2">
            {conflicts.map((c) => (
              <li key={c.id} className="rounded-md bg-red-50 p-2 text-xs text-red-700">
                <p className="font-medium truncate">{c.filePath}</p>
                <p className="text-red-500">
                  {c.user.name} on {c.task.displayId}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recent Activity */}
      <section className="p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Recent Activity
        </p>
        {activity.length === 0 ? (
          <p className="text-xs text-slate-400">No recent activity</p>
        ) : (
          <ul className="space-y-2.5">
            {activity.map((a) => (
              <ActivityItem key={a.id} item={a} />
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

function ActivityItem({ item }: { item: ActivityItemWithRelations }) {
  const icon = activityIcon(item.type);
  const who = item.user?.name ?? 'System';
  const where = item.task ? ` · ${item.task.displayId}` : '';
  const when = timeAgo(item.createdAt);

  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-sm">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-700 truncate">{item.message}</p>
        <p className="text-xs text-slate-400">
          {who}{where} · {when}
        </p>
      </div>
    </li>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case 'WORKING': return 'bg-emerald-400';
    case 'WAITING': return 'bg-yellow-400';
    case 'IDLE':    return 'bg-slate-300';
    case 'STALE':   return 'bg-orange-400';
    default:        return 'bg-slate-200';
  }
}

function activityIcon(type: string): string {
  if (type.startsWith('task.claim')) return '🎯';
  if (type.startsWith('task.progress')) return '📝';
  if (type.startsWith('task.created')) return '✅';
  if (type.startsWith('task.released')) return '🔓';
  if (type.startsWith('file.reserved')) return '📄';
  if (type.startsWith('file.released')) return '🔓';
  if (type.startsWith('file.conflict')) return '⚡';
  if (type.startsWith('agent.started')) return '🤖';
  if (type.startsWith('agent.ended')) return '👋';
  if (type.startsWith('agent.stale')) return '⚠️';
  if (type.startsWith('contract')) return '📋';
  return '•';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
