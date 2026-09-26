'use client';

import { useEffect, useState } from 'react';
import type { TaskWithRelations } from '@arxion/types';
import { api, type TaskReadinessResult, type HandoffItem, type ContextUpdateItem } from '@/lib/api';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';

interface TaskDetailDrawerProps {
  task: TaskWithRelations;
  projectId: string;
  onClose: () => void;
  onTaskUpdated: (task: TaskWithRelations) => void;
}

const READINESS_STYLE: Record<string, string> = {
  READY: 'bg-emerald-100 text-emerald-700',
  AT_RISK: 'bg-yellow-100 text-yellow-700',
  BLOCKED_BY_DEPENDENCY: 'bg-red-100 text-red-600',
  WAITING_FOR_CONTEXT: 'bg-orange-100 text-orange-600',
  INTERRUPTED: 'bg-red-100 text-red-600',
};

const STATUS_COLOR: Record<string, string> = {
  BACKLOG: 'bg-slate-100 text-slate-600',
  TODO: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  REVIEW: 'bg-purple-100 text-purple-700',
  DONE: 'bg-emerald-100 text-emerald-700',
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-500',
  MEDIUM: 'bg-blue-50 text-blue-600',
  HIGH: 'bg-orange-100 text-orange-600',
  CRITICAL: 'bg-red-100 text-red-600',
};

function relTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function TaskDetailDrawer({ task, projectId, onClose, onTaskUpdated }: TaskDetailDrawerProps) {
  const [readiness, setReadiness] = useState<TaskReadinessResult | null>(null);
  const [handoffs, setHandoffs] = useState<HandoffItem[]>([]);
  const [contextUpdates, setContextUpdates] = useState<ContextUpdateItem[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    // Load readiness, handoffs, context updates in parallel (non-blocking)
    Promise.allSettled([
      api.coordination.getReadiness(task.id),
      api.coordination.getHandoffs(task.id),
      api.coordination.getContextUpdates(task.id),
    ]).then(([r, h, c]) => {
      if (r.status === 'fulfilled') setReadiness(r.value);
      if (h.status === 'fulfilled') setHandoffs(h.value);
      if (c.status === 'fulfilled') setContextUpdates(c.value);
    });
  }, [task.id]);

  async function ackContextUpdate(id: string) {
    try {
      await api.coordination.acknowledgeContextUpdate(id);
      setContextUpdates((prev) => prev.filter((u) => u.id !== id));
    } catch {
      // non-fatal
    }
  }

  async function ackHandoff(id: string) {
    try {
      await api.coordination.acknowledgeHandoff(id);
      setHandoffs((prev) => prev.filter((h) => h.id !== id));
    } catch {
      // non-fatal
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 z-50 flex h-full w-[480px] max-w-full flex-col overflow-y-auto bg-white shadow-xl border-l border-slate-200">
        {/* Header */}
        <div className="sticky top-0 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-slate-400">{task.displayId}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[task.status] ?? ''}`}>
                {task.status.replace('_', ' ')}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLOR[task.priority] ?? ''}`}>
                {task.priority}
              </span>
              {readiness && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${READINESS_STYLE[readiness.state] ?? ''}`}>
                  {readiness.state.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <h2 className="mt-1 text-base font-semibold text-slate-900 leading-snug">
              {task.title}
            </h2>
          </div>
          <div className="ml-3 flex shrink-0 items-center gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              Edit
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 p-5">
          {/* Description */}
          {task.description && (
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Description
              </h3>
              <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                {task.description}
              </p>
            </section>
          )}

          {/* Acceptance Criteria */}
          {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Acceptance Criteria
              </h3>
              <ul className="space-y-1">
                {task.acceptanceCriteria.map((ac, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-0.5 text-slate-400">☐</span>
                    {ac}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Assignee */}
          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Assignee
            </h3>
            {task.assignee ? (
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                  {task.assignee.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-700">{task.assignee.name}</p>
                  <p className="text-xs text-slate-400">{task.assignee.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Unassigned</p>
            )}
          </section>

          {/* Dependencies */}
          {task.dependencies.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Dependencies
              </h3>
              <ul className="space-y-1">
                {task.dependencies.map((dep) => (
                  <li key={dep.id} className="flex items-center gap-2 text-sm">
                    <span
                      className={`h-2 w-2 rounded-full ${dep.dependsOn.status === 'DONE' ? 'bg-emerald-400' : 'bg-red-400'}`}
                    />
                    <span className="font-mono text-xs text-slate-400">
                      {dep.dependsOn.displayId}
                    </span>
                    <span className="text-slate-700">{dep.dependsOn.title}</span>
                    <span className="ml-auto text-xs text-slate-400">{dep.dependsOn.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Readiness reasons */}
          {readiness && (readiness.blockers.length > 0 || readiness.warnings.length > 0) && (
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Readiness Details
              </h3>
              {readiness.blockers.map((b, i) => (
                <p key={i} className="text-sm text-red-600">⛔ {b}</p>
              ))}
              {readiness.warnings.map((w, i) => (
                <p key={i} className="text-sm text-yellow-600">⚠ {w}</p>
              ))}
            </section>
          )}

          {/* Pending Handoffs */}
          {handoffs.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Pending Handoffs ({handoffs.length})
              </h3>
              <ul className="space-y-2">
                {handoffs.map((h) => (
                  <li key={h.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{h.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{h.content}</p>
                        <p className="mt-1 text-xs text-slate-400">{relTime(h.createdAt)}</p>
                      </div>
                      <button
                        onClick={() => ackHandoff(h.id)}
                        className="shrink-0 rounded bg-blue-50 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100"
                      >
                        Ack
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Context Updates */}
          {contextUpdates.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Context Updates ({contextUpdates.length})
              </h3>
              <ul className="space-y-2">
                {contextUpdates.map((u) => (
                  <li key={u.id} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{u.title}</p>
                        <p className="mt-0.5 text-xs text-slate-600">{u.message}</p>
                        {u.sourceTask && (
                          <p className="mt-0.5 text-xs text-slate-400">
                            from {u.sourceTask.displayId}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => ackContextUpdate(u.id)}
                        className="shrink-0 rounded bg-amber-100 px-2 py-1 text-xs text-amber-700 hover:bg-amber-200"
                      >
                        Ack
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Timestamps */}
          <section className="border-t border-slate-100 pt-4">
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
              <div>
                <span className="font-medium text-slate-400">Created</span>
                <p>{new Date(task.createdAt).toLocaleDateString()}</p>
              </div>
              {task.startedAt && (
                <div>
                  <span className="font-medium text-slate-400">Started</span>
                  <p>{new Date(task.startedAt).toLocaleDateString()}</p>
                </div>
              )}
              {task.completedAt && (
                <div>
                  <span className="font-medium text-slate-400">Completed</span>
                  <p>{new Date(task.completedAt).toLocaleDateString()}</p>
                </div>
              )}
              <div>
                <span className="font-medium text-slate-400">Project</span>
                <p className="font-mono">{projectId.slice(0, 8)}…</p>
              </div>
            </div>
          </section>
        </div>
      </aside>

      {/* Edit modal */}
      {editOpen && (
        <TaskFormModal
          projectId={projectId}
          task={task}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            onTaskUpdated(updated);
            setEditOpen(false);
          }}
        />
      )}
    </>
  );
}
