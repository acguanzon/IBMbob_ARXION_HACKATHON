'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export function CompleteTaskAction({ taskId }: { taskId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function completeTask(): Promise<void> {
    if (!user) {
      setError('You must be signed in to finish this task.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.tasks.complete(taskId, user.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish this task.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-800">Review approved</p>
          <p className="text-xs text-slate-500">
            Finish the task to move it into the Done column.
          </p>
        </div>
        <button
          type="button"
          onClick={completeTask}
          disabled={submitting}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Finishing…' : 'Move task to Done'}
        </button>
      </div>
      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
