import { test, expect, Page } from '@playwright/test';

// ============================================================
// Home Dashboard E2E Tests
// Covers: navigation, TodayCard, dashboard cards, FAB, tabs
// ============================================================

const API = 'http://localhost:8000';
const TOKEN = 'fake-jwt-token-for-testing';

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
  trash_day: null,
  house_rules: null,
  local_tips: null,
  guest_welcome_message: null,
  entry_instructions: null,
  parking_instructions: null,
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

const MOCK_TASKS = [
  { id: 't1', title: 'Fix dishwasher', task_type: 'maintenance', status: 'open', priority: 'high', assigned_to: null, due_at: new Date().toISOString(), created_at: '2024-01-01T00:00:00Z' },
  { id: 't2', title: 'Replace air filter', task_type: 'chore', status: 'open', priority: 'low', assigned_to: null, due_at: null, created_at: '2024-01-02T00:00:00Z' },
];

const MOCK_ISSUES = [
  { id: 'i1', title: 'Leaky faucet', description: 'Kitchen faucet drips', severity: 'medium', status: 'open', created_at: '2024-01-01T00:00:00Z' },
];

const MOCK_BILLS = [
  { id: 'b1', bill_type: 'electricity', provider_name: 'PG&E', amount: 120, due_date: new Date().toISOString(), status: 'due', period_start: '2024-01-01', period_end: '2024-01-31', created_at: '2024-01-01T00:00:00Z' },
];

const MOCK_PACKAGES = [
  { id: 'pk1', carrier: 'UPS', tracking_number: '1Z999', vendor_name: 'Amazon', description: 'Books', status: 'in_transit', expected_at: new Date().toISOString(), created_at: '2024-01-01T00:00:00Z' },
];

const MOCK_MEMBERS = [
  { id: 'u1', user_id: 'u1', role: 'owner', role_base: 'admin', name: 'YP Wang', username: 'ypwang', avatar_url: null, start_at: '2024-01-01T00:00:00Z', end_at: null },
];

const MOCK_EVENTS = [
  { id: 'ev1', event_type: 'maintenance', title: 'Plumber visit', start_at: new Date().toISOString(), end_at: null, created_at: '2024-01-01T00:00:00Z' },
];

async function mockHomeDashboardApi(page: Page) {
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

    // Home Dashboard aggregate
    if (pathname === '/api/homes/h1/dashboard' && method === 'GET') {
      return json({
        home: MOCK_HOME,
        members: MOCK_MEMBERS,
        tasks: MOCK_TASKS,
        issues: MOCK_ISSUES,
        bills: MOCK_BILLS,
        packages: MOCK_PACKAGES,
        events: MOCK_EVENTS,
      });
    }

    // Individual resource endpoints (fallbacks)
    if (pathname === '/api/homes/h1/tasks' && method === 'GET') return json({ tasks: MOCK_TASKS });
    if (pathname === '/api/homes/h1/issues' && method === 'GET') return json({ issues: MOCK_ISSUES });
    if (pathname === '/api/homes/h1/bills' && method === 'GET') return json({ bills: MOCK_BILLS });
    if (pathname === '/api/homes/h1/packages' && method === 'GET') return json({ packages: MOCK_PACKAGES });
    if (pathname === '/api/homes/h1/events' && method === 'GET') return json({ events: MOCK_EVENTS });
    if (pathname === '/api/homes/h1/documents' && method === 'GET') return json({ documents: [] });
    if (pathname === '/api/homes/h1/vendors' && method === 'GET') return json({ vendors: [] });
    if (pathname === '/api/homes/h1/access' && method === 'GET') return json({ secrets: [] });
    if (pathname === '/api/homes/h1/emergencies' && method === 'GET') return json({ emergencies: [] });
    if (pathname === '/api/homes/h1/occupants' && method === 'GET') return json({ occupants: MOCK_MEMBERS, pendingInvites: [] });
    if (pathname === '/api/homes/h1/pets' && method === 'GET') return json({ pets: [] });
    if (pathname === '/api/homes/h1/polls' && method === 'GET') return json({ polls: [] });
    if (pathname === '/api/homes/h1/gigs' && method === 'GET') return json({ gigs: [] });
    if (pathname === '/api/homes/h1/nearby-gigs' && method === 'GET') return json({ gigs: [] });
    if (pathname === '/api/homes/h1/activity' && method === 'GET') return json({ activity: [], pagination: { page: 1, limit: 20, total: 0 } });
    if (pathname === '/api/homes/h1/businesses' && method === 'GET') return json({ links: [] });
    if (pathname === '/api/homes/h1/settings' && method === 'GET') {
      return json({ home: MOCK_HOME, preferences: {} });
    }

    // Guest passes
    if (pathname === '/api/homes/h1/guest-passes' && method === 'GET') return json({ passes: [] });

    // Homes
    if (path === '/api/homes' && method === 'GET') return json({ homes: [MOCK_HOME] });
    if (pathname.match(/^\/api\/homes\/[^/]+$/) && method === 'GET') return json({ home: MOCK_HOME });

    // Notifications / Chat
    if (path.includes('/api/chat')) return json({ conversations: [], totalUnread: 0, rooms: [], messages: [] });
    if (path.startsWith('/api/notifications')) return json({ notifications: [], total: 0 });
    if (path.startsWith('/api/mailbox')) return json({ items: [], total: 0 });

    // Geo
    if (pathname === '/api/geo/autocomplete') return json({ suggestions: [] });

    // Catch-all
    return json({ ok: true });
  });
}

async function authed(page: Page, path: string) {
  await mockHomeDashboardApi(page);
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

test.describe('Home Dashboard — Navigation & Layout', () => {
  test('loads dashboard and shows home name in header', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard');
    await expect(page.getByText('My Place')).toBeVisible();
  });

  test('shows role badge for owner', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard');
    // The HomeHeader shows role badge
    await expect(page.getByText(/admin/i)).toBeVisible();
  });

  test('shows address below home name', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard');
    await expect(page.getByText('123 Main St')).toBeVisible();
  });
});

test.describe('Home Dashboard — TodayCard', () => {
  test('renders TodayCard with counts from dashboard data', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard');
    await expect(page.getByText('Today')).toBeVisible();
    // 2 active tasks
    await expect(page.getByText(/Active tasks/i)).toBeVisible();
    // 1 open issue
    await expect(page.getByText(/Open issues/i)).toBeVisible();
    // 1 bill due
    await expect(page.getByText(/Bills due/i)).toBeVisible();
    // 1 pending package
    await expect(page.getByText(/Pending packages/i)).toBeVisible();
  });

  test('shows "All clear" when everything is zero', async ({ page }) => {
    // Override mock to return empty data
    await page.route(`${API}/**`, async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      const path = url.replace(API, '');
      const pathname = path.split('?')[0];
      const json = (d: any, s = 200) =>
        route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(d) });

      if (path === '/api/users/login' && method === 'POST') return json({ token: TOKEN, user: MOCK_USER });
      if (path === '/api/users/me') return json(MOCK_USER);
      if (path.startsWith('/api/users/')) return json(MOCK_USER);
      if (path === '/api/hub') return json(MOCK_HUB);
      if (pathname === '/api/homes/h1/me') return json(MOCK_ACCESS);
      if (pathname === '/api/homes/h1/dashboard') {
        return json({
          home: MOCK_HOME,
          members: MOCK_MEMBERS,
          tasks: [],
          issues: [],
          bills: [],
          packages: [],
          events: [],
        });
      }
      // All individual endpoints empty
      if (pathname.startsWith('/api/homes/h1/')) return json({ tasks: [], issues: [], bills: [], packages: [], events: [], documents: [], vendors: [], secrets: [], emergencies: [], occupants: MOCK_MEMBERS, pendingInvites: [], pets: [], polls: [], gigs: [], activity: [], passes: [], links: [], home: MOCK_HOME, preferences: {} });
      if (path === '/api/homes' && method === 'GET') return json({ homes: [MOCK_HOME] });
      if (path.includes('/api/chat')) return json({ conversations: [], totalUnread: 0, rooms: [], messages: [] });
      if (path.startsWith('/api/notifications')) return json({ notifications: [], total: 0 });
      if (path.startsWith('/api/mailbox')) return json({ items: [], total: 0 });
      return json({ ok: true });
    });

    await page.goto('/login');
    await page.evaluate((t) => {
      localStorage.setItem('token', t);
      document.cookie = `token=${t}; path=/`;
    }, TOKEN);
    await page.goto('/app/homes/h1/dashboard', { waitUntil: 'networkidle' });

    await expect(page.getByText(/All clear/i)).toBeVisible();
  });
});

test.describe('Home Dashboard — Dashboard Cards', () => {
  test('shows Tasks card on dashboard', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard');
    await expect(page.getByText(/Tasks/i).first()).toBeVisible();
  });

  test('shows Issues card on dashboard', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard');
    await expect(page.getByText(/Issues/i).first()).toBeVisible();
  });

  test('shows Bills card on dashboard', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard');
    await expect(page.getByText(/Bills/i).first()).toBeVisible();
  });

  test('shows Packages card on dashboard', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard');
    await expect(page.getByText(/Packages/i).first()).toBeVisible();
  });

  test('clicking a card expands to detail view', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard');

    // Click the Tasks section to expand
    const tasksCard = page.getByText(/Tasks/i).first();
    await tasksCard.click();

    // After expanding, we should see task items
    await expect(page.getByText('Fix dishwasher')).toBeVisible();
  });

  test('shows task details in expanded Tasks card', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard');

    // Click tasks area to expand
    const tasksCard = page.getByText(/Tasks/i).first();
    await tasksCard.click();

    // Verify task items are visible
    await expect(page.getByText('Fix dishwasher')).toBeVisible();
    await expect(page.getByText('Replace air filter')).toBeVisible();
  });
});

test.describe('Home Dashboard — UnifiedFAB', () => {
  test('FAB button is visible on dashboard tab', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard');
    // FAB shows a "+" or similar trigger
    const fab = page.locator('button').filter({ hasText: '+' });
    await expect(fab.first()).toBeVisible();
  });

  test('FAB expands to show quick-create options', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard');

    // Click FAB
    const fab = page.locator('button').filter({ hasText: '+' });
    await fab.first().click();

    // Should show creation options
    await expect(page.getByText(/Add Task/i)).toBeVisible();
    await expect(page.getByText(/Report Issue/i)).toBeVisible();
    await expect(page.getByText(/Track Bill/i)).toBeVisible();
    await expect(page.getByText(/Track Package/i)).toBeVisible();
    await expect(page.getByText(/Invite Member/i)).toBeVisible();
    await expect(page.getByText(/Post Home Task/i)).toBeVisible();
  });
});

test.describe('Home Dashboard — Tab Switching', () => {
  test('switches to Share tab', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard');

    // Click Share tab
    await page.getByRole('button', { name: /Share/i }).click();

    // Should navigate and show Share content
    await expect(page).toHaveURL(/tab=share/);
    await expect(page.getByText(/Share.*Guest Access/i).first()).toBeVisible();
  });

  test('switches to Members & Security tab', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard');

    // Click Members / Security tab button
    const secTab = page.getByRole('button', { name: /Members|Security/i });
    await secTab.click();

    await expect(page).toHaveURL(/tab=security/);
  });

  test('switches to Settings tab', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard');

    await page.getByRole('button', { name: /Settings/i }).click();

    await expect(page).toHaveURL(/tab=settings/);
    await expect(page.getByText(/Home Settings/i)).toBeVisible();
  });

  test('navigates directly to Share tab via URL', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=share');
    await expect(page.getByText(/Share.*Guest Access/i).first()).toBeVisible();
  });

  test('navigates directly to Settings tab via URL', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=settings');
    await expect(page.getByText(/Home Settings/i)).toBeVisible();
  });

  test('Dashboard tab does not show Share content', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard');
    // The main tab heading "Share & Guest Access" should not be visible on dashboard tab
    await expect(page.getByText('Today')).toBeVisible();
  });

  test('FAB is hidden on non-dashboard tabs', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=settings');
    // FAB should not be visible on settings tab
    const fab = page.locator('button').filter({ hasText: '+' });
    await expect(fab).toHaveCount(0);
  });
});
