'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectWithMembers } from '@arxion/types';
import { api } from '@/lib/api';

interface ProjectSettingsModalProps {
  project: ProjectWithMembers;
  onClose: () => void;
}

export function ProjectSettingsModal({ project, onClose }: ProjectSettingsModalProps) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.projects.update(project.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      onClose();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update project');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (confirmation !== project.name || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await api.projects.remove(project.id);
      onClose();
      router.push('/dashboard');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to delete project');
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-settings-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="project-settings-title" className="text-lg font-semibold text-slate-900">
              Project settings
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Update project details or remove it from Arxion.
            </p>
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

        <form onSubmit={handleSave} className="mt-5">
          <label className="block text-sm font-medium text-slate-700">
            Project name
            <input
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Description <span className="font-normal text-slate-400">(optional)</span>
            <textarea
              maxLength={500}
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>

        <div className="mt-6 border-t border-red-100 pt-5">
          <h3 className="text-sm font-semibold text-red-700">Delete project</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            This permanently deletes the project, tasks, reviews, and coordination history from
            Arxion. It does not delete the connected GitHub repository.
          </p>
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Type <span className="font-semibold text-slate-900">{project.name}</span> to confirm
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-1 w-full rounded-md border border-red-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
          </label>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || confirmation !== project.name}
            className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting ? 'Deleting…' : 'Delete project'}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
      </div>
    </div>
  );
}
