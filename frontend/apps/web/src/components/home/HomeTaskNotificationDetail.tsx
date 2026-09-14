'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as api from '@pantopus/api';
import TaskAttachmentList from './TaskAttachmentList';
import { recurrenceStatusText, validAutomaticTaskRecurrence, type AutomaticTaskRecurrence } from './tasks/homeTaskModel';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses: Record<string, string> = { open: 'Open', in_progress: 'In progress', done: 'Done', canceled: 'Canceled' };
type Task = { id: string; home_id: string; title: string; status: string; description?: string | null;
  due_at?: string | null; task_type?: string; recurrence_rule?: string | null; automatic_recurrence?: AutomaticTaskRecurrence | null };
type Response = { task: Task; task_session: api.HomeTaskSessionScope };
const ignoreAttachmentAccess = (_allowed: boolean) => {};

/** A notification identifies a task; only a new authorized read exposes its content. */
export default function HomeTaskNotificationDetail({ homeId, taskId }: { homeId: string; taskId: string }) {
  const [task, setTask] = useState<Task | null>(null);
  const [scope, setScope] = useState<api.HomeTaskSessionScope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retired, setRetired] = useState(false);
  const reload = useRef<() => void>(() => {});
  const latest = useRef({ homeId, taskId }); latest.current = { homeId, taskId };

  useEffect(() => {
    setTask(null); setScope(null); setError(''); setRetired(false); setLoading(true);
    let mounted = true;
    let invalidated = false;
    let generation = 0;
    let working = false;
    let pendingReload = false;
    let actorId: string | null = null;
    let bound: api.HomeTaskSessionScope | null = null;
    const token = api.getAuthToken();
    const origin = api.getApiBaseUrl();
    let marker: string | null | undefined;
    try { marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY); } catch { /* A missing storage proof retires this view. */ }
    const retire = () => {
      invalidated = true; generation++;
      if (mounted) { setTask(null); setScope(null); setLoading(false); setRetired(true); setError(''); }
    };
    const current = () => {
      if (!mounted || invalidated) return false;
      try {
        if (!token || marker === undefined || api.getAuthToken() !== token || api.getApiBaseUrl() !== origin
          || localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) !== marker
          || latest.current.homeId !== homeId || latest.current.taskId !== taskId) {
          retire(); return false;
        }
      } catch { retire(); return false; }
      return true;
    };
    const visible = () => document.visibilityState !== 'hidden';
    const active = (ticket: number) => current() && ticket === generation && visible();
    const load = async () => {
      if (working || !visible() || !current()) return;
      if (!uuid.test(homeId) || !uuid.test(taskId)) {
        setTask(null); setLoading(false); setError('This task link is invalid.'); return;
      }
      const ticket = ++generation;
      working = true; setTask(null); setScope(null); setLoading(true); setError('');
      try {
        if (!actorId) {
          const profile = await api.users.getMyProfile();
          if (!active(ticket)) return;
          if (!uuid.test(profile.id)) throw new Error('Invalid current account');
          actorId = profile.id;
        }
        const result = await api.get<Response>(`/api/homes/${homeId}/tasks/${taskId}`, undefined,
          { headers: api.taskSessionHeaders(bound || undefined) });
        if (!active(ticket)) return;
        const proof = result.task_session;
        if (!proof || proof.actor_id !== actorId || proof.home_id !== homeId || !/^[a-f0-9]{64}$/.test(proof.session_scope)
          || (bound && proof.session_scope !== bound.session_scope)) { retire(); return; }
        if (!result.task || result.task.id !== taskId || result.task.home_id !== homeId
          || !validAutomaticTaskRecurrence(result.task.automatic_recurrence)
          || typeof result.task.title !== 'string' || !result.task.title.trim()
          || ['description', 'due_at', 'recurrence_rule'].some(key => {
            const value = result.task[key as keyof Task];
            return value != null && typeof value !== 'string';
          })
          || !Object.hasOwn(statuses, result.task.status)) throw new Error('Invalid task response');
        bound = { ...proof };
        setTask(result.task); setScope(bound);
      } catch (failure) {
        if (!active(ticket)) return;
        const response = failure as { statusCode?: number; code?: string; data?: { code?: string } };
        if (response?.statusCode === 401 || response?.code === 'SESSION_SCOPE_CHANGED' || response?.data?.code === 'SESSION_SCOPE_CHANGED') retire();
        else {
          setTask(null); setScope(null);
          setError(response?.statusCode === 403 || response?.statusCode === 404
            ? 'This task is unavailable or your access has changed.' : 'This task could not be loaded. Try again.');
        }
      } finally {
        working = false;
        if (mounted && !invalidated && ticket === generation) setLoading(false);
        if (pendingReload && mounted && !invalidated && visible()) {
          pendingReload = false;
          void load();
        }
      }
    };
    reload.current = () => { void load(); };
    const visibility = () => {
      if (document.visibilityState === 'hidden') {
        generation++; setTask(null); setScope(null); setLoading(false);
      } else if (working) pendingReload = true;
      else void load();
    };
    const sessionChanged = (event: StorageEvent) => {
      if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) retire();
    };
    const unsubscribe = api.onTokenChange(retire);
    window.addEventListener('storage', sessionChanged);
    document.addEventListener('visibilitychange', visibility);
    void load();
    return () => {
      mounted = false; generation++;
      unsubscribe();
      window.removeEventListener('storage', sessionChanged);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [homeId, taskId]);

  const retry = useCallback(() => reload.current(), []);
  const dueDate = task?.due_at ? new Date(task.due_at) : null;
  return <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
    <Link href={uuid.test(homeId) ? `/app/homes/${homeId}/dashboard?tab=tasks` : '/app/notifications'}
      className="text-sm text-app-text-secondary underline">Back to Home tasks</Link>
    {retired ? <section role="alert" className="rounded-xl border border-app-border p-5">
      <p>Your signed-in session changed. Reload this task to continue.</p>
      <button type="button" className="mt-3 underline" onClick={() => window.location.reload()}>Reload task</button>
    </section> : <>
      {loading && <p role="status">Loading task…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !task && <button type="button" className="rounded-lg border border-app-border px-4 py-2" onClick={retry}>Retry task</button>}
      {task && scope && <>
        <section aria-label="Home task details" className="space-y-4 rounded-2xl border border-app-border bg-app-surface p-6">
          <div className="flex items-start justify-between gap-4">
            <h1 className="break-words text-2xl font-semibold">{task.title}</h1>
            <span className="shrink-0 rounded-full border border-app-border px-3 py-1 text-sm">{statuses[task.status]}</span>
          </div>
          {task.description && <p className="whitespace-pre-wrap break-words">{task.description}</p>}
          {dueDate && Number.isFinite(dueDate.getTime()) && <p className="text-sm text-app-text-secondary">Due {dueDate.toLocaleString()}</p>}
          {recurrenceStatusText(task.automatic_recurrence, task.recurrence_rule) && <p className="text-sm text-app-text-secondary">{recurrenceStatusText(task.automatic_recurrence, task.recurrence_rule)}</p>}
        </section>
        <TaskAttachmentList key={`${homeId}:${taskId}:${scope.session_scope}`} homeId={homeId} taskId={taskId}
          openingScope={scope} onAccess={ignoreAttachmentAccess} />
      </>}
    </>}
  </main>;
}
