'use client';

import type { TaskWithRelations } from '@arxion/types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TaskCardProps {
  task: TaskWithRelations;
  meta?: { activeFiles: number; contractRisks: number };
  onClick: (task: TaskWithRelations) => void;
  onTaskUpdated: (task: TaskWithRelations) => void;
}

const PRIORITY_BADGE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-500',
  MEDIUM: 'bg-blue-50 text-blue-600',
  HIGH: 'bg-orange-100 text-orange-600',
  CRITICAL: 'bg-red-100 text-red-600',
};

const READINESS_BADGE: Record<
  string,
  { label: string; cls: string }
> = {
  READY: { label: 'Ready', cls: 'bg-emerald-100 text-emerald-700' },
  AT_RISK: { label: 'At Risk', cls: 'bg-yellow-100 text-yellow-700' },
  BLOCKED_BY_DEPENDENCY: { label: 'Blocked', cls: 'bg-red-100 text-red-600' },
  WAITING_FOR_CONTEXT: { label: 'Waiting', cls: 'bg-orange-100 text-orange-600' },
  INTERRUPTED: { label: 'Interrupted', cls: 'bg-red-100 text-red-600' },
};

export function TaskCard({ task, meta, onClick }: TaskCardProps) {
  const hasBlockedDeps = task.dependencies.some((d) => d.dependsOn.status !== 'DONE');

  // Derive a simple readiness from local data (full readiness requires API call via drawer)
  const readinessState = hasBlockedDeps && task.status !== 'DONE' ? 'BLOCKED_BY_DEPENDENCY' : null;
  const readinessBadge = readinessState ? READINESS_BADGE[readinessState] : null;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const acCount = task.acceptanceCriteria?.length ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-blue-300 hover:shadow-md transition-all select-none"
      onClick={() => onClick(task)}
    >
      {/* Drag handle + ID + Priority */}
      <div className="mb-1.5 flex items-center justify-between gap-1">
        {/* drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab text-slate-300 hover:text-slate-400 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </div>
        <span className="flex-1 font-mono text-xs font-semibold text-slate-400">
          {task.displayId}
        </span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${PRIORITY_BADGE[task.priority] ?? ''}`}
        >
          {task.priority}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-slate-800 leading-snug">{task.title}</p>

      {/* Description excerpt */}
      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{task.description}</p>
      )}

      {/* Badges row */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {readinessBadge && (
          <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${readinessBadge.cls}`}>
            {readinessBadge.label}
          </span>
        )}
        {meta?.activeFiles ? (
          <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">
            📌 {meta.activeFiles}
          </span>
        ) : null}
        {meta?.contractRisks ? (
          <span className="inline-flex items-center gap-0.5 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600">
            🚨 {meta.contractRisks}
          </span>
        ) : null}
        {acCount > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
            ✓ {acCount}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between">
        {task.assignee ? (
          <div className="flex items-center gap-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
              {task.assignee.name.charAt(0).toUpperCase()}
            </span>
            <span className="text-xs text-slate-500 truncate max-w-[80px]">
              {task.assignee.name}
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-300">Unassigned</span>
        )}

        {/* Status presence hint for IN_PROGRESS */}
        {task.status === 'IN_PROGRESS' && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        )}
      </div>
    </div>
  );
}
