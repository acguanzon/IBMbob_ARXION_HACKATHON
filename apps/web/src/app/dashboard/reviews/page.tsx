import { api } from '@/lib/api';
import type { ReviewWithDetails } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { RealtimeProvider } from '@/components/RealtimeProvider';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  IN_REVIEW: 'bg-blue-100 text-blue-700',
  CHANGES_REQUESTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  INVALIDATED: 'bg-red-100 text-red-700',
  REJECTED: 'bg-red-100 text-red-700',
  SUPERSEDED: 'bg-slate-100 text-slate-400',
};

const SEVERITY_COLOR: Record<string, string> = {
  INFO: 'text-slate-500',
  LOW: 'text-blue-600',
  MEDIUM: 'text-amber-600',
  HIGH: 'text-orange-600',
  CRITICAL: 'text-red-600 font-bold',
};

function ReviewCard({ review, taskDisplayId }: { review: ReviewWithDetails; taskDisplayId?: string }) {
  const blockingOpen = review.findings.filter((f) => f.isBlocking && f.status === 'OPEN');
  const allFindings = review.findings;
  const statusClass = STATUS_COLOR[review.status] ?? 'bg-slate-100 text-slate-600';

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {taskDisplayId && (
              <span className="font-mono text-xs text-slate-400">{taskDisplayId}</span>
            )}
            <span className="font-medium text-slate-900">Review v{review.reviewVersion}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
              {review.status}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Requested by {review.requestedBy.name} · {new Date(review.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {review.reviewRevision && (
            <span className="font-mono text-xs text-slate-400">{review.reviewRevision.slice(0, 8)}</span>
          )}
          {review.approvedAt && (
            <p className="text-xs text-emerald-600">✓ Approved {new Date(review.approvedAt).toLocaleDateString()}</p>
          )}
        </div>
      </div>

      {/* Snapshot */}
      {review.snapshot && (
        <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-medium">Snapshot: </span>
          {review.snapshot.branchName && <span>branch <code className="font-mono">{review.snapshot.branchName}</code> · </span>}
          <span>revision <code className="font-mono">{review.snapshot.workRevision.slice(0, 8)}</code></span>
          {review.snapshot.testSnapshot && (
            <span> · tests {String((review.snapshot.testSnapshot as Record<string, unknown>)['testsPassed'] ?? '?')}/{String((review.snapshot.testSnapshot as Record<string, unknown>)['testsRun'] ?? '?')}</span>
          )}
        </div>
      )}

      {/* Findings summary */}
      {allFindings.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">
            Findings — {allFindings.length} total
            {blockingOpen.length > 0 && (
              <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-600">
                {blockingOpen.length} blocking open
              </span>
            )}
          </p>
          <ul className="space-y-1">
            {allFindings.slice(0, 6).map((f) => (
              <li key={f.id} className="flex items-start gap-1.5 text-xs">
                <span className={`shrink-0 font-medium ${SEVERITY_COLOR[f.severity] ?? 'text-slate-600'}`}>
                  [{f.source}] {f.severity}
                </span>
                <span className="text-slate-700">{f.title}</span>
                <span className={`ml-auto shrink-0 rounded px-1 py-0.5 text-xs ${f.status === 'OPEN' ? (f.isBlocking ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600') : 'bg-slate-100 text-slate-400'}`}>
                  {f.status}
                </span>
              </li>
            ))}
            {allFindings.length > 6 && (
              <li className="text-xs text-slate-400">+{allFindings.length - 6} more findings</li>
            )}
          </ul>
        </div>
      )}

      {/* Change comment */}
      {review.comment && (
        <div className="mt-3 rounded-md border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {review.comment}
        </div>
      )}

      {/* Invalidation */}
      {review.invalidatedAt && (
        <div className="mt-3 rounded-md border-l-2 border-red-400 bg-red-50 px-3 py-2 text-xs text-red-700">
          Invalidated: {review.invalidationReason}
        </div>
      )}
    </div>
  );
}

export default async function ReviewsPage() {
  let projects: Awaited<ReturnType<typeof api.projects.list>> = [];

  try {
    projects = await api.projects.list();
  } catch {
    // handled below
  }

  const firstProject = projects[0] ?? null;

  let tasks: Awaited<ReturnType<typeof api.tasks.listByProject>> = [];
  if (firstProject) {
    try {
      tasks = await api.tasks.listByProject(firstProject.id);
    } catch {
      // non-fatal
    }
  }

  // Fetch reviews for all tasks in parallel
  type ReviewEntry = { task: (typeof tasks)[number]; reviews: ReviewWithDetails[] };
  const reviewEntries: ReviewEntry[] = [];

  await Promise.all(
    tasks.map(async (task) => {
      try {
        const reviews = await api.reviews.listByTask(task.id);
        if (reviews.length > 0) {
          reviewEntries.push({ task, reviews });
        }
      } catch {
        // ignore tasks with no reviews
      }
    }),
  );

  // Sort by most recently updated
  reviewEntries.sort((a, b) => {
    const latestA = a.reviews[0]?.updatedAt ?? '';
    const latestB = b.reviews[0]?.updatedAt ?? '';
    return latestB.localeCompare(latestA);
  });

  // Dashboard counters
  const allReviews = reviewEntries.flatMap((e) => e.reviews);
  const counts = {
    inReview: allReviews.filter((r) => r.status === 'IN_REVIEW').length,
    changesRequested: allReviews.filter((r) => r.status === 'CHANGES_REQUESTED').length,
    approved: allReviews.filter((r) => r.status === 'APPROVED').length,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {firstProject && <RealtimeProvider projectId={firstProject.id} />}
      <Sidebar projects={projects} activeProjectId={firstProject?.id ?? null} />

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Reviews</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {firstProject?.name ?? 'No project selected'} — review workspace
            </p>
          </div>
          <div className="flex items-center gap-2">
            {counts.inReview > 0 && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {counts.inReview} in review
              </span>
            )}
            {counts.changesRequested > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                {counts.changesRequested} changes requested
              </span>
            )}
            {counts.approved > 0 && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                {counts.approved} approved
              </span>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {reviewEntries.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="text-4xl">🔍</div>
                <h2 className="mt-3 text-lg font-medium text-slate-700">No reviews yet</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Reviews appear here when an agent calls <code className="rounded bg-slate-100 px-1">request_review</code>.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {reviewEntries.map(({ task, reviews }) => (
                <section key={task.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <h2 className="font-medium text-slate-700">
                      <span className="font-mono text-sm text-slate-400">{task.displayId}</span>{' '}
                      {task.title}
                    </h2>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[task.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {task.status}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {reviews.map((review) => (
                      <ReviewCard key={review.id} review={review} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
