'use client';

import { useState } from 'react';
import type { TaskWithRelations } from '@arxion/types';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface ReviewRequestModalProps {
  task: TaskWithRelations;
  onClose: () => void;
  onConfirmed: (updated: TaskWithRelations) => void;
}

export function ReviewRequestModal({ task, onClose, onConfirmed }: ReviewRequestModalProps) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      if (!user) throw new Error('You must be signed in to request a review.');
      await api.reviews.request(task.id, user.id);
      onConfirmed({ ...task, status: 'REVIEW' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move to review');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-slate-900">Request Review?</h2>
        <p className="mt-2 text-sm text-slate-600">
          Create a review for{' '}
          <span className="font-medium">
            {task.displayId} — {task.title}
          </span>
          ? A completion report is required so reviewers can verify the changed files, tests, and
          revision.
        </p>

        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {submitting ? 'Requesting…' : 'Request Review'}
          </button>
        </div>
      </div>
    </>
  );
}
