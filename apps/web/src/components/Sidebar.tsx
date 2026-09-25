import type { ProjectWithMembers } from '@arxion/types';

interface SidebarProps {
  projects: ProjectWithMembers[];
  activeProjectId: string | null;
}

export function Sidebar({ projects, activeProjectId }: SidebarProps) {
  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
      {/* Brand */}
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧩</span>
          <span className="font-bold text-slate-900">Arxion</span>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">Agent Collaboration Platform</p>
      </div>

      {/* Navigation */}
      <div className="px-3 pt-4">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Navigation
        </p>
        <ul className="space-y-0.5">
          <li>
            <a href="/dashboard" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              <span>📋</span> Board
            </a>
          </li>
          <li>
            <a href="/dashboard/reviews" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              <span>🔍</span> Reviews
            </a>
          </li>
          <li>
            <a href="/dashboard/decisions" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              <span>📝</span> Decisions
            </a>
          </li>
        </ul>
      </div>

      {/* Projects */}
      <div className="px-3 pt-4">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Projects
        </p>
        <ul className="space-y-0.5">
          {projects.map((project) => (
            <li key={project.id}>
              <div
                className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${
                  project.id === activeProjectId
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{project.name}</span>
                <span className="ml-1 shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                  {project._count.tasks}
                </span>
              </div>
            </li>
          ))}
          {projects.length === 0 && (
            <li className="px-2 py-2 text-xs text-slate-400">No projects found</li>
          )}
        </ul>
      </div>

      {/* Members */}
      {activeProject && (
        <div className="px-3 pt-6">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Team Members
          </p>
          <ul className="space-y-1">
            {activeProject.members.map((member) => (
              <li key={member.id} className="flex items-center gap-2 px-2 py-1">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                  {member.user.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-700">{member.user.name}</p>
                  <p className="text-xs text-slate-400">{member.role}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto border-t border-slate-200 px-4 py-3">
        <p className="text-xs text-slate-400">Phase 3</p>
      </div>
    </aside>
  );
}
