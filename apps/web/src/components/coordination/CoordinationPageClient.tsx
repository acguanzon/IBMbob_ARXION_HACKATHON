'use client';

import { useState, useEffect } from 'react';
import { api, type CoordinatorSummary, type ContextUpdateItem, type FileReservationWithRelations } from '@/lib/api';

interface CoordinationPageClientProps {
  projectId: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  LOW: 'text-blue-600',
  MEDIUM: 'text-amber-600',
  HIGH: 'text-orange-600',
  CRITICAL: 'text-red-600 font-bold',
};

function relTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function CoordinationPageClient({ projectId }: CoordinationPageClientProps) {
  const [summary, setSummary] = useState<CoordinatorSummary | null>(null);
  const [contextUpdates, setContextUpdates] = useState<ContextUpdateItem[]>([]);
  const [reservations, setReservations] = useState<FileReservationWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [s, r] = await Promise.allSettled([
        api.coordination.getSummary(projectId),
        api.fileReservations.listActiveByProject(projectId),
      ]);
      if (s.status === 'fulfilled') setSummary(s.value);
      else setError('Failed to load coordination summary.');
      if (r.status === 'fulfilled') setReservations(r.value);
      setLoading(false);
    }
    load();
  }, [projectId]);

  async function ackContextUpdate(id: string) {
    try {
      await api.coordination.acknowledgeContextUpdate(id);
      setContextUpdates((prev) => prev.filter((u) => u.id !== id));
    } catch {
      // non-fatal
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Loading coordination data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ready Tasks */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Ready to Work ({summary?.readyTasks.length ?? 0})
        </h2>
        {summary?.readyTasks.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {summary.readyTasks.map((t) => (
              <div key={t.id} className="rounded-lg border border-emerald-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-400">{t.displayId}</span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    {t.priority}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-800">{t.title}</p>
                {t.assignee && (
                  <p className="mt-1 text-xs text-slate-500">{t.assignee.name}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No tasks are currently ready.</p>
        )}
      </section>

      {/* Waiting Tasks */}
      {(summary?.waitingTasks.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Waiting ({summary!.waitingTasks.length})
          </h2>
          <div className="space-y-2">
            {summary!.waitingTasks.map((t) => (
              <div key={t.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400">{t.displayId}</span>
                  <span className="text-sm font-medium text-slate-800">{t.title}</span>
                </div>
                <p className="mt-0.5 text-xs text-amber-700">{t.waitReason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Interrupted Tasks */}
      {(summary?.interruptedTasks.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Interrupted ({summary!.interruptedTasks.length})
          </h2>
          <div className="space-y-2">
            {summary!.interruptedTasks.map((t) => (
              <div key={t.id} className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400">{t.displayId}</span>
                  <span className="text-sm font-medium text-slate-800">{t.title}</span>
                </div>
                <p className="mt-0.5 text-xs text-red-600">⚠ {t.interruption}</p>
                <p className="mt-0.5 text-xs text-blue-600">↻ {t.recovery}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Safe Parallel Groups */}
      {(summary?.safeParallelGroups.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            Safe Parallel Groups ({summary!.safeParallelGroups.length})
          </h2>
          <div className="space-y-2">
            {summary!.safeParallelGroups.map((g) => (
              <div key={g.groupId} className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs font-medium text-blue-700">Group {g.groupId}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {g.tasks.map((t) => (
                    <span
                      key={t.displayId}
                      className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700"
                    >
                      {t.displayId} — {t.title}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* High/Critical Risks */}
      {(summary?.highRisks.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Risks ({summary!.highRisks.length})
          </h2>
          <div className="space-y-2">
            {summary!.highRisks.map((r, i) => (
              <div key={r.id ?? i} className="rounded-lg border border-red-200 bg-white p-3">
                <div className="flex items-start gap-2">
                  <span className={`shrink-0 text-xs font-semibold ${SEVERITY_COLOR[r.severity] ?? 'text-slate-600'}`}>
                    {r.severity}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{r.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{r.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Context Update Inbox */}
      {contextUpdates.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Context Update Inbox ({contextUpdates.length})
          </h2>
          <div className="space-y-2">
            {contextUpdates.map((u) => (
              <div key={u.id} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{u.title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{u.message}</p>
                  {u.sourceTask && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      from {u.sourceTask.displayId} · {relTime(u.createdAt)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => ackContextUpdate(u.id)}
                  className="shrink-0 rounded bg-amber-100 px-2 py-1 text-xs text-amber-700 hover:bg-amber-200"
                >
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active File Reservations */}
      {reservations.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Active File Reservations ({reservations.length})
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">File</th>
                  <th className="px-3 py-2 text-left">Task</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservations.map((r) => (
                  <tr key={r.id} className={r.status === 'CONFLICT' ? 'bg-amber-50' : ''}>
                    <td className="max-w-[160px] truncate px-3 py-2 font-mono" title={r.filePath}>
                      {r.filePath.split('/').pop()}
                    </td>
                    <td className="px-3 py-2">{r.task.displayId}</td>
                    <td className="px-3 py-2">{r.user.name}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                          r.status === 'CONFLICT' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!summary?.readyTasks.length &&
        !summary?.waitingTasks.length &&
        !summary?.highRisks.length &&
        contextUpdates.length === 0 && (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200">
            <p className="text-sm text-slate-400">No coordination issues detected. All clear! 🎉</p>
          </div>
        )}
    </div>
  );
}
