'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { homeAccessFingerprint, readCurrentHomeAccess } from '@/components/home/homeAccessFingerprint';

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
};

type Action =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'LOAD_COMPLETE'; data: Partial<State> }
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
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD_START':
      return { ...initialState, loading: true, error: null };
    case 'LOAD_ERROR':
      return { ...initialState, loading: false, error: action.error };
    case 'LOAD_COMPLETE':
      return { ...state, ...action.data, loading: false, error: null };
    case 'SET_ENTITY':
      return { ...state, [action.entity]: action.data };
    case 'UPDATE_ENTITY': {
      const data = action.updater(state[action.entity] as Record<string, any>[]);
      const counts = state.summaryCounts ? { ...state.summaryCounts } : null;
      if (counts) {
        if (action.entity === 'tasks') counts.tasks_open = data.filter(row => ['open', 'in_progress'].includes(row.status)).length;
        if (action.entity === 'issues') counts.issues_open = data.filter(row => ['open', 'scheduled', 'in_progress'].includes(row.status)).length;
        if (action.entity === 'bills') counts.bills_due = data.filter(row => ['due', 'overdue'].includes(row.status)).length;
        if (action.entity === 'packages') counts.packages_expected = data.filter(row => ['expected', 'out_for_delivery'].includes(row.status)).length;
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

export function useHomeData(homeId: string): UseHomeDataReturn {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);
  const generation = useRef(0);
  const scopeHome = useRef(homeId);
  const ready = useRef<(() => boolean) | null>(null);
  const retireGeneration = useCallback(() => { generation.current++; ready.current = null; }, []);

  const loadDashboard = useCallback(async () => {
    const revision = ++generation.current;
    scopeHome.current = homeId; ready.current = null;
    const token = getAuthToken(), origin = api.getApiBaseUrl();
    const marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
    const current = () => revision === generation.current && token === getAuthToken()
      && origin === api.getApiBaseUrl() && marker === localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY)
      && document.visibilityState !== 'hidden';
    dispatch({ type: 'LOAD_START' });
    try {
      if (!token) {
        router.push('/login');
        return;
      }

      // Load current user
      let userId: string | null = null;
      try {
        const userData = await api.users.getMyProfile() as Record<string, any>;
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
      if (accessRes.verification_required === true && !accessRes.hasAccess) {
        ready.current = current;
        dispatch({ type: 'LOAD_COMPLETE', data: { accessFingerprint: homeAccessFingerprint(accessRes) } });
        return;
      }
      if (accessRes.hasAccess !== true || !Array.isArray(accessRes.permissions)) {
        throw new Error('Current access to this home could not be confirmed. Reload to check access.');
      }
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
          Object.assign(result, { [entity]: response.data });
        } catch {
          result.entityErrors![entity] = `Current ${entity === 'secrets' ? 'access information' : entity} could not be loaded. Retry to check current information.`;
        }
      }));
      if (!current()) return;
      const finalAccess = await readCurrentHomeAccess(homeId);
      if (!current()) return;
      if (finalAccess.hasAccess !== true || homeAccessFingerprint(finalAccess) !== result.accessFingerprint) {
        throw new Error('Home access changed while loading. Reload to check current access.');
      }
      if (result.home?.id !== homeId) throw new Error('The requested home could not be confirmed.');
      ready.current = current;
      dispatch({ type: 'LOAD_COMPLETE', data: result });
    } catch (e: unknown) {
      if (!current()) return;
      ready.current = null;
      dispatch({
        type: 'LOAD_ERROR',
        error: e instanceof Error ? e.message : 'Current home access could not be confirmed. Reload to try again.',
      });
    }
  }, [homeId, router]);

  useEffect(() => {
    void loadDashboard();
    const invalidate = () => { retireGeneration(); dispatch({ type: 'LOAD_START' }); };
    const changed = () => { invalidate(); if (document.visibilityState !== 'hidden') void loadDashboard(); };
    const visibility = () => { if (document.visibilityState === 'hidden') invalidate(); else changed(); };
    const focus = () => { if (document.visibilityState !== 'hidden') changed(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) changed(); };
    const unsubscribe = api.onTokenChange(changed);
    window.addEventListener('storage', storage); window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visibility);
    return () => { retireGeneration(); unsubscribe(); window.removeEventListener('storage', storage);
      window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visibility); };
  }, [loadDashboard, retireGeneration]);

  // A record refresh also refreshes current grants and aggregate counts; a
  // partial reply cannot revive an earlier session or leave old summary totals.
  const refreshEntity = useCallback(async (_entity: keyof HomeDataEntities) => {
    await loadDashboard();
  }, [loadDashboard]);

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
    can,
    refresh: loadDashboard,
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
