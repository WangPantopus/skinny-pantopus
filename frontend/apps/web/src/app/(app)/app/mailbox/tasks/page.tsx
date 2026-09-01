'use client';

import { useState, useCallback, useMemo } from 'react';
import type { MailTask } from '@/types/mailbox';
import {
  useTasks,
  useCreateTaskFromMail,
  useUpdateTask,
  useEscalateTaskToGig,
} from '@/lib/mailbox-queries';
import { TaskCard, GigCreationModal } from '@/components/mailbox';

// ── Stub: home context ───────────────────────────────────────
function useHomeProfile() {
  return { homeId: 'home_1', address: 'Camas, WA' };
}

// ── Priority sort weight (high > medium > low) ──────────────
const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };

function sortTasks(tasks: MailTask[]): MailTask[] {
  const now = Date.now();
  return [...tasks].sort((a, b) => {
    // Within same priority, overdue tasks sort first
    const aPriority = PRIORITY_WEIGHT[a.priority] || 0;
    const bPriority = PRIORITY_WEIGHT[b.priority] || 0;
    if (aPriority !== bPriority) return bPriority - aPriority;

    const aOverdue = a.due_at ? new Date(a.due_at).getTime() < now : false;
    const bOverdue = b.due_at ? new Date(b.due_at).getTime() < now : false;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

    // Then by due date ascending
    if (a.due_at && b.due_at) {
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    }
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    return 0;
  });
}

// ── Task Creation Panel ──────────────────────────────────────

function TaskCreationPanel({
  homeId,
  mailId,
  mailTitle,
  mailDueDate,
  onCreated,
  onCancel,
  onGig,
}: {
  homeId: string;
  homeAddress: string;
  mailId?: string;
  mailTitle?: string;
  mailDueDate?: string;
  onCreated: () => void;
  onCancel: () => void;
  onGig: () => void;
}) {
  const [title, setTitle] = useState(mailTitle || '');
  const [dueAt, setDueAt] = useState(mailDueDate || '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [description, setDescription] = useState('');

  const createTask = useCreateTaskFromMail();

  const handleSubmit = useCallback(() => {
    if (!title.trim()) return;
    createTask.mutate(
      {
        mailId: mailId || '',
        homeId,
        title: title.trim(),
        dueAt: dueAt || undefined,
        priority,
        description: description.trim() || undefined,
      },
      { onSuccess: onCreated },
    );
  }, [title, dueAt, priority, description, mailId, homeId, createTask, onCreated]);

  return (
    <div className="h-full overflow-y-auto bg-app-surface p-6">
      <h2 className="text-base font-semibold text-app-text mb-4">
        New Task
      </h2>

      <div className="space-y-4 max-w-lg">
        {/* Title */}
        <div>
          <label className="text-xs text-app-text-secondary mb-1 block">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Due date */}
        <div>
          <label className="text-xs text-app-text-secondary mb-1 block">Due date</label>
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Priority */}
        <div>
          <label className="text-xs text-app-text-secondary mb-1 block">Priority</label>
          <div className="flex rounded-lg border border-app-border overflow-hidden">
            {(['low', 'medium', 'high'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  priority === p
                    ? p === 'high'
                      ? 'bg-red-500 text-white'
                      : p === 'medium'
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-500 text-white'
                    : 'bg-app-surface text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-700'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-app-text-secondary mb-1 block">Notes (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details..."
            rows={3}
            className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
          />
        </div>

        {/* Linked mail */}
        {mailId && (
          <div className="px-3 py-2 bg-app-surface-raised rounded-lg">
            <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-1">
              Linked Mail
            </p>
            <p className="text-sm text-app-text-secondary dark:text-app-text-muted">
              {mailTitle || mailId}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createTask.isPending || !title.trim()}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
              createTask.isPending || !title.trim()
                ? 'bg-app-surface-sunken text-app-text-muted cursor-not-allowed'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {createTask.isPending ? 'Creating...' : 'Create Task'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Gig alternative */}
        <div className="relative pt-4">
          <div className="absolute inset-x-0 top-4 flex items-center">
            <div className="flex-1 h-px bg-app-surface-sunken" />
            <span className="px-3 text-xs text-app-text-muted">or</span>
            <div className="flex-1 h-px bg-app-surface-sunken" />
          </div>
          <button
            type="button"
            onClick={onGig}
            className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
          >
            Post as Gig instead →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Task Detail Panel ────────────────────────────────────────

function TaskDetailPanel({
  task,
  onBack,
  onGig,
}: {
  task: MailTask;
  onBack: () => void;
  onGig: (task: MailTask) => void;
}) {
  const updateTask = useUpdateTask();
  const isOverdue = task.due_at ? new Date(task.due_at).getTime() < Date.now() : false;
  const isCompleted = task.status === 'completed';

  const [editTitle, setEditTitle] = useState(task.title);
  const [editDue, setEditDue] = useState(task.due_at?.split('T')[0] || '');
  const [editPriority, setEditPriority] = useState(task.priority);

  const handleSave = useCallback(() => {
    updateTask.mutate({
      taskId: task.id,
      updates: {
        title: editTitle.trim() || task.title,
        dueAt: editDue || undefined,
        priority: editPriority,
      },
    });
  }, [updateTask, task.id, task.title, editTitle, editDue, editPriority]);

  const handleComplete = useCallback(() => {
    updateTask.mutate({
      taskId: task.id,
      updates: { status: isCompleted ? 'pending' : 'completed' },
    });
  }, [updateTask, task.id, isCompleted]);

  const handlePostAsGig = useCallback(() => {
    onGig(task);
  }, [task, onGig]);

  return (
    <div className="h-full overflow-y-auto bg-app-surface">
      {/* Back (mobile) */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-app-border-subtle md:hidden">
        <button type="button" onClick={onBack} className="p-1 text-app-text-secondary hover:text-app-text-strong">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-medium text-app-text-strong">Back</span>
      </div>

      <div className="p-6 max-w-lg">
        {/* Complete toggle + title */}
        <div className="flex items-start gap-3 mb-6">
          <button
            type="button"
            onClick={handleComplete}
            className={`flex-shrink-0 mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
              isCompleted
                ? 'border-green-400 bg-green-400 text-white'
                : 'border-app-border hover:border-primary-400'
            }`}
          >
            {isCompleted && (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSave}
            className={`flex-1 text-lg font-semibold bg-transparent border-none outline-none ${
              isCompleted ? 'line-through text-app-text-muted' : 'text-app-text'
            }`}
          />
        </div>

        {/* Overdue warning */}
        {isOverdue && !isCompleted && (
          <div className="mb-4 px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-xs font-medium text-red-700 dark:text-red-400">
              This task is overdue
            </p>
          </div>
        )}

        {/* Fields */}
        <div className="space-y-4">
          {/* Due date */}
          <div>
            <label className="text-xs text-app-text-secondary mb-1 block">Due date</label>
            <input
              type="date"
              value={editDue}
              onChange={(e) => setEditDue(e.target.value)}
              onBlur={handleSave}
              className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs text-app-text-secondary mb-1 block">Priority</label>
            <div className="flex rounded-lg border border-app-border overflow-hidden">
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setEditPriority(p);
                    updateTask.mutate({ taskId: task.id, updates: { priority: p } });
                  }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    editPriority === p
                      ? p === 'high'
                        ? 'bg-red-500 text-white'
                        : p === 'medium'
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-500 text-white'
                      : 'bg-app-surface text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-700'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <label className="text-xs text-app-text-secondary mb-1 block">Notes</label>
              <p className="text-sm text-app-text-secondary dark:text-app-text-muted whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}

          {/* Linked mail */}
          {task.mail_id && (
            <div>
              <label className="text-xs text-app-text-secondary mb-1 block">Linked Mail</label>
              <a
                href={`/app/mailbox/home/${task.mail_id}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-app-surface-raised rounded-lg text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {task.mail_sender ? `From ${task.mail_sender}` : 'View mail item'}
              </a>
            </div>
          )}

          {/* Gig status or post as gig */}
          <div className="pt-4 border-t border-app-border-subtle">
            {task.converted_to_gig_id ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Gig posted
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300">
                  Active
                </span>
              </div>
            ) : !isCompleted ? (
              <button
                type="button"
                onClick={handlePostAsGig}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
              >
                Post as Gig
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function MailTasksPage() {
  const home = useHomeProfile();
  const { data: taskData, isLoading } = useTasks(home.homeId);
  const updateTask = useUpdateTask();
  const escalateGig = useEscalateTaskToGig();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showGigModal, setShowGigModal] = useState(false);
  const [gigTaskContext, setGigTaskContext] = useState<MailTask | null>(null);

  const activeTasks = useMemo(() => {
    if (!taskData?.active) return [];
    return sortTasks(taskData.active);
  }, [taskData]);

  const completedTasks = useMemo(() => {
    if (!taskData?.completed) return [];
    return taskData.completed;
  }, [taskData]);

  const selectedTask = useMemo(() => {
    if (!selectedId) return null;
    return [...(taskData?.active || []), ...(taskData?.completed || [])].find(
      t => t.id === selectedId,
    ) ?? null;
  }, [selectedId, taskData]);

  const handleComplete = useCallback((task: MailTask) => {
    updateTask.mutate({
      taskId: task.id,
      updates: { status: task.status === 'completed' ? 'pending' : 'completed' },
    });
  }, [updateTask]);

  const handleEscalate = useCallback((task: MailTask) => {
    setGigTaskContext(task);
    setShowGigModal(true);
  }, []);

  const handleGigCreated = useCallback(() => {
    setShowGigModal(false);
    setGigTaskContext(null);
  }, []);

  const isOverdue = (task: MailTask) =>
    task.due_at ? new Date(task.due_at).getTime() < Date.now() : false;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Task list ──────────────────────────────────── */}
      <div
        className={`flex flex-col h-full flex-shrink-0 border-r border-app-border bg-app-surface ${
          selectedId || showCreate ? 'hidden md:flex md:w-[360px]' : 'w-full md:w-[360px]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-app-border-subtle flex-shrink-0">
          <h1 className="text-base font-semibold text-app-text flex-1">
            Home Tasks
          </h1>
          <button
            type="button"
            onClick={() => { setSelectedId(null); setShowCreate(true); }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-primary-600 border border-primary-200 dark:border-primary-800 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New from mail
          </button>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 py-3 px-2">
                  <div className="w-5 h-5 rounded border-2 border-app-border animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-36 bg-app-surface-sunken rounded animate-pulse" />
                    <div className="h-2.5 w-20 bg-app-surface-sunken rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : activeTasks.length === 0 && completedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm text-app-text-secondary">No tasks yet</p>
              <p className="text-xs text-app-text-muted mt-1">Create a task from a mail item</p>
            </div>
          ) : (
            <div className="p-3 space-y-1.5">
              {/* Active section header */}
              {activeTasks.length > 0 && (
                <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider px-1 pt-1 pb-1">
                  Active ({activeTasks.length})
                </p>
              )}

              {/* Active tasks */}
              {activeTasks.map((task) => (
                <div
                  key={task.id}
                  className={`${
                    isOverdue(task) && task.priority === 'high'
                      ? 'ring-1 ring-red-200 dark:ring-red-800 rounded-lg'
                      : ''
                  } ${
                    selectedId === task.id ? 'ring-2 ring-primary-400 rounded-lg' : ''
                  }`}
                >
                  <TaskCard
                    task={task}
                    onClick={() => { setShowCreate(false); setSelectedId(task.id); }}
                    onComplete={() => handleComplete(task)}
                    onEscalate={() => handleEscalate(task)}
                  />
                </div>
              ))}

              {/* Completed section */}
              {completedTasks.length > 0 && (
                <>
                  <div className="flex items-center gap-3 pt-3 pb-1">
                    <div className="flex-1 h-px bg-app-surface-sunken" />
                    <span className="text-[10px] font-medium text-app-text-muted uppercase tracking-wider">
                      Completed ({completedTasks.length})
                    </span>
                    <div className="flex-1 h-px bg-app-surface-sunken" />
                  </div>
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className={selectedId === task.id ? 'ring-2 ring-primary-400 rounded-lg' : ''}
                    >
                      <TaskCard
                        task={task}
                        onClick={() => { setShowCreate(false); setSelectedId(task.id); }}
                        onComplete={() => handleComplete(task)}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Detail / Create panel ─────────────────────── */}
      <div
        className={`flex-1 min-w-0 overflow-hidden ${
          selectedId || showCreate ? '' : 'hidden md:block'
        }`}
      >
        {showCreate ? (
          <TaskCreationPanel
            homeId={home.homeId}
            homeAddress={home.address}
            onCreated={() => setShowCreate(false)}
            onCancel={() => setShowCreate(false)}
            onGig={() => {
              setShowCreate(false);
              setShowGigModal(true);
            }}
          />
        ) : selectedTask ? (
          <TaskDetailPanel
            task={selectedTask}
            onBack={() => setSelectedId(null)}
            onGig={handleEscalate}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-4">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm text-app-text-secondary">Select a task or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Gig Creation Modal ───────────────────────────────── */}
      {showGigModal && (
        <GigCreationModal
          source="post_delivery"
          packageTitle={gigTaskContext?.title || 'Home task'}
          packageDescription={gigTaskContext?.description}
          homeAddress={home.address}
          onGigCreated={() => {
            if (gigTaskContext) {
              escalateGig.mutate({ taskId: gigTaskContext.id });
            }
            handleGigCreated();
          }}
          onClose={() => { setShowGigModal(false); setGigTaskContext(null); }}
          createGig={async (data) => {
            if (gigTaskContext) {
              const result = await new Promise<{ gigId: string }>((resolve) => {
                escalateGig.mutate(
                  {
                    taskId: gigTaskContext.id,
                    data: {
                      title: data.title,
                      description: data.description,
                      compensation: data.compensation,
                    },
                  },
                  { onSuccess: (r) => resolve({ gigId: r.gig_id }) },
                );
              });
              return result;
            }
            return { gigId: 'new' };
          }}
        />
      )}
    </div>
  );
}
