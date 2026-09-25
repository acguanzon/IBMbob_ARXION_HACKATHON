import type { ProjectWithMembers } from '@arxion/types';

interface ActivityPanelProps {
  project: ProjectWithMembers | null;
}

export function ActivityPanel({ project }: ActivityPanelProps) {
  return (
    <aside className="flex w-64 flex-col border-l border-slate-200 bg-white overflow-y-auto">
      {/* Activity */}
      <section className="border-b border-slate-200 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Recent Activity
        </p>
        <ul className="space-y-2.5">
          {project ? (
            <>
              <ActivityItem
                icon="✅"
                text="T-101 created"
                sub="by Maki"
                time="just now"
              />
              <ActivityItem
                icon="✅"
                text="T-102 created"
                sub="by Maki"
                time="just now"
              />
              <ActivityItem
                icon="✅"
                text="T-103 created"
                sub="by Maki"
                time="just now"
              />
            </>
          ) : (
            <li className="text-xs text-slate-400">No recent activity</li>
          )}
        </ul>
      </section>

      {/* Active agents */}
      <section className="border-b border-slate-200 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Active Agents
        </p>
        <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center">
          <p className="text-xs text-slate-400">No active agent sessions</p>
          <p className="mt-0.5 text-xs text-slate-300">Phase 2</p>
        </div>
      </section>

      {/* File reservations */}
      <section className="border-b border-slate-200 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          File Reservations
        </p>
        <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center">
          <p className="text-xs text-slate-400">No active reservations</p>
          <p className="mt-0.5 text-xs text-slate-300">Phase 2</p>
        </div>
      </section>

      {/* Conflicts */}
      <section className="p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Conflicts
        </p>
        <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center">
          <p className="text-xs text-slate-400">No conflicts detected</p>
        </div>
      </section>
    </aside>
  );
}

interface ActivityItemProps {
  icon: string;
  text: string;
  sub: string;
  time: string;
}

function ActivityItem({ icon, text, sub, time }: ActivityItemProps) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-sm">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-700">{text}</p>
        <p className="text-xs text-slate-400">
          {sub} · {time}
        </p>
      </div>
    </li>
  );
}
