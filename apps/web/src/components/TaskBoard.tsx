import type { TaskWithRelations, TaskStatus } from '@arxion/types';

interface TaskBoardProps {
  tasks: TaskWithRelations[];
  projectId: string;
}

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'BACKLOG', label: 'Backlog', color: 'bg-slate-100 text-slate-600' },
  { status: 'TODO', label: 'To Do', color: 'bg-blue-100 text-blue-700' },
  { status: 'IN_PROGRESS', label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  { status: 'REVIEW', label: 'Review', color: 'bg-purple-100 text-purple-700' },
  { status: 'DONE', label: 'Done', color: 'bg-emerald-100 text-emerald-700' },
];

const PRIORITY_BADGE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-500',
  MEDIUM: 'bg-blue-50 text-blue-600',
  HIGH: 'bg-orange-100 text-orange-600',
  CRITICAL: 'bg-red-100 text-red-600',
};

export function TaskBoard({ tasks }: TaskBoardProps) {
  const tasksByStatus = Object.fromEntries(
    COLUMNS.map((col) => [col.status, tasks.filter((t) => t.status === col.status)]),
  ) as Record<TaskStatus, TaskWithRelations[]>;

  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const colTasks = tasksByStatus[col.status] ?? [];
        return (
          <div
            key={col.status}
            className="flex w-64 shrink-0 flex-col rounded-lg border border-slate-200 bg-white"
          >
            {/* Column header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${col.color}`}>
                {col.label}
              </span>
              <span className="text-xs text-slate-400">{colTasks.length}</span>
            </div>

            {/* Cards */}
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
              {colTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
              {colTasks.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-300">Empty</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({ task }: { task: TaskWithRelations }) {
  const hasBlockedDeps = task.dependencies.some(
    (d) => d.dependsOn.status !== 'DONE',
  );

  return (
    <div className="group rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-blue-300 hover:shadow-md transition-all">
      {/* Display ID + Priority */}
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-mono font-semibold text-slate-400">{task.displayId}</span>
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

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between">
        {/* Assignee */}
        {task.assignee ? (
          <div className="flex items-center gap-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
              {task.assignee.name.charAt(0).toUpperCase()}
            </span>
            <span className="text-xs text-slate-500">{task.assignee.name}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-300">Unassigned</span>
        )}

        {/* Blocked indicator */}
        {hasBlockedDeps && task.status !== 'DONE' && (
          <span
            className="rounded-full bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-500"
            title="Has unfinished dependencies"
          >
            Blocked
          </span>
        )}

        {/* Dependency count */}
        {task.dependencies.length > 0 && (
          <span className="text-xs text-slate-400">
            {task.dependencies.length} dep{task.dependencies.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
