'use client';

import { useState, useCallback } from 'react';
import type { TaskWithRelations, TaskStatus } from '@arxion/types';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from '@/components/kanban/TaskCard';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import { ReviewRequestModal } from '@/components/tasks/ReviewRequestModal';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface KanbanBoardProps {
  tasks: TaskWithRelations[];
  projectId: string;
  taskMeta?: Record<string, { activeFiles: number; contractRisks: number }>;
}

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'BACKLOG', label: 'Backlog', color: 'bg-slate-100 text-slate-600' },
  { status: 'TODO', label: 'To Do', color: 'bg-blue-100 text-blue-700' },
  { status: 'IN_PROGRESS', label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  { status: 'REVIEW', label: 'Review', color: 'bg-purple-100 text-purple-700' },
  { status: 'DONE', label: 'Done', color: 'bg-emerald-100 text-emerald-700' },
];

export function KanbanBoard({ tasks: initialTasks, projectId, taskMeta = {} }: KanbanBoardProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskWithRelations[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<TaskWithRelations | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [reviewTask, setReviewTask] = useState<TaskWithRelations | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function showToast(message: string, type: 'error' | 'info' = 'info') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id);
      if (task) setActiveTask(task);
    },
    [tasks],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over) return;

      const taskId = active.id as string;
      const targetStatus = over.id as TaskStatus;

      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === targetStatus) return;

      // ── Transition guards ──────────────────────────────────────────────────
      if (targetStatus === 'DONE') {
        showToast('Use the review approval flow to complete a task.', 'info');
        return;
      }

      if (task.status === 'IN_PROGRESS' && targetStatus === 'REVIEW') {
        setReviewTask(task);
        return;
      }

      // ── Optimistic update ──────────────────────────────────────────────────
      const prev = tasks.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t));
      setTasks(prev);

      try {
        if (targetStatus === 'IN_PROGRESS' && task.status === 'TODO' && user) {
          // Claim the task on TODO → IN_PROGRESS
          await api.tasks.claim(projectId, taskId, user.id);
        } else {
          await api.tasks.update(taskId, { status: targetStatus });
        }
      } catch (err) {
        // Rollback
        setTasks(tasks);
        showToast(
          err instanceof Error ? err.message : 'Failed to update task status.',
          'error',
        );
      }
    },
    [tasks, projectId, user],
  );

  function openDrawer(task: TaskWithRelations) {
    setSelectedTask(task);
    setDrawerOpen(true);
  }

  function handleTaskCreated(task: TaskWithRelations) {
    setTasks((prev) => [...prev, task]);
  }

  function handleTaskUpdated(updated: TaskWithRelations) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  const tasksByStatus = Object.fromEntries(
    COLUMNS.map((col) => [col.status, tasks.filter((t) => t.status === col.status)]),
  ) as Record<TaskStatus, TaskWithRelations[]>;

  return (
    <>
      {/* Board header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Task Board</h2>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          + New Task
        </button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex h-[calc(100vh-10rem)] gap-3 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const colTasks = tasksByStatus[col.status] ?? [];
            return (
              <DroppableColumn
                key={col.status}
                col={col}
                tasks={colTasks}
                taskMeta={taskMeta}
                onCardClick={openDrawer}
                onTaskUpdated={handleTaskUpdated}
              />
            );
          })}
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeTask ? (
            <div className="opacity-90 rotate-1 shadow-lg">
              <TaskCard
                task={activeTask}
                meta={taskMeta[activeTask.id]}
                onClick={() => undefined}
                onTaskUpdated={handleTaskUpdated}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-medium shadow-lg ${
            toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Task Detail Drawer */}
      {drawerOpen && selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          projectId={projectId}
          onClose={() => setDrawerOpen(false)}
          onTaskUpdated={handleTaskUpdated}
        />
      )}

      {/* Create Modal */}
      {createModalOpen && (
        <TaskFormModal
          projectId={projectId}
          onClose={() => setCreateModalOpen(false)}
          onSaved={handleTaskCreated}
        />
      )}

      {/* Review Request Modal */}
      {reviewTask && (
        <ReviewRequestModal
          task={reviewTask}
          onClose={() => setReviewTask(null)}
          onConfirmed={(updated) => {
            handleTaskUpdated(updated);
            setReviewTask(null);
          }}
        />
      )}
    </>
  );
}

// ── Droppable Column ──────────────────────────────────────────────────────────

import { useDroppable } from '@dnd-kit/core';

interface DroppableColumnProps {
  col: (typeof COLUMNS)[number];
  tasks: TaskWithRelations[];
  taskMeta: Record<string, { activeFiles: number; contractRisks: number }>;
  onCardClick: (task: TaskWithRelations) => void;
  onTaskUpdated: (task: TaskWithRelations) => void;
}

function DroppableColumn({ col, tasks, taskMeta, onCardClick, onTaskUpdated }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: col.status });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-64 shrink-0 flex-col rounded-lg border transition-colors ${
        isOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${col.color}`}>
          {col.label}
        </span>
        <span className="text-xs text-slate-400">{tasks.length}</span>
      </div>

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              meta={taskMeta[task.id]}
              onClick={onCardClick}
              onTaskUpdated={onTaskUpdated}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="py-6 text-center text-xs text-slate-300">Drop here</div>
        )}
      </div>
    </div>
  );
}
