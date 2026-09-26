'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';

interface AddMemberModalProps {
  projectId: string;
  onClose: () => void;
}

export function AddMemberModal({ projectId, onClose }: AddMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.projects.addMember(projectId, email, role);
      setSuccess(true);
      setTimeout(() => {
        onClose();
        // Trigger a page refresh to load updated member list
        if (typeof window !== 'undefined') window.location.reload();
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Add Team Member</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
            ✕
          </button>
        </div>

        {success ? (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            ✓ Member added successfully!
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="member@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
                <option value="OWNER">Owner</option>
              </select>
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? 'Adding…' : 'Add Member'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
