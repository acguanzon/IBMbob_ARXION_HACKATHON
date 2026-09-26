'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ProjectWithMembers } from '@arxion/types';
import { useAuth } from '@/context/AuthContext';
import { AddMemberModal } from '@/components/members/AddMemberModal';
import { useState } from 'react';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';

interface SidebarProps {
  projects: ProjectWithMembers[];
  activeProjectId: string | null;
}

export function Sidebar({ projects, activeProjectId }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

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
            <Link
              href={activeProjectId ? `/dashboard/${activeProjectId}` : '/dashboard'}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                pathname === `/dashboard/${activeProjectId ?? ''}` || pathname === '/dashboard'
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>📋</span> Board
            </Link>
          </li>
          <li>
            <Link
              href={activeProjectId ? `/dashboard/${activeProjectId}/coordination` : '/dashboard'}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                pathname.endsWith('/coordination')
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>🧠</span> Intelligence
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/reviews"
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                pathname === '/dashboard/reviews'
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>🔍</span> Reviews
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/decisions"
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                pathname === '/dashboard/decisions'
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>📝</span> Decisions
            </Link>
          </li>
        </ul>
      </div>

      {/* Projects */}
      <div className="px-3 pt-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Projects</p>
          <button onClick={() => setShowCreateProject(true)} className="rounded px-1.5 py-0.5 text-xs text-blue-600 hover:bg-blue-50" title="Create project">+ New</button>
        </div>
        <ul className="space-y-0.5">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/dashboard/${project.id}`}
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
              </Link>
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
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Team Members
            </p>
            <button
              onClick={() => setShowAddMember(true)}
              className="rounded px-1.5 py-0.5 text-xs text-blue-600 hover:bg-blue-50"
              title="Add member"
            >
              + Add
            </button>
          </div>
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
        {user ? (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-700">{user.name}</p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>
            <button
              onClick={logout}
              className="ml-2 shrink-0 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Phase 3+</p>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddMember && activeProject && (
        <AddMemberModal
          projectId={activeProject.id}
          onClose={() => setShowAddMember(false)}
        />
      )}
      {showCreateProject && (
        <CreateProjectModal onClose={() => setShowCreateProject(false)} />
      )}
    </aside>
  );
}
