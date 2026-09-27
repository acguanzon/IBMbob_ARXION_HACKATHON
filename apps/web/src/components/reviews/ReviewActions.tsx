'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface ReviewActionsProps {
  reviewId: string;
  blockingFindingCount: number;
}

export function ReviewActions({ reviewId, blockingFindingCount }: ReviewActionsProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState<'approve' | 'changes' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve(): Promise<void> {
    if (!user) {
      setError('You must be signed in to approve a review.');
      return;
    }

    setSubmitting('approve');
    setError(null);
    try {
      await api.reviews.approve(reviewId, user.id, comment.trim() || undefined);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve this review.');
    } finally {
      setSubmitting(null);
    }
  }

  async function requestChanges(): Promise<void> {
    if (!user) {
      setError('You must be signed in to request changes.');
      return;
    }

    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      setError('Explain what needs to change before submitting.');
      return;
    }

    setSubmitting('changes');
    setError(null);
    try {
      await api.reviews.requestChanges(reviewId, user.id, trimmedComment);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request changes.');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <label className="block text-xs font-medium text-slate-700" htmlFor={`review-comment-${reviewId}`}>
        Review comment
      </label>
      <textarea
        id={`review-comment-${reviewId}`}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Optional when approving; required when requesting changes."
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />

      {blockingFindingCount > 0 && (
        <p className="mt-2 text-xs text-red-600">
          Resolve or dismiss {blockingFindingCount} open blocking finding{blockingFindingCount === 1 ? '' : 's'} before approval.
        </p>
      )}
      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={requestChanges}
          disabled={submitting !== null}
          className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting === 'changes' ? 'Submitting…' : 'Request changes'}
        </button>
        <button
          type="button"
          onClick={approve}
          disabled={submitting !== null || blockingFindingCount > 0}
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting === 'approve' ? 'Approving…' : 'Approve review'}
        </button>
      </div>
    </div>
  );
}
