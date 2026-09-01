'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, CheckCircle2, Circle, Clock, Trash2, Repeat } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

type TaskTab = 'active' | 'completed' | 'recurring';
const PRIORITY_COLOR: Record<string, string> = { high: '#dc2626', medium: '#f59e0b', low: '#16a34a' };

function TasksContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TaskTab>('active');
  const [showCreate, setShowCreate] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchTasks = useCallback(async () => {
    if (!homeId) return;
    try {
      const res = await api.homeProfile.getHomeTasks(homeId);
      setTasks((res as any)?.tasks || []);
    } catch { toast.error('Failed to load tasks'); }
  }, [homeId]);

  useEffect(() => { setLoading(true); fetchTasks().finally(() => setLoading(false)); }, [fetchTasks]);

  const activeTasks = tasks.filter((t) => t.status === 'open' || t.status === 'in_progress');
  const completedTasks = tasks.filter((t) => t.status === 'done' || t.status === 'completed');
  const recurringTasks = tasks.filter((t) => t.task_type === 'recurring' || t.is_recurring);
  const currentList = tab === 'active' ? activeTasks : tab === 'completed' ? completedTasks : recurringTasks;

  const toggleStatus = useCallback(async (task: any) => {
    const next = task.status === 'done' || task.status === 'completed' ? 'open' : 'done';
    try {
      await api.homeProfile.updateHomeTask(homeId!, task.id, { status: next });
      await fetchTasks();
    } catch { toast.error('Failed to update task'); }
  }, [homeId, fetchTasks]);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await api.homeProfile.createHomeTask(homeId!, {
        task_type: 'general',
        title: newTitle.trim(),
        description: newDesc.trim(),
        priority: newPriority,
      });
      setNewTitle(''); setNewDesc(''); setShowCreate(false);
      toast.success('Task created');
      await fetchTasks();
    } catch (err: any) { toast.error(err?.message || 'Failed to create task'); }
    finally { setCreating(false); }
  }, [homeId, newTitle, newDesc, newPriority, fetchTasks]);

  const handleDelete = useCallback(async (taskId: string) => {
    const yes = await confirmStore.open({ title: 'Delete Task', description: 'Are you sure?', confirmLabel: 'Delete', variant: 'destructive' });
    if (!yes) return;
    try { await api.homeProfile.deleteHomeTask(homeId!, taskId); toast.success('Task deleted'); await fetchTasks(); }
    catch { toast.error('Failed to delete task'); }
  }, [homeId, fetchTasks]);

  const TABS: { key: TaskTab; label: string; count: number }[] = [
    { key: 'active', label: 'Active', count: activeTasks.length },
    { key: 'completed', label: 'Done', count: completedTasks.length },
    { key: 'recurring', label: 'Recurring', count: recurringTasks.length },
  ];

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
          <h1 className="text-xl font-bold text-app-text">Tasks</h1>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition">
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      {showCreate && (
        <div className="bg-app-surface border border-app-border rounded-xl p-4 mb-4 space-y-3">
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Task title" className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as const).map((p) => (
              <button key={p} type="button" onClick={() => setNewPriority(p)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium capitalize transition ${newPriority === p ? 'border-current' : 'border-app-border text-app-text-secondary'}`}
                style={newPriority === p ? { color: PRIORITY_COLOR[p], backgroundColor: PRIORITY_COLOR[p] + '12', borderColor: PRIORITY_COLOR[p] } : undefined}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PRIORITY_COLOR[p] }} />{p}
              </button>
            ))}
          </div>
          <button onClick={handleCreate} disabled={creating || !newTitle.trim()} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition">
            {creating ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      )}

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
            const done = task.status === 'done' || task.status === 'completed';
            const inProgress = task.status === 'in_progress';
            return (
              <div key={task.id} className="flex items-start gap-3 bg-app-surface border border-app-border rounded-xl p-4">
                <button onClick={() => toggleStatus(task)} className="mt-0.5 flex-shrink-0">
                  {done ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : inProgress ? <Clock className="w-5 h-5 text-amber-500" /> : <Circle className="w-5 h-5 text-gray-300" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${done ? 'line-through text-app-text-muted' : 'text-app-text'}`}>{task.title}</p>
                  {task.description && <p className="text-xs text-app-text-secondary mt-1 line-clamp-2">{task.description}</p>}
                  <div className="flex items-center gap-2 mt-1.5">
                    {task.priority && (
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded" style={{ color: PRIORITY_COLOR[task.priority] || '#6b7280', backgroundColor: (PRIORITY_COLOR[task.priority] || '#6b7280') + '15' }}>
                        {task.priority}
                      </span>
                    )}
                    {task.due_at && <span className="text-xs text-amber-500">Due {new Date(task.due_at).toLocaleDateString()}</span>}
                    {task.is_recurring && <Repeat className="w-3 h-3 text-app-text-secondary" />}
                  </div>
                </div>
                <button onClick={() => handleDelete(task.id)} className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0">
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
