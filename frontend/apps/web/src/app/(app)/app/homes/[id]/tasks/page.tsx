'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, CheckCircle2, Circle, Clock, Trash2, Repeat } from 'lucide-react';
import TaskSlidePanel from '@/components/home/TaskSlidePanel';
import { useHomeTaskCollection } from '@/components/home/tasks/useHomeTaskCollection';
import { recurrenceStatusText, type HomeTask } from '@/components/home/tasks/homeTaskModel';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

type TaskTab = 'active' | 'completed' | 'recurring';
const PRIORITY_COLOR: Record<string, string> = { high: '#dc2626', medium: '#f59e0b', low: '#16a34a' };

function TasksContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const collection = useHomeTaskCollection(homeId);
  const { tasks, loading } = collection;
  const [tab, setTab] = useState<TaskTab>('active');
  const [panel, setPanel] = useState<{ open: boolean; task: HomeTask | null }>({ open: false, task: null });
  const action = useRef(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (collection.retired) setPanel({ open: false, task: null }); }, [collection.retired]);
  const activeTasks = tasks.filter(task => task.status === 'open' || task.status === 'in_progress');
  const completedTasks = tasks.filter(task => task.status === 'done');
  const recurringTasks = tasks.filter(task => !!task.automatic_recurrence || !!task.recurrence_rule);
  const currentList = tab === 'active' ? activeTasks : tab === 'completed' ? completedTasks : recurringTasks;
  const mutate = async (task: HomeTask, remove: boolean) => {
    if (action.current) return;
    action.current = true; setBusy(true);
    try {
      const client = collection.current(); const revision = client.revision;
      if (remove) {
        const yes = await confirmStore.open({ title: 'Delete this task?', confirmLabel: 'Delete', variant: 'destructive' });
        if (!yes) return;
        client.requireCurrent(revision);
        if (collection.current() !== client) return;
        await client.delete(task.id);
      } else await client.edit(task.id, { status: task.status === 'done' ? 'open' : 'done' });
      client.requireCurrent(revision);
      if (collection.current() === client) collection.reload();
    } catch (failure) { toast.error(failure instanceof Error ? failure.message : 'The task request was not confirmed. Reload before retrying.'); }
    finally { action.current = false; setBusy(false); }
  };

  const TABS: { key: TaskTab; label: string; count: number }[] = [
    { key: 'active', label: 'Active', count: activeTasks.length },
    { key: 'completed', label: 'Done', count: completedTasks.length },
    { key: 'recurring', label: 'Recurring', count: recurringTasks.length },
  ];

  if (loading && !panel.open) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
          <h1 className="text-xl font-bold text-app-text">Tasks</h1>
        </div>
        <button disabled={!collection.canCreate || busy} onClick={() => setPanel({ open: true, task: null })} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition">
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      <TaskSlidePanel open={panel.open} onClose={() => setPanel({ open: false, task: null })}
        onSaved={collection.saved} task={panel.task} homeId={homeId} members={collection.members} openingScope={collection.scope} />
      {collection.retired && <p role="alert">Your account changed. Refresh the page to load current tasks.</p>}
      {collection.error && <p role="alert">{collection.error} <button type="button" onClick={collection.reload}>Reload tasks</button></p>}

      <div className="flex border-b border-app-border mb-4">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2.5 text-sm font-medium transition ${tab === t.key ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-app-text-secondary hover:text-app-text'}`}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {currentList.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-10 h-10 mx-auto text-app-text-muted mb-3" />
          <p className="text-sm text-app-text-secondary">{tab === 'active' ? 'No active tasks' : tab === 'completed' ? 'No completed tasks' : 'No recurring tasks'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {currentList.map((task) => {
            const done = task.status === 'done';
            const inProgress = task.status === 'in_progress';
            return (
              <div key={task.id} className="flex items-start gap-3 bg-app-surface border border-app-border rounded-xl p-4">
                <button aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`} disabled={busy || task.capabilities?.can_complete !== true} onClick={() => void mutate(task, false)} className="mt-0.5 flex-shrink-0">
                  {done ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : inProgress ? <Clock className="w-5 h-5 text-amber-500" /> : <Circle className="w-5 h-5 text-gray-300" />}
                </button>
                <div className="flex-1 min-w-0">
                  <button type="button" onClick={() => setPanel({ open: true, task })} className={`text-left text-sm font-medium ${done ? 'line-through text-app-text-muted' : 'text-app-text'}`}>{task.title}</button>
                  {task.description && <p className="text-xs text-app-text-secondary mt-1 line-clamp-2">{task.description}</p>}
                  <div className="flex items-center gap-2 mt-1.5">
                    {task.priority && (
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded" style={{ color: PRIORITY_COLOR[task.priority] || '#6b7280', backgroundColor: (PRIORITY_COLOR[task.priority] || '#6b7280') + '15' }}>
                        {task.priority}
                      </span>
                    )}
                    {task.due_at && <span className="text-xs text-amber-500">Due {new Date(task.due_at).toLocaleDateString()}</span>}
                    {(task.automatic_recurrence || task.recurrence_rule) && <Repeat aria-hidden="true" className="w-3 h-3 text-app-text-secondary" />}
                  </div>
                  {recurrenceStatusText(task.automatic_recurrence, task.recurrence_rule) && <p className="mt-1 text-xs text-app-text-secondary">{recurrenceStatusText(task.automatic_recurrence, task.recurrence_rule)}</p>}
                </div>
                <button aria-label={`Delete ${task.title}`} disabled={busy || task.capabilities?.can_delete !== true} onClick={() => void mutate(task, true)} className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TasksPage() { return <Suspense><TasksContent /></Suspense>; }
