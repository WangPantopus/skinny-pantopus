'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { HomeTaskClient } from './HomeTaskClient';
import { HomeTaskCreationController } from './HomeTaskCreationController';
import type { HomeTask, HomeTaskFields, HomeTaskPatch, RetainedTaskCreate } from './homeTaskModel';

export type TaskFormValues = { taskType: string; title: string; description: string; assignedTo: string;
  priority: string; status: string; dueAt: string; budget: string };
const isHidden = () => document.visibilityState === 'hidden';
const empty: TaskFormValues = { taskType: 'chore', title: '', description: '', assignedTo: '', priority: 'medium', status: 'open', dueAt: '', budget: '' };
function values(task: HomeTaskFields & { status?: string }): TaskFormValues {
  return { taskType: task.task_type, title: task.title, description: task.description || '', assignedTo: task.assigned_to || '',
    priority: task.priority, status: task.status || 'open', dueAt: task.due_at?.slice(0, 10) || '', budget: task.budget == null ? '' : String(task.budget) };
}
function payload(form: TaskFormValues): HomeTaskFields {
  return { task_type: form.taskType as HomeTask['task_type'], title: form.title.trim(), description: form.description.trim() || null,
    assigned_to: form.assignedTo || null, priority: form.priority as HomeTask['priority'],
    due_at: form.dueAt ? new Date(`${form.dueAt}T00:00:00.000Z`).toISOString() : null, budget: form.budget === '' ? null : Number(form.budget) };
}
function patch(form: TaskFormValues, initial: TaskFormValues): HomeTaskPatch {
  const next = { ...payload(form), status: form.status as HomeTask['status'] };
  const mapping = { taskType: 'task_type', title: 'title', description: 'description', assignedTo: 'assigned_to',
    priority: 'priority', status: 'status', dueAt: 'due_at', budget: 'budget' } as const;
  return Object.fromEntries(Object.entries(mapping).filter(([field]) => form[field as keyof TaskFormValues] !== initial[field as keyof TaskFormValues])
    .map(([, field]) => [field, next[field]]));
}
interface FormContext {
  client: HomeTaskClient; active: boolean; loadedRevision?: number; task: HomeTask | null;
  creation: HomeTaskCreationController | null; retire: () => void;
}

/** Lifecycle and current values shared by the existing browser task form. */
export function useHomeTaskForm(open: boolean, homeId: string | undefined, taskId: string | undefined,
  openingScope: api.HomeTaskSessionScope | null) {
  const [fields, setFields] = useState<TaskFormValues>(empty);
  const fieldRef = useRef(fields); fieldRef.current = fields;
  const initial = useRef<TaskFormValues>(empty);
  const context = useRef<FormContext | null>(null);
  const [task, setTask] = useState<HomeTask | null>(null);
  const [pending, setPending] = useState<RetainedTaskCreate | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retired, setRetired] = useState(false);
  const [, refreshControllerState] = useState(0);
  const reload = useRef<() => void>(() => {});
  const opening = useRef(openingScope); opening.current = openingScope;

  useEffect(() => {
    setReady(false); setTask(null); setPending(null); setError(''); setRetired(false);
    setFields(empty); initial.current = empty; fieldRef.current = empty;
    if (!open || !homeId) { setLoading(false); return; }
    const client = new HomeTaskClient(homeId, opening.current);
    const ctx: FormContext = { client, active: true, task: null, creation: null, retire: () => {} };
    context.current = ctx;
    let working = false;
    let queued = false;
    let populated = false;
    ctx.retire = () => {
      client.retire(); ctx.active = false;
      if (context.current === ctx) {
        setReady(false); setLoading(false); setRetired(true); setTask(null); setPending(null);
        setFields(empty); fieldRef.current = empty; setError('');
      }
    };
    const current = (revision: number) => {
      if (context.current !== ctx || !ctx.active || document.visibilityState === 'hidden') return false;
      try { client.requireCurrent(revision); return true; } catch { return false; }
    };
    const load = async () => {
      if (!ctx.active || document.visibilityState === 'hidden') return;
      if (working) { queued = true; return; }
      working = true; ctx.loadedRevision = undefined;
      const revision = client.revision;
      setReady(false); setLoading(true); setError(''); setTask(null);
      try {
        let fresh: TaskFormValues;
        const exactId = ctx.task?.id || taskId;
        if (exactId) {
          const result = await client.detail(exactId, revision);
          if (!current(revision)) return;
          ctx.task = result; setTask(result); fresh = values(result);
        } else {
          if (!ctx.creation) {
            const controller = await HomeTaskCreationController.open(client);
            if (!current(revision)) return;
            ctx.creation = controller;
          } else {
            await client.list(revision); await ctx.creation.reload();
          }
          if (!current(revision)) return;
          const saved = ctx.creation.pending;
          setPending(saved); fresh = saved ? values(saved.payload) : empty;
        }
        const previous = fieldRef.current;
        const next = populated && !ctx.creation?.pending
          ? Object.fromEntries(Object.keys(fresh).map(key => {
            const field = key as keyof TaskFormValues;
            return [field, previous[field] !== initial.current[field] ? previous[field] : fresh[field]];
          })) as TaskFormValues : fresh;
        initial.current = fresh; fieldRef.current = next; setFields(next);
        populated = true; ctx.loadedRevision = revision; setReady(true);
      } catch (failure) {
        if (context.current !== ctx || !ctx.active) return;
        try { client.requireCurrent(); } catch { ctx.retire(); return; }
        if (current(revision)) setError(failure instanceof Error ? failure.message : 'Current task access could not be checked. Retry.');
      } finally {
        working = false;
        if (context.current === ctx && ctx.active && revision === client.revision) setLoading(false);
        if (queued && ctx.active && !isHidden()) { queued = false; void load(); }
      }
    };
    reload.current = () => { void load(); };
    const visibility = () => {
      if (document.visibilityState === 'hidden') {
        client.invalidatePending(); setReady(false); setLoading(false); setTask(null); setPending(null);
      } else void load();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) ctx.retire();
    };
    const unsubscribe = api.onTokenChange(ctx.retire);
    window.addEventListener('storage', storage); document.addEventListener('visibilitychange', visibility);
    void load();
    return () => {
      ctx.active = false; client.retire(); unsubscribe();
      window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', visibility);
      if (context.current === ctx) { context.current = null; reload.current = () => {}; }
    };
  }, [open, homeId, taskId]);

  useEffect(() => {
    const ctx = context.current;
    const scope = ctx?.client.currentScope;
    const next = opening.current;
    if (ctx && scope && next && (scope.home_id !== next.home_id
      || scope.actor_id !== next.actor_id || scope.session_scope !== next.session_scope)) ctx.retire();
  }, [openingScope?.actor_id, openingScope?.home_id, openingScope?.session_scope]);

  const requireReady = useCallback(() => {
    const ctx = context.current;
    if (!ctx?.active || document.visibilityState === 'hidden' || ctx.loadedRevision !== ctx.client.revision) throw new Error('Wait for current task access before continuing.');
    ctx.client.requireCurrent();
    return ctx;
  }, []);
  const change = useCallback((field: keyof TaskFormValues, value: string) => {
    let ctx: FormContext;
    try { ctx = requireReady(); } catch { return; }
    if (!ctx.task && ctx.creation?.pending) return;
    const allowed = ctx.task ? (field === 'status' ? ctx.task.capabilities?.can_complete : ctx.task.capabilities?.can_edit) : ctx.client.canCreate;
    if (allowed !== true) return;
    const next = { ...fieldRef.current, [field]: value };
    fieldRef.current = next; setFields(next);
  }, [requireReady]);
  const save = useCallback(async (): Promise<HomeTask> => {
    const ctx = requireReady(); const revision = ctx.client.revision;
    try {
      const saved = ctx.task ? await ctx.client.edit(ctx.task.id, patch(fieldRef.current, initial.current))
        : ctx.creation?.pending ? await ctx.creation.retry()
        : await ctx.creation!.submit(payload(fieldRef.current));
      ctx.client.requireCurrent(revision);
      if (context.current !== ctx || !ctx.active) throw new Error('This task form is no longer open.');
      ctx.task = saved; setTask(saved); setPending(null);
      const fresh = values(saved); initial.current = fresh; fieldRef.current = fresh; setFields(fresh);
      return saved;
    } finally {
      if (context.current === ctx && ctx.active) {
        try {
          ctx.client.requireCurrent();
          if (ctx.loadedRevision === ctx.client.revision && document.visibilityState !== 'hidden') {
            setPending(ctx.creation?.pending || null); refreshControllerState(value => value + 1);
          }
        } catch { ctx.retire(); }
      }
    }
  }, [requireReady]);
  const acknowledge = useCallback(async () => {
    const ctx = requireReady(); const revision = ctx.client.revision;
    if (!ctx.creation) throw new Error('No saved request can be cleared.');
    await ctx.client.list(revision);
    await ctx.creation.acknowledge();
    ctx.client.requireCurrent(revision);
  }, [requireReady]);

  return { fields, change, task, pending, ready, loading, error, retired, save, acknowledge,
    canAcknowledge: context.current?.creation?.canAcknowledge === true,
    canEdit: ready && (task ? task.capabilities?.can_edit === true : context.current?.client.canCreate === true),
    canComplete: ready && task?.capabilities?.can_complete === true,
    scope: context.current?.client.currentScope || null, current: requireReady, close: () => context.current?.retire(), reload: () => reload.current() };
}
