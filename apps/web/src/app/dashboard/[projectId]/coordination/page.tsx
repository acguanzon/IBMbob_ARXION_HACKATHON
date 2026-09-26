import { api } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { RealtimeProvider } from '@/components/RealtimeProvider';
import { CoordinationPageClient } from '@/components/coordination/CoordinationPageClient';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface CoordinationPageProps {
  params: { projectId: string };
}

export default async function CoordinationPage({ params }: CoordinationPageProps) {
  const { projectId } = params;

  let projects: Awaited<ReturnType<typeof api.projects.list>> = [];
  try {
    projects = await api.projects.list();
  } catch {
    // fall through
  }

  const project = projects.find((p) => p.id === projectId) ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <RealtimeProvider projectId={projectId} />
      <Sidebar projects={projects} activeProjectId={projectId} />

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/${projectId}`}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                ← Board
              </Link>
              <span className="text-slate-300">/</span>
              <h1 className="text-lg font-semibold text-slate-900">Coordination Intelligence</h1>
            </div>
            {project?.description && (
              <p className="mt-0.5 text-sm text-slate-500">{project.name}</p>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <CoordinationPageClient projectId={projectId} />
        </div>
      </main>
    </div>
  );
}
