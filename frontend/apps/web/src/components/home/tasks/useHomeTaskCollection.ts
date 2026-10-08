'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { HomeTaskClient } from './HomeTaskClient';
import { TASK_UUID, type HomeTask } from './homeTaskModel';
import { RETURN_REFRESH_MS, transientFailure } from '../returnRefresh';

type TaskMember = { user_id: string; name?: string; username?: string; user?: { name?: string; username?: string } };
interface Context { client: HomeTaskClient; active: boolean; loadedRevision?: number }

/** A visible collection belongs to one opening account, Home and API origin. */
export function useHomeTaskCollection(homeId: string) {
  const [tasks, setTasks] = useState<HomeTask[]>([]);
  const [members, setMembers] = useState<TaskMember[]>([]);
  const [scope, setScope] = useState<api.HomeTaskSessionScope | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retired, setRetired] = useState(false);
  const context = useRef<Context | null>(null);
  const reload = useRef<() => void>(() => {});
  const hide = useCallback(() => { setTasks([]); setMembers([]); setScope(null); setCanCreate(false); }, []);
  useEffect(() => {
    const ctx: Context = { client: new HomeTaskClient(homeId), active: true };
    context.current = ctx; hide(); setError(''); setRetired(false);
    let working = false; let queued = false; let lastAttempt = 0;
    const current = (revision: number) => {
      try { ctx.client.requireCurrent(revision); return ctx.active && context.current === ctx; }
      catch { return false; }
    };
    const retire = () => { ctx.active = false; ctx.client.retire(); hide(); setLoading(false); setRetired(true); };
    // A background re-check (coming back to the page) keeps the list and replaces it with the newer answer;
    // a network or server blip keeps it as is, and any other failure shows the error as a full load would.
    const load = async (background = false) => {
      if (!ctx.active) return;
      if (working) { if (!background) queued = true; return; }
      working = true; lastAttempt = Date.now(); const revision = ctx.client.revision;
      if (!background) { ctx.loadedRevision = undefined; hide(); setLoading(true); setError(''); }
      try {
        const result = await ctx.client.list(revision);
        if (!current(revision)) return;
        ctx.loadedRevision = revision; setTasks(result.tasks); setScope(result.task_session);
        setCanCreate(result.collection_capabilities.can_create); setError('');
        // Membership names are optional; their failure must not hide a readable task.
        try {
          const response = await api.homes.getHomeOccupants(homeId);
          if (!current(revision)) return;
          const occupants: unknown = response.occupants;
          // Guests can't see household tasks, so the server refuses them as assignees.
          if (Array.isArray(occupants)) setMembers(occupants.filter((value): value is TaskMember =>
            value && typeof value.user_id === 'string' && TASK_UUID.test(value.user_id) && value.role !== 'guest'));
        } catch { /* Task access remains independently verified. */ }
      } catch (failure) {
        if (ctx.active && context.current === ctx) {
          try { ctx.client.requireCurrent(); } catch { retire(); return; }
          if (background && transientFailure(failure)) return;
          if (background) { ctx.loadedRevision = undefined; hide(); }
          if (current(revision)) setError(failure instanceof Error ? failure.message : 'Task access could not be checked. Retry.');
        }
      } finally {
        working = false;
        if (current(revision)) setLoading(false);
        if (queued && ctx.active) { queued = false; void load(); }
      }
    };
    reload.current = () => { void load(); };
    // Coming back to the tab keeps the list and re-checks it behind the scenes (in full when none is shown).
    const visibility = () => {
      if (document.visibilityState === 'hidden' || Date.now() - lastAttempt < RETURN_REFRESH_MS) return;
      void load(ctx.loadedRevision === ctx.client.revision);
    };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) retire(); };
    const unsubscribe = api.onTokenChange(retire);
    document.addEventListener('visibilitychange', visibility); window.addEventListener('storage', storage);
    void load();
    return () => {
      ctx.active = false; ctx.client.retire(); unsubscribe();
      document.removeEventListener('visibilitychange', visibility); window.removeEventListener('storage', storage);
      if (context.current === ctx) { context.current = null; reload.current = () => {}; }
    };
  }, [homeId, hide]);
  const current = useCallback(() => {
    const ctx = context.current;
    if (!ctx?.active || ctx.loadedRevision !== ctx.client.revision) throw new Error('Reload current tasks before continuing.');
    ctx.client.requireCurrent(); return ctx.client;
  }, []);
  const saved = useCallback((task: HomeTask) => {
    current();
    if (task.home_id !== homeId) throw new Error('The saved task belongs to another Home.');
    setTasks(previous => previous.some(item => item.id === task.id) ? previous.map(item => item.id === task.id ? task : item) : [task, ...previous]);
  }, [current, homeId]);
  return { tasks, members, scope, canCreate, loading, error, retired, current, saved, reload: () => reload.current() };
}
