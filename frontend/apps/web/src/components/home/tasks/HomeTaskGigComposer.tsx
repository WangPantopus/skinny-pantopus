'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as api from '@pantopus/api';
import { GIG_CATEGORIES } from '@pantopus/ui-utils';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { HomeTaskClient } from './HomeTaskClient';
import { HomeTaskGigController } from './HomeTaskGigController';
import { TASK_UUID, type HomeTask } from './homeTaskModel';
import { validTaskGigFields, type TaskGigFields } from './homeTaskGigModel';

function failureMessage(value: unknown, fallback: string) {
  return value && typeof value === 'object' && 'message' in value && typeof value.message === 'string' ? value.message : fallback;
}

export function HomeTaskGigComposer({ homeId, taskId, invalid = false }: { homeId: string; taskId: string; invalid?: boolean }) {
  const [controller, setController] = useState<HomeTaskGigController | null>(null);
  const [source, setSource] = useState<HomeTask | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [reload, setReload] = useState(0);
  const [, repaint] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('General');
  const [policy, setPolicy] = useState<TaskGigFields['cancellation_policy']>('standard');
  const [addressText, setAddressText] = useState('');
  const [location, setLocation] = useState<TaskGigFields['location'] | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const originalActor = useRef<string | null>(null);
  const lifecycle = useRef<{ active: boolean; busy: boolean; client: HomeTaskClient } | null>(null);
  const taskUrl = `/app/homes/${homeId}/tasks?taskId=${taskId}`;
  const clearFields = () => {
    setTitle(''); setDescription(''); setPrice(''); setCategory('General'); setPolicy('standard');
    setAddressText(''); setLocation(null); setReviewed(false);
  };
  const clearRef = useRef(clearFields); clearRef.current = clearFields;

  useEffect(() => {
    setController(null); setSource(null); setError(''); setLoading(true); setWorking(false); setReviewed(false);
    if (invalid || !TASK_UUID.test(homeId) || !TASK_UUID.test(taskId)) {
      clearRef.current(); setError('This household task link is invalid.'); setLoading(false); return;
    }
    const ctx = { active: true, busy: false, client: new HomeTaskClient(homeId) };
    lifecycle.current = ctx;
    const invalidate = (clear: boolean) => {
      ctx.active = false; ctx.client.retire(); setController(null); setSource(null); setLoading(false);
      if (clear) clearRef.current();
    };
    void (async () => {
      const next = await HomeTaskGigController.open(ctx.client, taskId);
      const task = await ctx.client.detail(taskId);
      if (!ctx.active) return;
      ctx.client.requireCurrent();
      if (originalActor.current && originalActor.current !== ctx.client.actorId) clearRef.current();
      originalActor.current = ctx.client.actorId;
      setController(next); setSource(task);
    })().catch(failure => {
      if (!ctx.active) return;
      clearRef.current(); setController(null); setSource(null);
      setError(failureMessage(failure, 'Current task access could not be confirmed.'));
    }).finally(() => { if (ctx.active) setLoading(false); });
    const visibility = () => {
      if (document.visibilityState === 'hidden') invalidate(false);
      else setReload(n => n + 1);
    };
    const storage = (e: StorageEvent) => {
      if (e.key === null || e.key === api.AUTH_SESSION_CHANGE_KEY) {
        invalidate(true); setError('Your account changed. Reload to check current access.');
      }
    };
    const focus = () => {
      if (document.visibilityState === 'hidden') return;
      try { ctx.client.requireCurrent(); invalidate(false); } catch { invalidate(true); }
      setReload(n => n + 1);
    };
    window.addEventListener('storage', storage); window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      ctx.active = false; ctx.client.retire();
      if (lifecycle.current === ctx) lifecycle.current = null;
      window.removeEventListener('storage', storage); window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [homeId, taskId, invalid, reload]);

  const run = async (action: () => Promise<unknown>) => {
    const ctx = lifecycle.current;
    if (!controller || !ctx?.active || ctx.busy) return;
    ctx.busy = true; setWorking(true); setError('');
    try {
      ctx.client.requireCurrent();
      await action();
      if (!ctx.active) return;
      const latest = await ctx.client.detail(taskId);
      if (!ctx.active) return;
      setSource(latest);
      ctx.client.requireCurrent();
      setReviewed(false);
    } catch (failure) {
      if (!ctx.active) return;
      const e = failure as { statusCode?: number; code?: string; data?: { code?: string } };
      const code = e.data?.code || e.code;
      if ([401,403,404].includes(e.statusCode || 0) || code === 'SESSION_SCOPE_CHANGED') {
        ctx.client.retire(); setController(null); setSource(null); clearRef.current();
      }
      setError(failureMessage(failure, 'Publication is unconfirmed. Retry the original request.'));
    } finally {
      ctx.busy = false;
      if (ctx.active) { setWorking(false); repaint(n => n + 1); }
    }
  };
  const pending = controller?.pending;
  const inputClass = 'w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-app-text';
  const publish = (e: React.FormEvent) => {
    e.preventDefault();
    const fields = { title: title.trim(), description: description.trim(), price: Number(price), category, cancellation_policy: policy, location };
    if (!reviewed || !validTaskGigFields(fields)) { setError('Review the public title, description, budget and selected address.'); return; }
    void run(() => controller!.submit(fields));
  };
  return <main className="mx-auto max-w-2xl space-y-5 px-4 py-8 text-app-text" aria-label="Publish household task as a Gig">
    <Link href={TASK_UUID.test(homeId) && TASK_UUID.test(taskId) ? taskUrl : '/app/homes'} prefetch={false} className="text-sm underline">Back to household tasks</Link>
    <h1 className="text-2xl font-semibold">Find help for this task</h1>
    <p className="text-sm text-app-text-secondary">Review what helpers will see. Your household task, mail, private files and access details stay private.</p>
    {loading && <p role="status">Checking current task access…</p>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!loading && !controller && <button className="rounded-lg border border-app-border px-4 py-2" onClick={() => setReload(n => n + 1)}>Reload current access</button>}
    {controller && source && <>
      <section className="rounded-xl border border-app-border p-4" aria-label="Private source task">
        <p className="text-xs text-app-text-secondary">Private household task</p><p className="font-medium">{source.title}</p>
      </section>
      {pending ? <section className="space-y-3 rounded-xl border border-app-border p-4" aria-label="Saved Gig publication">
        <h2 className="font-semibold">{pending.confirmed ? 'Original publication confirmed' : 'Publication needs confirmation'}</h2>
        <p>{pending.fields.title}</p><p className="whitespace-pre-wrap text-sm">{pending.fields.description}</p>
        <p className="text-sm">Original budget: ${pending.fields.price.toFixed(2)}</p>
        <p className="text-sm text-app-text-secondary">{pending.confirmed
          ? 'This receipt records the original publication. Open the Gig to see its current status. Your household task is still separate.'
          : 'The original request is saved on this browser. Retry it to confirm the outcome; retrying will not create a second Gig.'}</p>
        <div className="flex flex-wrap gap-3">
          {!pending.confirmed && <button disabled={working} className="rounded-lg bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
            onClick={() => void run(() => controller.retry())}>Retry original publication</button>}
          {pending.confirmed && <Link prefetch={false} href={`/app/gigs/${pending.confirmed.gig_id}`} className="rounded-lg bg-gray-900 px-4 py-2 text-white">Open Gig</Link>}
          {(pending.confirmed || controller.canDiscard) && <button disabled={working} className="rounded-lg border border-app-border px-4 py-2 disabled:opacity-50"
            onClick={() => void run(() => controller.acknowledge())}>{pending.confirmed ? 'I reviewed this confirmation' : 'Review current task again'}</button>}
        </div>
      </section> : controller.state.gig_id ? <section className="space-y-3 rounded-xl border border-app-border p-4">
        <p>This household task already has a published Gig.</p>
        <Link prefetch={false} className="inline-block rounded-lg bg-gray-900 px-4 py-2 text-white" href={`/app/gigs/${controller.state.gig_id}`}>Open linked Gig</Link>
      </section> : !controller.state.can_publish ? <section className="space-y-3 rounded-xl border border-app-border p-4">
        <p>Use an open, unassigned household task and pause automatic repeats before publishing.</p>
        <Link prefetch={false} href={taskUrl} className="underline">Review household task</Link>
      </section> : <form onSubmit={publish} className="space-y-4" aria-label="Review public Gig">
        <fieldset disabled={working} className="space-y-4 disabled:opacity-60">
          <div><label htmlFor="home-gig-title" className="mb-1 block font-medium">Public title</label>
            <input id="home-gig-title" required minLength={5} maxLength={255} className={inputClass} value={title} onChange={e => { setTitle(e.target.value); setReviewed(false); }} />
            <button type="button" className="mt-1 text-sm underline" onClick={() => { setTitle(source.title); setReviewed(false); }}>Use household task title</button></div>
          <div><label htmlFor="home-gig-description" className="mb-1 block font-medium">Public description</label>
            <textarea id="home-gig-description" required minLength={10} rows={5} className={inputClass} value={description} onChange={e => { setDescription(e.target.value); setReviewed(false); }} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="home-gig-price" className="mb-1 block font-medium">Budget (USD)</label>
              <input id="home-gig-price" type="number" required min="0.01" max="99999999.99" step="0.01" className={inputClass} value={price} onChange={e => { setPrice(e.target.value); setReviewed(false); }} /></div>
            <div><label htmlFor="home-gig-category" className="mb-1 block font-medium">Category</label>
              <select id="home-gig-category" className={inputClass} value={category} onChange={e => { setCategory(e.target.value); setReviewed(false); }}>
                {['General',...GIG_CATEGORIES].map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div><label id="home-gig-location-label" className="mb-1 block font-medium">Choose the work location</label>
            <AddressAutocomplete value={addressText} labelId="home-gig-location-label" hintText="Start typing, then choose a suggested work location." onChange={text => { setAddressText(text); setLocation(null); setReviewed(false); }}
              onSelectNormalized={n => {
                setReviewed(false);
                if (typeof n.latitude !== 'number' || typeof n.longitude !== 'number') { setLocation(null); return; }
                setLocation({ mode: 'address', address: n.address, latitude: n.latitude, longitude: n.longitude, city: n.city, state: n.state, zip: n.zipcode });
              }} />
            {location && <p role="status" className="mt-1 text-sm">Selected: {location.address}</p>}
            <p className="mt-1 text-xs text-app-text-secondary">City visibility. Exact address is shared after assignment.</p></div>
          <div><label htmlFor="home-gig-policy" className="mb-1 block font-medium">Cancellation policy</label>
            <select id="home-gig-policy" className={inputClass} value={policy} onChange={e => { setPolicy(e.target.value as TaskGigFields['cancellation_policy']); setReviewed(false); }}>
              <option value="flexible">Flexible</option><option value="standard">Standard</option><option value="strict">Strict</option></select>
            <p className="mt-1 text-xs text-app-text-secondary">{policy === 'flexible' ? 'Free cancellation before work starts.' : policy === 'standard'
              ? 'A grace window applies after acceptance; cancellation fees may apply afterward.' : 'Cancellation fees may apply after acceptance.'}</p></div>
          <label className="flex items-start gap-3 rounded-lg border border-app-border p-3 text-sm">
            <input type="checkbox" className="mt-1" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />
            I reviewed the public details, location, budget and cancellation policy.</label>
          <button type="submit" disabled={!reviewed || !location || working} className="rounded-lg bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-50">
            {working ? 'Confirming publication…' : 'Publish Gig'}</button>
          <p className="text-xs text-app-text-secondary">Publishing does not charge a card, assign a helper or complete your household task.</p>
        </fieldset>
      </form>}
    </>}
  </main>;
}
