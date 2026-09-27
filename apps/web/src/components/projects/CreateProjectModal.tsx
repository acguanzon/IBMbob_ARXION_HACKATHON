'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface CreateProjectModalProps {
  onClose: () => void;
}

export function CreateProjectModal({ onClose }: CreateProjectModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !repositoryUrl.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await api.projects.create({
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        repositorySetup: { mode: 'existing', repositoryUrl: repositoryUrl.trim() },
      });
      onClose();
      router.push(`/dashboard/${project.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create project');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-title"
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="create-project-title" className="text-lg font-semibold text-slate-900">
              Create a project
            </h2>
            <p className="mt-1 text-sm text-slate-500">You will become the project owner.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <label className="mt-5 block text-sm font-medium text-slate-700">
          Project name
          <input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Example: FinSight"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Description <span className="font-normal text-slate-400">(optional)</span>
          <textarea
            maxLength={1000}
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this team building?"
            className="mt-1 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-slate-700">GitHub repository</legend>
          <p className="mt-1 text-xs text-slate-500">
            Connect the project to a repository that is already on GitHub.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-blue-500 bg-blue-50 p-3 ring-1 ring-blue-500">
              <span className="flex items-start gap-2">
                <span className="mt-0.5 text-blue-600" aria-hidden="true">
                  ✓
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    Connect existing
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Use a repository that is already on GitHub.
                  </span>
                </span>
              </span>
            </div>
            <div
              className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 opacity-75"
              aria-disabled="true"
            >
              <span className="flex items-start gap-2">
                <span>
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    Create new
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Coming soon
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Repository creation will be available in a future update.
                  </span>
                </span>
              </span>
            </div>
          </div>
        </fieldset>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          GitHub repository URL
          <input
            required
            type="url"
            value={repositoryUrl}
            onChange={(event) => setRepositoryUrl(event.target.value)}
            placeholder="https://github.com/team/repository"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim() || !repositoryUrl.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </form>
    </div>
  );
}
