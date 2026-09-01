/**
 * Tests for useHomePermissions hook + HomePermissionsProvider.
 *
 * Validates canSeeTab, needsVerification, isProvisional, and
 * error/loading state handling — the frontend never reads role
 * strings directly; only the 5 nav booleans gate navigation.
 */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  HomePermissionsProvider,
  useHomePermissions,
  type HomeAccess,
  type TabName,
} from '../../src/components/home/useHomePermissions';

// ── Mock @pantopus/api ──────────────────────────────────────
const mockGet = jest.fn();
jest.mock('@pantopus/api', () => ({
  get: (...args: unknown[]) => mockGet(...args),
}));

// ── Helpers ─────────────────────────────────────────────────

function buildAccess(overrides: Partial<HomeAccess> = {}): HomeAccess {
  return {
    hasAccess: true,
    isOwner: false,
    role_base: 'member',
    permissions: [],
    occupancy: null,
    can_manage_home: false,
    can_manage_access: false,
    can_manage_finance: false,
    can_manage_tasks: false,
    can_view_sensitive: false,
    verification_status: 'verified',
    is_in_challenge_window: false,
	    challenge_window_ends_at: null,
	    postcard_expires_at: null,
	    is_in_claim_window: false,
	    claim_window_ends_at: null,
	    is_owner: false,
    age_band: null,
    occupancy_id: null,
    ...overrides,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <HomePermissionsProvider homeId="test-home-id">
      {children}
    </HomePermissionsProvider>
  );
}

beforeEach(() => {
  mockGet.mockReset();
});

// ============================================================
// canSeeTab
// ============================================================

describe('canSeeTab', () => {
  const TAB_CASES: Array<{
    role: string;
    booleans: Partial<HomeAccess>;
    expected: Record<TabName, boolean>;
  }> = [
    {
      role: 'owner (all true)',
      booleans: {
        can_manage_home: true,
        can_manage_access: true,
        can_manage_finance: true,
        can_manage_tasks: true,
        can_view_sensitive: true,
      },
      expected: { tasks: true, bills: true, members: true, settings: true, sensitive: true },
    },
    {
      role: 'admin (no finance)',
      booleans: {
        can_manage_home: true,
        can_manage_access: true,
        can_manage_finance: false,
        can_manage_tasks: true,
        can_view_sensitive: true,
      },
      expected: { tasks: true, bills: false, members: true, settings: true, sensitive: true },
    },
    {
      role: 'member (tasks + sensitive only)',
      booleans: {
        can_manage_home: false,
        can_manage_access: false,
        can_manage_finance: false,
        can_manage_tasks: true,
        can_view_sensitive: true,
      },
      expected: { tasks: true, bills: false, members: false, settings: false, sensitive: true },
    },
    {
      role: 'guest (all false)',
      booleans: {
        can_manage_home: false,
        can_manage_access: false,
        can_manage_finance: false,
        can_manage_tasks: false,
        can_view_sensitive: false,
      },
      expected: { tasks: false, bills: false, members: false, settings: false, sensitive: false },
    },
    {
      role: 'manager (home + tasks)',
      booleans: {
        can_manage_home: true,
        can_manage_access: false,
        can_manage_finance: false,
        can_manage_tasks: true,
        can_view_sensitive: false,
      },
      expected: { tasks: true, bills: false, members: false, settings: true, sensitive: false },
    },
  ];

  test.each(TAB_CASES)(
    'returns correct tab visibility for $role',
    async ({ booleans, expected }) => {
      mockGet.mockResolvedValueOnce(buildAccess(booleans));

      const { result } = renderHook(() => useHomePermissions(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      for (const [tab, visible] of Object.entries(expected)) {
        expect(result.current.canSeeTab(tab as TabName)).toBe(visible);
      }
    },
  );

  test('returns false for all tabs when access is null (loading)', () => {
    // Use the default context (no provider) which has access=null
    const { result } = renderHook(() => useHomePermissions());

    const tabs: TabName[] = ['tasks', 'bills', 'members', 'settings', 'sensitive'];
    for (const tab of tabs) {
      expect(result.current.canSeeTab(tab)).toBe(false);
    }
  });
});

// ============================================================
// needsVerification
// ============================================================

describe('needsVerification', () => {
  const NON_VERIFIED_STATUSES = [
    'provisional',
    'provisional_bootstrap',
    'pending_postcard',
    'pending_doc',
    'pending_approval',
    'unverified',
    'suspended_challenged',
    'moved_out',
  ];

  test.each(NON_VERIFIED_STATUSES)(
    'is true for verification_status=%s',
    async (status) => {
      mockGet.mockResolvedValueOnce(buildAccess({ verification_status: status }));

      const { result } = renderHook(() => useHomePermissions(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.needsVerification).toBe(true);
    },
  );

  test('is false when verification_status=verified', async () => {
    mockGet.mockResolvedValueOnce(buildAccess({ verification_status: 'verified' }));

    const { result } = renderHook(() => useHomePermissions(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.needsVerification).toBe(false);
  });

  test('is true when access is null (still loading or error)', () => {
    // Default context (no provider)
    const { result } = renderHook(() => useHomePermissions());
    expect(result.current.needsVerification).toBe(true);
  });
});

// ============================================================
// isProvisional
// ============================================================

describe('isProvisional', () => {
  test('is true for provisional', async () => {
    mockGet.mockResolvedValueOnce(buildAccess({ verification_status: 'provisional' }));

    const { result } = renderHook(() => useHomePermissions(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isProvisional).toBe(true);
  });

  test('is true for provisional_bootstrap', async () => {
    mockGet.mockResolvedValueOnce(buildAccess({ verification_status: 'provisional_bootstrap' }));

    const { result } = renderHook(() => useHomePermissions(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isProvisional).toBe(true);
  });

  test('is false for verified', async () => {
    mockGet.mockResolvedValueOnce(buildAccess({ verification_status: 'verified' }));

    const { result } = renderHook(() => useHomePermissions(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isProvisional).toBe(false);
  });

  test('is false for pending_postcard', async () => {
    mockGet.mockResolvedValueOnce(buildAccess({ verification_status: 'pending_postcard' }));

    const { result } = renderHook(() => useHomePermissions(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isProvisional).toBe(false);
  });

  test('is false for pending_approval', async () => {
    mockGet.mockResolvedValueOnce(buildAccess({ verification_status: 'pending_approval' }));

    const { result } = renderHook(() => useHomePermissions(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isProvisional).toBe(false);
  });
});

// ============================================================
// Loading state
// ============================================================

describe('loading state', () => {
  test('starts as loading=true, then resolves', async () => {
    let resolveApi: (value: HomeAccess) => void;
    const apiPromise = new Promise<HomeAccess>((resolve) => { resolveApi = resolve; });
    mockGet.mockReturnValueOnce(apiPromise);

    const { result } = renderHook(() => useHomePermissions(), { wrapper });

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.access).toBeNull();

    // Resolve
    await act(async () => {
      resolveApi!(buildAccess());
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.access).not.toBeNull();
  });
});

// ============================================================
// Error state
// ============================================================

describe('error state', () => {
  test('on API error, sets error and defaults to no access', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useHomePermissions(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network failure');
    expect(result.current.access).not.toBeNull();
    expect(result.current.access!.hasAccess).toBe(false);
    expect(result.current.access!.verification_status).toBe('unverified');

    // All booleans false in error state
    expect(result.current.access!.can_manage_home).toBe(false);
    expect(result.current.access!.can_manage_access).toBe(false);
    expect(result.current.access!.can_manage_finance).toBe(false);
    expect(result.current.access!.can_manage_tasks).toBe(false);
    expect(result.current.access!.can_view_sensitive).toBe(false);

    // All tabs hidden
    const tabs: TabName[] = ['tasks', 'bills', 'members', 'settings', 'sensitive'];
    for (const tab of tabs) {
      expect(result.current.canSeeTab(tab)).toBe(false);
    }

    // Needs verification in error state
    expect(result.current.needsVerification).toBe(true);
  });
});
