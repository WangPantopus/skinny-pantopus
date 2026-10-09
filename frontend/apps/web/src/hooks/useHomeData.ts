'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { homeAccessExpiry, homeAccessFingerprint, readCurrentHomeAccess, watchHomeAccessExpiry } from '@/components/home/homeAccessFingerprint';
import { RETURN_REFRESH_MS, transientFailure } from '@/components/home/returnRefresh';
import { dropHomeDashboardCopy, keepHomeDashboardCopy, keepsHomeCopy, readHomeDashboardCopy } from '@/components/home/homeDashboardCopy';
import { fetchMe } from '@/lib/me';
import { onSyncTopic, touchesHome } from '@/lib/syncSignals';
import { queryKeys } from '@/lib/query-keys';

// ── Types ──

interface HomeDataEntities {
  home: Record<string, any> | null;
  members: Record<string, any>[];
  tasks: Record<string, any>[];
  issues: Record<string, any>[];
  bills: Record<string, any>[];
  packages: Record<string, any>[];
  documents: Record<string, any>[];
  events: Record<string, any>[];
  secrets: Record<string, any>[];
  emergencies: Record<string, any>[];
  nearbyGigs: Record<string, any>[];
  homeGigs: Record<string, any>[];
  pets: Record<string, any>[];
  polls: Record<string, any>[];
}

interface HomeAccessState {
  permissions: string[];
  role_base: string | null;
  isOwner: boolean;
}

export interface UseHomeDataReturn extends HomeDataEntities {
  loading: boolean;
  error: string | null;
  currentUserId: string | null;
  taskSession: api.HomeTaskSessionScope | null;
  myAccess: HomeAccessState;
  accessFingerprint: string | null;
  summaryCounts: api.homeProfile.HomeDashboardCounts | null;
  entityErrors: Partial<Record<keyof HomeDataEntities, string>>;
  /** The page shows the copy kept from your last visit while access is checked again: the
   * sensitive parts (access codes, emergency info, documents, bills) aren't there yet. */
  fromCopy: boolean;
  /** The access shown allows keeping a copy (owners and household roles without an end date). */
  keepsCopy: boolean;
  can: (perm: string) => boolean;
  refresh: () => Promise<void>;
  refreshEntity: (entity: keyof HomeDataEntities) => Promise<void>;
  // Setters needed by handlers that do optimistic updates
  setTasks: (updater: (prev: Record<string, any>[]) => Record<string, any>[]) => void;
  setIssues: (updater: (prev: Record<string, any>[]) => Record<string, any>[]) => void;
  setBills: (updater: (prev: Record<string, any>[]) => Record<string, any>[]) => void;
  setPackages: (updater: (prev: Record<string, any>[]) => Record<string, any>[]) => void;
  setMembers: (updater: (prev: Record<string, any>[]) => Record<string, any>[]) => void;
  setSecrets: (updater: (prev: Record<string, any>[]) => Record<string, any>[]) => void;
}

// ── Reducer ──

type State = HomeDataEntities & {
  loading: boolean;
  error: string | null;
  currentUserId: string | null;
  taskSession: api.HomeTaskSessionScope | null;
  myAccess: HomeAccessState;
  accessFingerprint: string | null;
  summaryCounts: api.homeProfile.HomeDashboardCounts | null;
  entityErrors: Partial<Record<keyof HomeDataEntities, string>>;
  fromCopy: boolean;
  /** The access read with these records (it is what a copy of them is kept with). */
  shownAccess: api.homeIam.HomeAccess | null;
};

type Action =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'LOAD_COMPLETE'; data: Partial<State> }
  | { type: 'COPY_UNCONFIRMED' }
  | { type: 'SET_ENTITY'; entity: keyof HomeDataEntities; data: HomeDataEntities[keyof HomeDataEntities] }
  | { type: 'UPDATE_ENTITY'; entity: keyof HomeDataEntities; updater: (prev: Record<string, any>[]) => Record<string, any>[] }
  | { type: 'SET_ACCESS'; access: HomeAccessState }
  | { type: 'SET_CURRENT_USER'; userId: string | null };

const INITIAL_ENTITIES: HomeDataEntities = {
  home: null,
  members: [],
  tasks: [],
  issues: [],
  bills: [],
  packages: [],
  documents: [],
  events: [],
  secrets: [],
  emergencies: [],
  nearbyGigs: [],
  homeGigs: [],
  pets: [],
  polls: [],
};

const initialState: State = {
  ...INITIAL_ENTITIES,
  loading: true,
  error: null,
  currentUserId: null,
  taskSession: null,
  accessFingerprint: null,
  summaryCounts: null,
  entityErrors: {},
  myAccess: { permissions: [], role_base: null, isOwner: false },
  fromCopy: false,
  shownAccess: null,
};

// Never kept between visits (contract §5): always read again before they show.
const SENSITIVE_ENTITIES = ['secrets', 'emergencies', 'documents', 'bills'] as const;

/** What a copy keeps of the page: everything shown except the sensitive parts and this visit's state. */
type KeptState = Omit<State, 'loading' | 'error' | 'entityErrors' | 'taskSession' | 'fromCopy' | 'shownAccess' | typeof SENSITIVE_ENTITIES[number]>;

function keptState(state: State): KeptState {
  const { loading: _loading, error: _error, entityErrors: _errors, taskSession: _session, fromCopy: _fromCopy,
    shownAccess: _access, secrets: _secrets, emergencies: _emergencies, documents: _documents, bills: _bills, ...kept } = state;
  // Counts of sensitive records wait for the records themselves.
  return { ...kept, summaryCounts: kept.summaryCounts ? { ...kept.summaryCounts, bills_due: 0, documents: 0 } : null };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD_START':
      return { ...initialState, loading: true, error: null };
    case 'LOAD_ERROR':
      return { ...initialState, loading: false, error: action.error };
    case 'LOAD_COMPLETE':
      return { ...state, ...action.data, loading: false, error: null, fromCopy: false };
    case 'COPY_UNCONFIRMED':
      // The re-check couldn't reach the server: the copy stays, and the sensitive parts say so.
      return { ...state, fromCopy: false, entityErrors: { ...state.entityErrors, ...Object.fromEntries(SENSITIVE_ENTITIES.map(entity =>
        [entity, `Current ${ENTITY_ERROR_LABELS[entity] ?? entity} could not be loaded. Retry to check current information.`])) } };
    case 'SET_ENTITY':
      return { ...state, [action.entity]: action.data };
    case 'UPDATE_ENTITY': {
      const data = action.updater(state[action.entity] as Record<string, any>[]);
      const counts = state.summaryCounts ? { ...state.summaryCounts } : null;
      if (counts) {
        if (action.entity === 'tasks') counts.tasks_open = data.filter(row => ['open', 'in_progress'].includes(row.status)).length;
        if (action.entity === 'issues') counts.issues_open = data.filter(row => ['open', 'scheduled', 'in_progress'].includes(row.status)).length;
        if (action.entity === 'bills') counts.bills_due = data.filter(row => ['due', 'overdue'].includes(row.status)).length;
        if (action.entity === 'packages') counts.packages_expected = data.filter(row => ['expected', 'in_transit', 'out_for_delivery'].includes(row.status)).length;
      }
      return { ...state, [action.entity]: data, summaryCounts: counts };
    }
    case 'SET_ACCESS':
      return { ...state, myAccess: action.access };
    case 'SET_CURRENT_USER':
      return { ...state, currentUserId: action.userId };
    default:
      return state;
  }
}

// A section error names the section in words the page already uses (the
// "Home help" card, "access information"), never an internal key such as homeGigs.
const ENTITY_ERROR_LABELS: Partial<Record<keyof HomeDataEntities, string>> = {
  secrets: 'access information',
  homeGigs: 'home help',
  nearbyGigs: 'home help',
};

// ── Entity fetch map ──

const ENTITY_FETCHERS: Record<
  keyof HomeDataEntities,
  (homeId: string) => Promise<{ key: string; data: Record<string, any> | Record<string, any>[] }>
> = {
  home: async (homeId) => {
    const res = await api.homes.getHome(homeId);
    return { key: 'home', data: (res as Record<string, any>).home as Record<string, any> };
  },
  members: async (homeId) => {
    const res = await api.homes.getHomeOccupants(homeId);
    const active = (res as Record<string, any>).occupants as Record<string, any>[];
    const pending = (res as Record<string, any>).pendingInvites as Record<string, any>[];
    return { key: 'members', data: [...active, ...pending] };
  },
  tasks: async (homeId) => {
    const res = await api.homeProfile.getHomeTasks(homeId);
    return { key: 'tasks', data: (res as Record<string, any>).tasks as Record<string, any>[] };
  },
  issues: async (homeId) => {
    const res = await api.homeProfile.getHomeIssues(homeId);
    return { key: 'issues', data: (res as Record<string, any>).issues as Record<string, any>[] };
  },
  bills: async (homeId) => {
    const res = await api.homeProfile.getHomeBills(homeId);
    return { key: 'bills', data: (res as Record<string, any>).bills as Record<string, any>[] };
  },
  packages: async (homeId) => {
    const res = await api.homeProfile.getHomePackages(homeId);
    return { key: 'packages', data: (res as Record<string, any>).packages as Record<string, any>[] };
  },
  documents: async (homeId) => {
    const res = await api.homeProfile.getHomeDocuments(homeId);
    return { key: 'documents', data: (res as Record<string, any>).documents as Record<string, any>[] };
  },
  events: async (homeId) => {
    const res = await api.homeProfile.getHomeEvents(homeId);
    return { key: 'events', data: res.events };
  },
  secrets: async (homeId) => {
    const res = await api.homeProfile.getHomeAccessSecrets(homeId);
    return { key: 'secrets', data: (res as Record<string, any>).secrets as Record<string, any>[] };
  },
  emergencies: async (homeId) => {
    const res = await api.homeProfile.getHomeEmergencies(homeId);
    return { key: 'emergencies', data: (res as Record<string, any>).emergencies as Record<string, any>[] };
  },
  nearbyGigs: async (homeId) => {
    const res = await api.homeProfile.getNearbyGigs(homeId, { limit: 10 });
    return { key: 'nearbyGigs', data: (res as Record<string, any>).gigs as Record<string, any>[] };
  },
  homeGigs: async (homeId) => {
    const res = await api.homeProfile.getHomeGigs(homeId, { limit: 20 });
    return { key: 'homeGigs', data: (res as Record<string, any>).gigs as Record<string, any>[] };
  },
  pets: async (homeId) => {
    const res = await api.homeProfile.getHomePets(homeId);
    return { key: 'pets', data: (res as Record<string, any>).pets as Record<string, any>[] };
  },
  polls: async (homeId) => {
    const res = await api.homeProfile.getHomePolls(homeId);
    return { key: 'polls', data: (res as Record<string, any>).polls as Record<string, any>[] };
  },
};

// ── Hook ──

/** True while this browser's session, API origin and generation are the ones a read started under. */
function sessionCheck(revision: number, generation: { current: number }): () => boolean {
  const token = getAuthToken(), origin = api.getApiBaseUrl();
  const marker = typeof window === 'undefined' ? null : localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
  return () => revision === generation.current && token === getAuthToken()
    && origin === api.getApiBaseUrl() && marker === localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
}

export function useHomeData(homeId: string): UseHomeDataReturn {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Owners and household roles come back to the copy kept from their last visit (decision 3);
  // it shows at once and the access is checked again behind it before anything sensitive loads.
  const [copy] = useState(() => readHomeDashboardCopy<KeptState>(queryClient, homeId));
  const [state, dispatch] = useReducer(reducer, copy, (kept): State => (kept
    ? { ...initialState, ...kept.state, loading: false, fromCopy: true, shownAccess: kept.access }
    : initialState));
  const generation = useRef(0);
  const scopeHome = useRef(homeId);
  const copyHome = useRef(copy ? homeId : null);
  const ready = useRef<(() => boolean) | null>(null);
  // The copy was shown under this session: it answers what may be shown until the re-check does.
  const readyInitialized = useRef(false);
  if (!readyInitialized.current) {
    readyInitialized.current = true;
    if (copy) ready.current = sessionCheck(generation.current, generation);
  }
  const showingCopy = useRef(state.fromCopy);
  showingCopy.current = state.fromCopy;
  // While the page is open its copy is in use, so the 30-minute drop of unused entries starts on leaving.
  useQuery({ queryKey: queryKeys.homeDashboard(homeId), queryFn: skipToken });
  const stopExpiry = useRef<(() => void) | null>(null);
  const lastAttempt = useRef(0);
  const inFlight = useRef(0);
  // A change signal that arrived during a load: one more background re-check follows it.
  const signalPending = useRef(false);
  // The access the page currently shows (null while loading or failed), for background re-checks.
  const shownFingerprint = useRef<string | null>(null);
  const retireGeneration = useCallback(() => {
    generation.current++; ready.current = null;
    stopExpiry.current?.(); stopExpiry.current = null;
  }, []);

  // A full load clears the page first. A background re-check (coming back to the page) keeps it and
  // replaces the records only when access is unchanged; a changed access or a refusal reloads in full.
  const loadDashboard = useCallback(async (background = false) => {
    if (!background) retireGeneration();
    const revision = generation.current;
    let expiry: number | null = null;
    lastAttempt.current = Date.now();
    if (!background) { scopeHome.current = homeId; ready.current = null; }
    const token = getAuthToken(), origin = api.getApiBaseUrl();
    const marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
    const current = () => revision === generation.current && token === getAuthToken()
      && origin === api.getApiBaseUrl() && marker === localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY)
      && (expiry === null || Date.now() < expiry);
    const reloadInFull = () => { if (current()) void loadDashboard(); };
    if (!background) { copyHome.current = null; dispatch({ type: 'LOAD_START' }); }
    inFlight.current++;
    try {
      if (!token) {
        router.push('/login');
        return;
      }

      // Load current user
      let userId: string | null = null;
      try {
        const userData = await fetchMe() as Record<string, any>;
        const u = userData?.user ?? userData;
        userId = u?.id || null;
        if (!current()) return;
        dispatch({ type: 'SET_CURRENT_USER', userId });
      } catch {
        // Non-critical
      }

      if (!current()) return;
      // An unavailable authority read cannot authorize stale dashboard data.
      const accessRes = await readCurrentHomeAccess(homeId);
      if (!current()) return;
      if (background && homeAccessFingerprint(accessRes) !== shownFingerprint.current) { reloadInFull(); return; }
      if (accessRes.verification_required === true && !accessRes.hasAccess) {
        if (background) return;
        ready.current = current;
        dispatch({ type: 'LOAD_COMPLETE', data: { accessFingerprint: homeAccessFingerprint(accessRes), shownAccess: accessRes } });
        return;
      }
      if (accessRes.hasAccess !== true || !Array.isArray(accessRes.permissions)) {
        throw new Error('Current access to this home could not be confirmed. Reload to check access.');
      }
      expiry = homeAccessExpiry(accessRes);
      // A background re-check found the same access, so the full load's expiry watch still applies.
      if (!background) stopExpiry.current = watchHomeAccessExpiry(expiry, () => {
        if (revision !== generation.current) return;
        retireGeneration();
        dispatch({ type: 'LOAD_ERROR', error: 'Home access changed or could not be confirmed. Reload to check current access.' });
      });
      if (!current()) return;
      const access: HomeAccessState = {
        permissions: accessRes.permissions, role_base: accessRes.effective_role_base ?? accessRes.role_base ?? null, isOwner: accessRes.isOwner === true,
      };


      // The aggregate supplies counts/today, not the full record collections.
      // A failed aggregate is unavailable; independent best-effort reads cannot
      // turn it into an apparently confirmed empty Home.
      const dash = await api.homeProfile.getHomeDashboard(homeId);
      if (!current()) return;
      const countKeys: (keyof api.homeProfile.HomeDashboardCounts)[] = [
        'tasks_open', 'issues_open', 'bills_due', 'packages_expected', 'documents',
        'events_upcoming', 'members_active', 'pets',
      ];
      if (dash.home?.id !== homeId || !Array.isArray(dash.members) || !dash.counts
        || countKeys.some(key => !Number.isSafeInteger(dash.counts[key]) || dash.counts[key] < 0)
        || !Array.isArray(dash.today?.next_events) || !Array.isArray(dash.today?.tasks_due)
        || !Array.isArray(dash.myAccess?.permissions)
        || JSON.stringify([...dash.myAccess.permissions].sort()) !== JSON.stringify([...access.permissions].sort())) {
        throw new Error('The current Home summary could not be confirmed. Reload to try again.');
      }
      const allowed = (permission: string) => access.permissions.includes(permission);
      const result: Partial<State> = { home: dash.home, members: allowed('members.view') ? dash.members : [],
        myAccess: access, accessFingerprint: homeAccessFingerprint(accessRes), summaryCounts: dash.counts,
        taskSession: dash.task_session?.home_id === homeId ? dash.task_session : null, entityErrors: {} };
      const required: [keyof HomeDataEntities, string][] = [
        ['tasks', 'tasks.view'], ['issues', 'maintenance.view'], ['bills', 'finance.view'],
        ['packages', 'packages.view'], ['documents', 'docs.view'], ['events', 'calendar.view'],
      ];
      await Promise.all(required.map(async ([entity, permission]) => {
        if (!allowed(permission)) return;
        const response = await ENTITY_FETCHERS[entity](homeId);
        if (!Array.isArray(response.data) || response.data.some(row => !row || typeof row.id !== 'string' || row.home_id !== homeId)) {
          throw new Error(`Current ${entity} could not be confirmed. Reload to try again.`);
        }
        Object.assign(result, { [entity]: response.data });
      }));
      if (!current()) return;
      // Ancillary failures retain an explicit card error. No failed list is
      // presented as "no records", and denied sections do not issue requests.
      const optional: [keyof HomeDataEntities, boolean][] = [
        ['secrets', allowed('access.view_wifi') || allowed('access.view_codes')],
        ['emergencies', allowed('sensitive.view')], ['pets', allowed('home.view')],
        ['polls', allowed('home.view')], ['nearbyGigs', allowed('home.view')], ['homeGigs', allowed('home.view')],
      ];
      await Promise.all(optional.map(async ([entity, permitted]) => {
        if (!permitted) return;
        try {
          const response = await ENTITY_FETCHERS[entity](homeId);
          if (!Array.isArray(response.data)) throw new Error('Invalid collection');
          if ((entity === 'emergencies' || entity === 'secrets')
            && response.data.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
            throw new Error('Invalid record');
          }
          Object.assign(result, { [entity]: response.data });
        } catch {
          result.entityErrors![entity] = `Current ${ENTITY_ERROR_LABELS[entity] ?? entity} could not be loaded. Retry to check current information.`;
        }
      }));
      if (!current()) return;
      const finalAccess = await readCurrentHomeAccess(homeId);
      if (!current()) return;
      if (finalAccess.hasAccess !== true || homeAccessFingerprint(finalAccess) !== result.accessFingerprint) {
        throw new Error('Home access changed while loading. Reload to check current access.');
      }
      if (result.home?.id !== homeId) throw new Error('The requested home could not be confirmed.');
      if (!background) ready.current = current;
      result.shownAccess = finalAccess;
      dispatch({ type: 'LOAD_COMPLETE', data: result });
    } catch (e: unknown) {
      if (!current()) return;
      if (background) {
        if (!transientFailure(e)) reloadInFull();
        else if (showingCopy.current) dispatch({ type: 'COPY_UNCONFIRMED' });
        return;
      }
      ready.current = null;
      dispatch({
        type: 'LOAD_ERROR',
        error: e instanceof Error ? e.message : 'Current home access could not be confirmed. Reload to try again.',
      });
    } finally {
      inFlight.current--;
      if (inFlight.current === 0 && signalPending.current && current()) {
        signalPending.current = false;
        void loadDashboard(ready.current !== null);
      }
    }
  }, [homeId, router, retireGeneration]);

  useEffect(() => {
    shownFingerprint.current = state.loading || state.error ? null : state.accessFingerprint;
  }, [state.loading, state.error, state.accessFingerprint]);

  // The copy follows what the page shows (loads and your own edits), while the access allows one.
  useEffect(() => {
    if (scopeHome.current !== homeId || state.fromCopy) return;
    if (state.loading || state.error || !keepsHomeCopy(state.shownAccess)) { dropHomeDashboardCopy(queryClient, homeId); return; }
    keepHomeDashboardCopy(queryClient, homeId, { access: state.shownAccess, state: keptState(state) });
  }, [state, homeId, queryClient]);

  useEffect(() => {
    // From a copy, the first load is the background re-check: same access, the records are
    // replaced in place; changed or refused access, the page reloads in full.
    const fromCopy = copyHome.current === homeId;
    if (fromCopy && ready.current === null) ready.current = sessionCheck(generation.current, generation);
    void loadDashboard(fromCopy);
    // Another account's Home must never show, so an account change clears the page and reloads it.
    const changed = () => { retireGeneration(); dispatch({ type: 'LOAD_START' }); void loadDashboard(); };
    // Coming back keeps the page and re-checks it behind the scenes (in full when nothing is shown).
    const resume = () => {
      if (document.visibilityState === 'hidden' || inFlight.current > 0
        || Date.now() - lastAttempt.current < RETURN_REFRESH_MS) return;
      void loadDashboard(ready.current !== null);
    };
    // The server says this Home (its records, members or your access) changed: re-check now,
    // behind the page (contract §8), or right after the load already running.
    const signalled = (topic: string) => {
      if (!touchesHome(topic, homeId)) return;
      if (inFlight.current > 0) { signalPending.current = true; return; }
      void loadDashboard(ready.current !== null);
    };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) changed(); };
    const unsubscribe = api.onTokenChange(changed);
    const unsubscribeSync = onSyncTopic(signalled);
    window.addEventListener('storage', storage); window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => { retireGeneration(); unsubscribe(); unsubscribeSync(); signalPending.current = false; window.removeEventListener('storage', storage);
      window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); };
  }, [loadDashboard, retireGeneration, homeId]);

  // A record refresh also refreshes current grants and aggregate counts; a
  // partial reply cannot revive an earlier session or leave old summary totals.
  const refreshEntity = useCallback(async (_entity: keyof HomeDataEntities) => {
    await loadDashboard();
  }, [loadDashboard]);
  const refresh = useCallback(() => loadDashboard(), [loadDashboard]);

  const openingAccess = ready.current;
  const can = useCallback(
    (perm: string): boolean => {
      return openingAccess !== null && openingAccess === ready.current && openingAccess() && state.myAccess.permissions.includes(perm);
    },
    [state.myAccess, openingAccess]
  );

  const makeEntityUpdater = useCallback(
    (entity: keyof HomeDataEntities) => {
      const opening = ready.current;
      return (updater: (prev: Record<string, any>[]) => Record<string, any>[]) => {
        if (opening && ready.current === opening && opening()) dispatch({ type: 'UPDATE_ENTITY', entity, updater });
      };
    },
    []
  );

  const visibleState = scopeHome.current === homeId ? state : initialState;
  return {
    // Entities
    home: visibleState.home,
    members: visibleState.members,
    tasks: visibleState.tasks,
    issues: visibleState.issues,
    bills: visibleState.bills,
    packages: visibleState.packages,
    documents: visibleState.documents,
    events: visibleState.events,
    secrets: visibleState.secrets,
    emergencies: visibleState.emergencies,
    nearbyGigs: visibleState.nearbyGigs,
    homeGigs: visibleState.homeGigs,
    pets: visibleState.pets,
    polls: visibleState.polls,
    // Meta
    loading: visibleState.loading,
    error: visibleState.error,
    currentUserId: visibleState.currentUserId,
    taskSession: visibleState.taskSession,
    myAccess: visibleState.myAccess,
    accessFingerprint: visibleState.accessFingerprint,
    summaryCounts: visibleState.summaryCounts,
    entityErrors: visibleState.entityErrors,
    fromCopy: visibleState.fromCopy,
    keepsCopy: keepsHomeCopy(visibleState.shownAccess),
    can,
    refresh,
    refreshEntity,
    // Optimistic updaters
    setTasks: makeEntityUpdater('tasks'),
    setIssues: makeEntityUpdater('issues'),
    setBills: makeEntityUpdater('bills'),
    setPackages: makeEntityUpdater('packages'),
    setMembers: makeEntityUpdater('members'),
    setSecrets: makeEntityUpdater('secrets'),
  };
}
