import { test, expect, Page } from '@playwright/test';

// ============================================================
// Guest Pass E2E Tests
// Covers: create, preview, copy link, guest view, revoke
// ============================================================

const API = 'http://localhost:8000';
const TOKEN = 'fake-jwt-token-for-testing';
const GUEST_TOKEN = 'gp-token-abc123';

const MOCK_USER = {
  id: 'u1',
  email: 'yp.wangt@gmail.com',
  username: 'ypwang',
  firstName: 'YP',
  lastName: 'Wang',
  name: 'YP Wang',
  bio: '',
  avatar_url: null,
  created_at: '2024-01-01T00:00:00Z',
};

const MOCK_HOME = {
  id: 'h1',
  address: '123 Main St',
  address_line1: '123 Main St',
  name: 'My Place',
  lat: 37.77,
  lng: -122.42,
  created_at: '2024-01-01T00:00:00Z',
  owner_id: 'u1',
  members: [],
  home_type: 'house',
  visibility: 'private',
  trash_day: 'Tuesday',
  house_rules: 'No smoking indoors',
  local_tips: null,
  guest_welcome_message: 'Welcome to My Place!',
  entry_instructions: 'Code is 1234',
  parking_instructions: 'Park in driveway',
  default_visibility: 'members',
  default_guest_pass_hours: 24,
  lockdown_enabled: false,
};

const MOCK_HUB = {
  user: { id: 'u1', name: 'YP Wang', username: 'ypwang', avatarUrl: null, email: MOCK_USER.email },
  context: { activeHomeId: 'h1', activePersona: { type: 'personal' } },
  availability: { hasHome: true, hasBusiness: false },
  homes: [MOCK_HOME],
  businesses: [],
  setup: { steps: [], allDone: true },
  statusItems: [],
  cards: { personal: { unreadChats: 0 } },
  jumpBackIn: [],
  activity: [],
};

const MOCK_ACCESS = {
  hasAccess: true,
  isOwner: true,
  role_base: 'admin',
  permissions: [
    'home.view', 'home.edit', 'home.manage_members', 'home.manage_tasks',
    'home.manage_bills', 'home.manage_packages', 'home.manage_issues',
    'home.manage_documents', 'home.manage_vendors', 'home.manage_secrets',
    'home.manage_guests', 'home.view_audit', 'home.lockdown',
  ],
  occupancy: {
    id: 'occ1',
    role: 'owner',
    role_base: 'admin',
    start_at: '2024-01-01T00:00:00Z',
    end_at: null,
    age_band: null,
  },
};

const MOCK_WIFI_SECRET = {
  id: 'sec1',
  home_id: 'h1',
  access_type: 'wifi',
  label: 'Home WiFi',
  secret_value: 'MyWifiPassword123',
  notes: null,
  visibility: 'members',
  created_at: '2024-01-01T00:00:00Z',
};

const MOCK_GUEST_PASS = {
  id: 'gp1',
  home_id: 'h1',
  label: 'WiFi Only Pass',
  kind: 'wifi_only' as const,
  role_base: 'guest_wifi',
  included_sections: ['wifi'],
  custom_title: null,
  passcode_hash: null,
  max_views: null,
  view_count: 0,
  start_at: '2024-01-01T00:00:00Z',
  end_at: new Date(Date.now() + 86400000).toISOString(),
  revoked_at: null,
  created_at: '2024-01-01T00:00:00Z',
  status: 'active' as const,
  last_viewed_at: null,
};

const MOCK_GUEST_VIEW = {
  pass: {
    label: 'WiFi Only Pass',
    kind: 'wifi_only',
    custom_title: null,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    home_name: 'My Place',
    welcome_message: 'Welcome to My Place!',
  },
  sections: {
    wifi: { network_name: 'Home WiFi', password: 'MyWifiPassword123' },
    parking: 'Park in driveway',
  },
};

// Track created passes for list endpoint
let createdPasses: any[] = [];

async function mockGuestPassApi(page: Page) {
  createdPasses = [];

  await page.route(`${API}/**`, async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const path = url.replace(API, '');
    const pathname = path.split('?')[0];
    const json = (d: any, s = 200) =>
      route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(d) });

    // Auth
    if (path === '/api/users/login' && method === 'POST') return json({ token: TOKEN, user: MOCK_USER });
    if (path === '/api/users/me') return json(MOCK_USER);
    if (path.startsWith('/api/users/')) return json(MOCK_USER);

    // Hub
    if (path === '/api/hub') return json(MOCK_HUB);

    // Home IAM
    if (pathname === '/api/homes/h1/me') return json(MOCK_ACCESS);
    if (pathname === '/api/homes/h1/role-presets') return json({ presets: [] });
    if (pathname === '/api/homes/h1/role-templates') return json({ templates: [] });
    if (pathname === '/api/homes/h1/audit-log') return json({ entries: [] });

    // Dashboard aggregate
    if (pathname === '/api/homes/h1/dashboard' && method === 'GET') {
      return json({
        home: MOCK_HOME,
        members: [{ id: 'u1', user_id: 'u1', role: 'owner', role_base: 'admin', name: 'YP Wang', username: 'ypwang', avatar_url: null }],
        tasks: [],
        issues: [],
        bills: [],
        packages: [],
        events: [],
      });
    }

    // Individual home endpoints
    if (pathname === '/api/homes/h1/tasks' && method === 'GET') return json({ tasks: [] });
    if (pathname === '/api/homes/h1/issues' && method === 'GET') return json({ issues: [] });
    if (pathname === '/api/homes/h1/bills' && method === 'GET') return json({ bills: [] });
    if (pathname === '/api/homes/h1/packages' && method === 'GET') return json({ packages: [] });
    if (pathname === '/api/homes/h1/events' && method === 'GET') return json({ events: [] });
    if (pathname === '/api/homes/h1/documents' && method === 'GET') return json({ documents: [] });
    if (pathname === '/api/homes/h1/vendors' && method === 'GET') return json({ vendors: [] });
    if (pathname === '/api/homes/h1/access' && method === 'GET') return json({ secrets: [MOCK_WIFI_SECRET] });
    if (pathname === '/api/homes/h1/emergencies' && method === 'GET') return json({ emergencies: [] });
    if (pathname === '/api/homes/h1/occupants' && method === 'GET') return json({ occupants: [{ id: 'u1', user_id: 'u1', role: 'owner', role_base: 'admin', name: 'YP Wang' }], pendingInvites: [] });
    if (pathname === '/api/homes/h1/pets' && method === 'GET') return json({ pets: [] });
    if (pathname === '/api/homes/h1/polls' && method === 'GET') return json({ polls: [] });
    if (pathname === '/api/homes/h1/gigs' && method === 'GET') return json({ gigs: [] });
    if (pathname === '/api/homes/h1/nearby-gigs' && method === 'GET') return json({ gigs: [] });
    if (pathname === '/api/homes/h1/activity' && method === 'GET') return json({ activity: [], pagination: { page: 1, limit: 20, total: 0 } });
    if (pathname === '/api/homes/h1/businesses' && method === 'GET') return json({ links: [] });
    if (pathname === '/api/homes/h1/settings' && method === 'GET') return json({ home: MOCK_HOME, preferences: {} });

    // Guest Passes — CRUD
    if (pathname === '/api/homes/h1/guest-passes' && method === 'GET') {
      return json({ passes: createdPasses });
    }
    if (pathname === '/api/homes/h1/guest-passes' && method === 'POST') {
      const newPass = { ...MOCK_GUEST_PASS, id: `gp-${Date.now()}` };
      createdPasses.push(newPass);
      return json({ pass: newPass, token: GUEST_TOKEN }, 201);
    }
    if (pathname.match(/^\/api\/homes\/h1\/guest-passes\/[^/]+$/) && method === 'DELETE') {
      const passId = pathname.split('/').pop();
      const revokedPass = createdPasses.find((p) => p.id === passId);
      if (revokedPass) {
        revokedPass.revoked_at = new Date().toISOString();
        revokedPass.status = 'revoked';
      }
      return json({ message: 'Guest pass revoked', pass: revokedPass || { ...MOCK_GUEST_PASS, revoked_at: new Date().toISOString(), status: 'revoked' } });
    }

    // Guest view (public)
    if (pathname.match(/^\/api\/homes\/guest\/[^/]+$/) && method === 'GET') {
      const viewToken = pathname.split('/').pop();
      if (viewToken === 'revoked-token') {
        return json({ error: 'This pass has been revoked' }, 410);
      }
      if (viewToken === 'expired-token') {
        return json({ error: 'This pass has expired' }, 410);
      }
      return json(MOCK_GUEST_VIEW);
    }

    // Homes
    if (path === '/api/homes' && method === 'GET') return json({ homes: [MOCK_HOME] });
    if (pathname.match(/^\/api\/homes\/[^/]+$/) && method === 'GET') return json({ home: MOCK_HOME });

    // Catch-all
    if (path.includes('/api/chat')) return json({ conversations: [], totalUnread: 0, rooms: [], messages: [] });
    if (path.startsWith('/api/notifications')) return json({ notifications: [], total: 0 });
    if (path.startsWith('/api/mailbox')) return json({ items: [], total: 0 });
    if (pathname === '/api/geo/autocomplete') return json({ suggestions: [] });

    return json({ ok: true });
  });
}

async function authed(page: Page, path: string) {
  await mockGuestPassApi(page);
  await page.goto('/login');
  await page.evaluate((t) => {
    localStorage.setItem('token', t);
    document.cookie = `token=${t}; path=/`;
  }, TOKEN);
  await page.goto(path, { waitUntil: 'networkidle' });
}

// ============================================================
// TESTS
// ============================================================

test.describe('Guest Pass — Create Flow', () => {
  test('Share tab shows guest pass template options', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=share');

    // Should see template buttons
    await expect(page.getByText(/WiFi/i).first()).toBeVisible();
    await expect(page.getByText(/Guest/i).first()).toBeVisible();
  });

  test('can create a WiFi-only guest pass', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=share');

    // Click WiFi template
    const wifiBtn = page.getByRole('button', { name: /WiFi/i }).first();
    await wifiBtn.click();

    // Look for a Create button and click it
    const createBtn = page.getByRole('button', { name: /Create/i });
    await expect(createBtn.first()).toBeVisible();
    await createBtn.first().click();

    // Should see success state
    await expect(page.getByText(/Guest Pass Created|Created|Copy Link/i).first()).toBeVisible();
  });

  test('created pass shows copy link button', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=share');

    // Create a pass
    const wifiBtn = page.getByRole('button', { name: /WiFi/i }).first();
    await wifiBtn.click();

    const createBtn = page.getByRole('button', { name: /Create/i });
    await createBtn.first().click();

    // Should have a copy button
    await expect(page.getByText(/Copy|📋/i).first()).toBeVisible();
  });
});

test.describe('Guest Pass — Active Passes List', () => {
  test('shows "Active Passes" section on Share tab', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=share');
    await expect(page.getByText(/Active Passes|No active/i).first()).toBeVisible();
  });

  test('shows created pass in active passes list after creation', async ({ page }) => {
    // Pre-seed a guest pass in the mock
    createdPasses = [MOCK_GUEST_PASS];
    await authed(page, '/app/homes/h1/dashboard?tab=share');

    await expect(page.getByText('WiFi Only Pass')).toBeVisible();
  });

  test('shows revoke button for active pass', async ({ page }) => {
    createdPasses = [MOCK_GUEST_PASS];
    await authed(page, '/app/homes/h1/dashboard?tab=share');

    await expect(page.getByText('WiFi Only Pass')).toBeVisible();
    await expect(page.getByRole('button', { name: /Revoke/i }).first()).toBeVisible();
  });
});

test.describe('Guest Pass — Revoke', () => {
  test('revoking a pass updates its status', async ({ page }) => {
    createdPasses = [{ ...MOCK_GUEST_PASS }];
    await authed(page, '/app/homes/h1/dashboard?tab=share');

    await expect(page.getByText('WiFi Only Pass')).toBeVisible();

    // Click Revoke
    const revokeBtn = page.getByRole('button', { name: /Revoke/i }).first();
    await revokeBtn.click();

    // May show confirmation; click confirm if present
    const confirmBtn = page.getByRole('button', { name: /Confirm|Yes|Revoke/i });
    if (await confirmBtn.first().isVisible().catch(() => false)) {
      await confirmBtn.first().click();
    }

    // Should reflect revocation — either "Revoked" status or pass disappears
    await page.waitForTimeout(500);
    // The pass should now be marked as revoked or removed from active list
    const revokedText = page.getByText(/Revoked|revoked/i);
    const noActive = page.getByText(/No active/i);
    const either = await revokedText.isVisible().catch(() => false) || await noActive.isVisible().catch(() => false);
    expect(either).toBeTruthy();
  });
});

test.describe('Guest Pass — Guest View (Public)', () => {
  test('guest view shows WiFi and parking sections', async ({ page }) => {
    // Mock only the guest endpoint (public, no auth needed)
    await page.route(`${API}/**`, async (route) => {
      const url = route.request().url();
      const pathname = url.replace(API, '').split('?')[0];
      const json = (d: any, s = 200) =>
        route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(d) });

      if (pathname.match(/^\/api\/homes\/guest\/[^/]+$/)) {
        return json(MOCK_GUEST_VIEW);
      }
      // Hub/user calls might happen from layout
      if (pathname === '/api/hub') return json({ user: null, context: {}, availability: {}, homes: [], businesses: [], setup: { steps: [], allDone: true }, statusItems: [], cards: {}, jumpBackIn: [], activity: [] });
      if (pathname === '/api/users/me') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Not authenticated' }) });

      return json({ ok: true });
    });

    await page.goto(`/guest/${GUEST_TOKEN}`, { waitUntil: 'networkidle' });

    // Should show guest access content
    await expect(page.getByText(/Guest Access|WiFi|Wi-Fi/i).first()).toBeVisible();
    // WiFi section
    await expect(page.getByText(/Home WiFi|MyWifiPassword123/i).first()).toBeVisible();
    // Parking section
    await expect(page.getByText(/Park in driveway|Parking/i).first()).toBeVisible();
  });

  test('guest view shows home name', async ({ page }) => {
    await page.route(`${API}/**`, async (route) => {
      const url = route.request().url();
      const pathname = url.replace(API, '').split('?')[0];
      const json = (d: any, s = 200) =>
        route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(d) });

      if (pathname.match(/^\/api\/homes\/guest\/[^/]+$/)) return json(MOCK_GUEST_VIEW);
      if (pathname === '/api/hub') return json({ user: null, context: {}, availability: {}, homes: [], businesses: [], setup: { steps: [], allDone: true }, statusItems: [], cards: {}, jumpBackIn: [], activity: [] });
      if (pathname === '/api/users/me') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Not authenticated' }) });
      return json({ ok: true });
    });

    await page.goto(`/guest/${GUEST_TOKEN}`, { waitUntil: 'networkidle' });

    await expect(page.getByText('My Place')).toBeVisible();
  });

  test('guest view shows welcome message', async ({ page }) => {
    await page.route(`${API}/**`, async (route) => {
      const url = route.request().url();
      const pathname = url.replace(API, '').split('?')[0];
      const json = (d: any, s = 200) =>
        route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(d) });

      if (pathname.match(/^\/api\/homes\/guest\/[^/]+$/)) return json(MOCK_GUEST_VIEW);
      if (pathname === '/api/hub') return json({ user: null, context: {}, availability: {}, homes: [], businesses: [], setup: { steps: [], allDone: true }, statusItems: [], cards: {}, jumpBackIn: [], activity: [] });
      if (pathname === '/api/users/me') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Not authenticated' }) });
      return json({ ok: true });
    });

    await page.goto(`/guest/${GUEST_TOKEN}`, { waitUntil: 'networkidle' });

    await expect(page.getByText('Welcome to My Place!')).toBeVisible();
  });

  test('revoked guest pass shows revoked state', async ({ page }) => {
    await page.route(`${API}/**`, async (route) => {
      const url = route.request().url();
      const pathname = url.replace(API, '').split('?')[0];
      const json = (d: any, s = 200) =>
        route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(d) });

      if (pathname.match(/^\/api\/homes\/guest\/[^/]+$/)) {
        return json({ error: 'This pass has been revoked' }, 410);
      }
      if (pathname === '/api/hub') return json({ user: null, context: {}, availability: {}, homes: [], businesses: [], setup: { steps: [], allDone: true }, statusItems: [], cards: {}, jumpBackIn: [], activity: [] });
      if (pathname === '/api/users/me') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Not authenticated' }) });
      return json({ ok: true });
    });

    await page.goto('/guest/revoked-token', { waitUntil: 'networkidle' });

    // Should show revoked state
    await expect(page.getByText(/Revoked|revoked|no longer available/i).first()).toBeVisible();
  });

  test('expired guest pass shows expired state', async ({ page }) => {
    await page.route(`${API}/**`, async (route) => {
      const url = route.request().url();
      const pathname = url.replace(API, '').split('?')[0];
      const json = (d: any, s = 200) =>
        route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(d) });

      if (pathname.match(/^\/api\/homes\/guest\/[^/]+$/)) {
        return json({ error: 'This pass has expired' }, 410);
      }
      if (pathname === '/api/hub') return json({ user: null, context: {}, availability: {}, homes: [], businesses: [], setup: { steps: [], allDone: true }, statusItems: [], cards: {}, jumpBackIn: [], activity: [] });
      if (pathname === '/api/users/me') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Not authenticated' }) });
      return json({ ok: true });
    });

    await page.goto('/guest/expired-token', { waitUntil: 'networkidle' });

    await expect(page.getByText(/Expired|expired|no longer available/i).first()).toBeVisible();
  });
});
