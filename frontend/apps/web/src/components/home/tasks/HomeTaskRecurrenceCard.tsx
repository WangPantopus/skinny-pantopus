'use client';

import { useEffect, useRef, useState } from 'react';
import type { HomeTaskSessionScope } from '@pantopus/api';
import { COMMON_ZONES, detectTimezone, zoneLabel } from '@/components/scheduling/TimezoneSelector';
import { HomeTaskClient } from './HomeTaskClient';
import { HomeTaskRecurrenceController } from './HomeTaskRecurrenceController';
import { validRecurrenceCommand, type RecurrenceFrequency } from './homeTaskRecurrenceModel';
import type { HomeTask } from './homeTaskModel';

function dueLabel(value: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(value));
}
export function HomeTaskRecurrenceCard({ task, scope, busy, hasUnsavedChanges, onTaskReload, onTaskUpdated }: {
  task: HomeTask; scope: HomeTaskSessionScope; busy: boolean; hasUnsavedChanges: boolean; onTaskReload: () => void; onTaskUpdated: (task: HomeTask) => void;
}) {
  const [controller, setController] = useState<HomeTaskRecurrenceController | null>(null);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('WEEKLY');
  const [interval, setInterval] = useState('1');
  const [timezone, setTimezone] = useState('UTC');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [reload, setReload] = useState(0);
  const [, repaint] = useState(0);
  const lifecycle = useRef<{ active: boolean; busy: boolean; client: HomeTaskClient } | null>(null);
  const taskReload = useRef(onTaskReload); taskReload.current = onTaskReload;
  const taskUpdated = useRef(onTaskUpdated); taskUpdated.current = onTaskUpdated;
  const opening = useRef(scope); opening.current = scope;

  useEffect(() => {
    const ctx = { active: true, busy: false, client: new HomeTaskClient(task.home_id, opening.current) };
    lifecycle.current = ctx;
    setController(null); setError(''); setLoading(true); setWorking(false);
    setFrequency('WEEKLY'); setInterval('1'); setTimezone('UTC');
    void HomeTaskRecurrenceController.open(ctx.client, task.id).then(value => {
      if (!ctx.active) return;
      ctx.client.requireCurrent();
      if (value.state.task_updated_at !== task.updated_at) { taskReload.current(); return; }
      const pending = value.pending;
      const config = pending && !pending.confirmed && pending.command.action === 'start' ? pending.command : value.state.configuration;
      if (config) { setFrequency(config.frequency); setInterval(String(config.interval)); setTimezone(config.timezone); }
      setController(value);
    }).catch(failure => {
      if (!ctx.active) return;
      setError(failure instanceof Error ? failure.message : 'Repeat settings could not be loaded.');
      const response = failure as { statusCode?: number; code?: string; data?: { code?: string } };
      if (response.statusCode === 403 || (response.statusCode === 404 && (response.code || response.data?.code))) taskReload.current();
    }).finally(() => { if (ctx.active) setLoading(false); });
    return () => { ctx.active = false; ctx.client.retire(); if (lifecycle.current === ctx) lifecycle.current = null; };
  }, [task.home_id, task.id, task.updated_at, scope.actor_id, scope.session_scope, reload]);

  const run = async (action: () => Promise<unknown>) => {
    const ctx = lifecycle.current;
    if (!controller || !ctx?.active || ctx.busy || busy) return;
    ctx.busy = true;
    setWorking(true); setError('');
    try {
      ctx.client.requireCurrent();
      await action();
      if (!ctx.active) return;
      ctx.client.requireCurrent();
      const config = controller.state.configuration;
      if (config) { setFrequency(config.frequency); setInterval(String(config.interval)); setTimezone(config.timezone); }
      const currentTask = await ctx.client.detail(task.id);
      if (!ctx.active) return;
      ctx.client.requireCurrent();
      taskUpdated.current(currentTask);
      if (currentTask.updated_at !== task.updated_at) taskReload.current();
    } catch (failure) {
      if (!ctx.active) return;
      const response = failure as { statusCode?: number; code?: string; data?: { code?: string } };
      if (response.statusCode === 403 || (response.statusCode === 404 && (response.code || response.data?.code))
        || response.code === 'SESSION_SCOPE_CHANGED' || response.data?.code === 'SESSION_SCOPE_CHANGED') {
        setController(null); taskReload.current();
      }
      setError(failure instanceof Error ? failure.message : 'The schedule change was not confirmed. Retry the saved change.');
    } finally { ctx.busy = false; if (ctx.active) { setWorking(false); repaint(value => value + 1); } }
  };
  const state = controller?.state;
  const config = state?.configuration;
  const pending = controller?.pending;
  const disabled = busy || working || !state?.can_manage || !!pending;
  const changed = !config || config.state !== 'active' || config.frequency !== frequency || config.interval !== Number(interval) || config.timezone !== timezone;
  const start = () => {
    if (!controller || hasUnsavedChanges || !task.due_at) return;
    const command = { action: 'start' as const, expected_revision: controller.state.revision,
      expected_task_updated_at: controller.state.task_updated_at, frequency, interval: Number(interval), timezone };
    if (!validRecurrenceCommand(command)) { setError('Choose a repeat interval from 1 to 365 and a time zone.'); return; }
    void run(() => controller.submit(command));
  };
  const zones = [...new Set([timezone, detectTimezone(), ...COMMON_ZONES])];

  return <section aria-label="Automatic repeat schedule" className="mt-6 space-y-3 border-t border-app-border pt-5 text-sm">
    <h3 className="font-semibold text-app-text-strong">Repeat schedule</h3>
    {loading && <p role="status">Checking repeat settings…</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!loading && !controller && <button type="button" className="underline" onClick={() => setReload(value => value + 1)}>Reload repeat settings</button>}
    {controller && <>
      <p role="status">{config?.state === 'active' ? `Repeating · next occurrence ${dueLabel(config.next_due_at!, config.timezone)}`
        : config?.state === 'needs_review' ? 'Repeats need review because the task or access changed.'
        : config?.state === 'paused' ? 'Repeats are paused.' : 'Automatic repeats are off.'}</p>
      {config?.generated_count ? <p>{config.generated_count} {config.generated_count === 1 ? 'task has' : 'tasks have'} been created by this schedule.</p> : null}
      {pending ? <div className="space-y-2 rounded border border-app-border p-3">
        <p>{pending.confirmed ? 'Your saved schedule change is confirmed. The current schedule is shown above.'
          : pending.command.action === 'pause' ? 'Your previous pause has not been confirmed. Retry that saved change.'
            : `Your previous change to repeat every ${pending.command.interval} ${pending.command.frequency.toLowerCase().replace('daily', 'day').replace('weekly', 'week').replace('monthly', 'month')}${pending.command.interval === 1 ? '' : 's'} in ${zoneLabel(pending.command.timezone)} has not been confirmed.`}</p>
        {pending.confirmed || controller.canDiscard
          ? <button type="button" disabled={working || busy} className="underline" onClick={() => void run(() => controller.acknowledge())}>
            {pending.confirmed ? 'Done reviewing saved change' : 'Dismiss rejected change'}</button>
          : <button type="button" disabled={working || busy || !state?.can_manage} className="underline" onClick={() => void run(() => controller.retry())}>Retry saved change</button>}
      </div> : <>
        {!task.due_at && <p>Save a due date on this task before starting repeats.</p>}
        {hasUnsavedChanges && <p>Save your task changes before starting or updating repeats.</p>}
        <div className="flex items-end gap-2">
          <label className="flex-1">Repeat every<input aria-label="Repeat interval" type="number" min="1" max="365" step="1" value={interval}
            disabled={disabled} onChange={event => setInterval(event.target.value)} className="mt-1 w-full rounded border border-app-border bg-app-surface px-3 py-2" /></label>
          <label className="flex-1">Period<select aria-label="Repeat period" value={frequency} disabled={disabled}
            onChange={event => setFrequency(event.target.value as RecurrenceFrequency)} className="mt-1 w-full rounded border border-app-border bg-app-surface px-3 py-2">
            <option value="DAILY">Days</option><option value="WEEKLY">Weeks</option><option value="MONTHLY">Months</option>
          </select></label>
        </div>
        <label className="block">Time zone<select aria-label="Repeat time zone" value={timezone} disabled={disabled}
          onChange={event => setTimezone(event.target.value)} className="mt-1 w-full rounded border border-app-border bg-app-surface px-3 py-2">
          {zones.map(zone => <option key={zone} value={zone}>{zoneLabel(zone)}</option>)}
        </select></label>
        {task.due_at && <p>The saved task is the first occurrence: {dueLabel(task.due_at, timezone)}.</p>}
        {frequency === 'MONTHLY' && <p>Months without this calendar day are skipped.</p>}
        <details><summary className="cursor-pointer">How repeats work</summary><p className="mt-2">
          Each scheduled date creates a new task. After missed dates, only the latest due task is created.
          Completing the original task does not stop repeats. Pause stops future tasks and keeps existing tasks.
          Attachments are not copied. Local clock changes may adjust an occurrence.</p></details>
        <div className="flex gap-3">
          <button type="button" disabled={disabled || hasUnsavedChanges || !task.due_at || task.status === 'canceled' || !changed}
            className="rounded bg-gray-900 px-3 py-2 font-medium text-white disabled:opacity-50" onClick={start}>
            {config?.state === 'active' ? 'Save repeat changes' : 'Start repeating'}</button>
          {config && config.state !== 'paused' && <button type="button" disabled={disabled} className="rounded border border-app-border px-3 py-2"
            onClick={() => void run(() => controller.submit({ action: 'pause', expected_revision: controller.state.revision }))}>Pause repeats</button>}
        </div>
      </>}
      {!state?.can_manage && <p>You can view this schedule, but you cannot change it.</p>}
    </>}
  </section>;
}
