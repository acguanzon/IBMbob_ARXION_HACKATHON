'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { TaskWithRelations } from '@arxion/types';
import { api, type LaunchRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface AgentDockProps {
  projectId: string;
  /** Task that was dragged onto the dock. Controlled externally. */
  droppedTask: TaskWithRelations | null;
  /** Called when the dock wants to clear the dropped task (cancel / dismiss). */
  onClear: () => void;
}

const AGENT_TYPES = [
  { value: 'IBM_BOB', label: 'IBM Bob' },
  { value: 'CURSOR', label: 'Cursor' },
  { value: 'CLAUDE_CODE', label: 'Claude Code' },
] as const;

type AgentTypeValue = (typeof AGENT_TYPES)[number]['value'];

const COPY_TEMPLATE = (displayId: string) =>
  `Work on Arxion task ${displayId}. Accept my pending launch request and retrieve the current context package.`;

export function AgentDock({ projectId, droppedTask, onClear }: AgentDockProps) {
  const { user } = useAuth();
  const [agentType, setAgentType] = useState<AgentTypeValue>('IBM_BOB');
  const [pendingRequest, setPendingRequest] = useState<LaunchRequest | null>(null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { setNodeRef, isOver } = useDroppable({ id: 'agent-dock' });

  // Clear the pending request when droppedTask is cleared externally
  useEffect(() => {
    if (!droppedTask) {
      setPendingRequest(null);
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [droppedTask]);

  // Poll for accepted launch requests
  const startPolling = useCallback(
    (requestId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const requests = await api.launch.listByProject(projectId);
          const req = requests.find((r) => r.id === requestId);
          if (req?.status === 'ACCEPTED') {
            setPendingRequest(req);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch {
          // non-fatal
        }
      }, 3000);
    },
    [projectId],
  );

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleLaunch(task: TaskWithRelations) {
    if (!user) {
      setError('You must be logged in to launch an agent.');
      return;
    }
    setError(null);
    setLaunching(true);
    try {
      const req = await api.launch.request(projectId, task.id, {
        agentType,
        userId: user.id,
      });
      setPendingRequest(req);
      startPolling(req.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch agent');
    } finally {
      setLaunching(false);
    }
  }

  async function handleCancel() {
    if (pendingRequest) {
      try {
        await api.launch.cancel(pendingRequest.id);
      } catch {
        // non-fatal
      }
    }
    onClear();
    if (pollRef.current) clearInterval(pollRef.current);
  }

  function handleCopy() {
    if (!droppedTask) return;
    const text = COPY_TEMPLATE(droppedTask.displayId);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isAccepted = pendingRequest?.status === 'ACCEPTED';
  const isPending = pendingRequest?.status === 'PENDING';

  if (minimised) {
    return (
      <button
        onClick={() => setMinimised(false)}
        className="fixed bottom-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg hover:bg-slate-700"
        title="Open Agent Dock"
      >
        🤖
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 z-30 w-72 rounded-tl-xl border-l border-t border-slate-200 bg-white shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-base">🤖</span>
          <span className="text-xs font-semibold text-slate-700">Agent Dock</span>
          {isAccepted && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">
              WORKING
            </span>
          )}
          {isPending && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 animate-pulse">
              Waiting…
            </span>
          )}
        </div>
        <button
          onClick={() => setMinimised(true)}
          className="text-slate-400 hover:text-slate-600"
          aria-label="Minimise dock"
        >
          ─
        </button>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Agent type selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 shrink-0">Agent:</span>
          <select
            value={agentType}
            onChange={(e) => setAgentType(e.target.value as AgentTypeValue)}
            className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:border-blue-400 focus:outline-none"
          >
            {AGENT_TYPES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        {/* Drop zone */}
        {!droppedTask ? (
          <div
            ref={setNodeRef}
            className={`flex h-16 items-center justify-center rounded-lg border-2 border-dashed text-xs transition-colors ${
              isOver
                ? 'border-blue-400 bg-blue-50 text-blue-600'
                : 'border-slate-200 text-slate-400'
            }`}
          >
            {isOver ? 'Drop to launch agent' : 'Drag a task here to launch agent'}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-xs text-slate-400">{droppedTask.displayId}</p>
                <p className="truncate text-xs font-medium text-slate-700">{droppedTask.title}</p>
              </div>
              <button
                onClick={handleCancel}
                className="shrink-0 text-slate-400 hover:text-red-500 text-xs"
              >
                ✕
              </button>
            </div>

            {/* State display */}
            {isPending && (
              <p className="mt-1.5 text-xs text-amber-600">
                ⏳ Waiting for agent to accept…
              </p>
            )}
            {isAccepted && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Agent working on this task
              </p>
            )}

            {/* Launch button (before request) */}
            {!pendingRequest && (
              <button
                onClick={() => handleLaunch(droppedTask)}
                disabled={launching}
                className="mt-2 w-full rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {launching ? 'Launching…' : `Launch ${AGENT_TYPES.find((a) => a.value === agentType)?.label}`}
              </button>
            )}

            {/* Copy fallback */}
            {pendingRequest && (
              <button
                onClick={handleCopy}
                className="mt-2 w-full rounded-md bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
              >
                {copied ? '✓ Copied!' : '📋 Copy launch instruction'}
              </button>
            )}
          </div>
        )}

        {error && (
          <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
}
