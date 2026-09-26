'use client';

import { useState } from 'react';
import { CreateProjectModal } from './CreateProjectModal';

export function EmptyProjectState() {
  const [showCreateProject, setShowCreateProject] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <span className="text-5xl">🧩</span>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Create your first project</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Projects hold your tasks, teammates, coding agents, decisions, and coordination history.
        </p>
        <button onClick={() => setShowCreateProject(true)} className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          Create project
        </button>
        <p className="mt-4 text-xs text-slate-400">If you expected an existing project, ask its owner to add your registered email.</p>
      </div>
      {showCreateProject && <CreateProjectModal onClose={() => setShowCreateProject(false)} />}
    </div>
  );
}
