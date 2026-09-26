import { redirect } from 'next/navigation';
import { serverApi as api } from '@/lib/server-api';
import { EmptyProjectState } from '@/components/projects/EmptyProjectState';

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

  return <EmptyProjectState />;
}
