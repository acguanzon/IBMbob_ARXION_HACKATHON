import { redirect } from 'next/navigation';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * /dashboard — redirect to first project or show a picker if none exists.
 */
export default async function DashboardIndexPage() {
  let projects: Awaited<ReturnType<typeof api.projects.list>> = [];
  try {
    projects = await api.projects.list();
  } catch {
    // fall through to the "no projects" UI
  }

  const first = projects[0];
  if (first) {
    redirect(`/dashboard/${first.id}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <span className="text-5xl">🧩</span>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Arxion</h1>
        <p className="mt-2 text-slate-500">No projects found.</p>
        <p className="mt-1 text-sm text-slate-400">
          Run <code className="rounded bg-slate-100 px-1">npm run db:seed</code> to create demo
          data, or create a project via the API.
        </p>
      </div>
    </div>
  );
}
