'use client';

import { useState } from 'react';
import type { TaskWithRelations } from '@arxion/types';
import { api } from '@/lib/api';

interface ReviewRequestModalProps {
  task: TaskWithRelations;
  onClose: () => void;
  onConfirmed: (updated: TaskWithRelations) => void;
}

export function ReviewRequestModal({ task, onClose, onConfirmed }: ReviewRequestModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      const updated = await api.tasks.update(task.id, { status: 'REVIEW' });
      onConfirmed(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move to review');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-xl border border-slate-200">
        <h2 className="text-base font-semibold text-slate-900">Request Review?</h2>
        <p className="mt-2 text-sm text-slate-600">
          Move <span className="font-medium">{task.displayId} — {task.title}</span> to{' '}
          <span className="font-medium text-purple-600">REVIEW</span>? Make sure your work is
          complete and tests pass before requesting review.
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
            {submitting ? 'Moving…' : 'Request Review'}
          </button>
        </div>
      </div>
    </>
  );
}
