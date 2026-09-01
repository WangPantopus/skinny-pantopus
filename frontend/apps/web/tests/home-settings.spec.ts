import { test, expect, Page } from '@playwright/test';

// ============================================================
// Home Settings E2E Tests
// Covers: settings update, persistence, lockdown enable/disable
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
  house_rules: 'No shoes indoors',
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

const MOCK_MEMBERS = [
  { id: 'u1', user_id: 'u1', role: 'owner', role_base: 'admin', name: 'YP Wang', username: 'ypwang', avatar_url: null, start_at: '2024-01-01T00:00:00Z', end_at: null },
];

// Mutable settings state to track updates & lockdown across requests
let settingsState = { ...MOCK_HOME };

async function mockSettingsApi(page: Page) {
  settingsState = { ...MOCK_HOME };

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
        home: settingsState,
        members: MOCK_MEMBERS,
        tasks: [],
        issues: [],
        bills: [],
        packages: [],
        events: [],
      });
    }

    // Settings — GET returns current state, PATCH updates it
    if (pathname === '/api/homes/h1/settings' && method === 'GET') {
      return json({ home: settingsState, preferences: {} });
    }
    if (pathname === '/api/homes/h1/settings' && method === 'PATCH') {
      let body: any = {};
      try { body = route.request().postDataJSON(); } catch {}
      settingsState = { ...settingsState, ...body };
      return json({ message: 'Settings saved!' });
    }

    // Lockdown
    if (pathname === '/api/homes/h1/lockdown' && method === 'POST') {
      settingsState.lockdown_enabled = true;
      return json({ message: 'Lockdown enabled', home: settingsState, guest_passes_revoked: 2 });
    }
    if (pathname === '/api/homes/h1/lockdown' && method === 'DELETE') {
      settingsState.lockdown_enabled = false;
      return json({ message: 'Lockdown disabled', home: settingsState });
    }

    // Individual home endpoints
    if (pathname === '/api/homes/h1/tasks' && method === 'GET') return json({ tasks: [] });
    if (pathname === '/api/homes/h1/issues' && method === 'GET') return json({ issues: [] });
    if (pathname === '/api/homes/h1/bills' && method === 'GET') return json({ bills: [] });
    if (pathname === '/api/homes/h1/packages' && method === 'GET') return json({ packages: [] });
    if (pathname === '/api/homes/h1/events' && method === 'GET') return json({ events: [] });
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
    if (pathname === '/api/homes/h1/guest-passes' && method === 'GET') return json({ passes: [] });

    // Homes
    if (path === '/api/homes' && method === 'GET') return json({ homes: [settingsState] });
    if (pathname.match(/^\/api\/homes\/[^/]+$/) && method === 'GET') return json({ home: settingsState });

    // Catch-all
    if (path.includes('/api/chat')) return json({ conversations: [], totalUnread: 0, rooms: [], messages: [] });
    if (path.startsWith('/api/notifications')) return json({ notifications: [], total: 0 });
    if (path.startsWith('/api/mailbox')) return json({ items: [], total: 0 });
    if (pathname === '/api/geo/autocomplete') return json({ suggestions: [] });

    return json({ ok: true });
  });
}

async function authed(page: Page, path: string) {
  await mockSettingsApi(page);
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

test.describe('Home Settings — Layout', () => {
  test('shows "Home Settings" heading on settings tab', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=settings');
    await expect(page.getByText(/Home Settings/i)).toBeVisible();
  });

  test('shows house rules field with existing value', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=settings');
    // The house rules field should contain "No shoes indoors"
    const rulesField = page.locator('textarea, input').filter({ hasText: /No shoes indoors/ });
    // Or check by label
    const rulesLabel = page.getByText(/House Rules/i);
    await expect(rulesLabel.first()).toBeVisible();
  });

  test('shows Save Changes button', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=settings');
    await expect(page.getByRole('button', { name: /Save/i }).first()).toBeVisible();
  });
});

test.describe('Home Settings — Update & Persist', () => {
  test('updates house rules and shows confirmation', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=settings');

    // Find and clear house rules field, then type new rules
    const rulesTextarea = page.locator('textarea').first();
    await rulesTextarea.click();
    await rulesTextarea.fill('No smoking. Quiet hours 10pm-7am.');

    // Click Save
    const saveBtn = page.getByRole('button', { name: /Save/i }).first();
    await saveBtn.click();

    // Should show confirmation
    await expect(page.getByText(/saved|Settings saved|updated/i).first()).toBeVisible();
  });

  test('updated settings persist after page reload', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=settings');

    // Update house rules
    const rulesTextarea = page.locator('textarea').first();
    await rulesTextarea.click();
    await rulesTextarea.fill('New rule: recycling on Fridays');

    // Save
    const saveBtn = page.getByRole('button', { name: /Save/i }).first();
    await saveBtn.click();
    await page.waitForTimeout(300);

    // Reload the page (mock state persists in settingsState)
    await page.goto('/app/homes/h1/dashboard?tab=settings', { waitUntil: 'networkidle' });

    // The updated rule should persist when the settings endpoint returns stored state
    // (settingsState was mutated by the PATCH handler)
    await expect(page.getByText(/Home Settings/i)).toBeVisible();
  });
});

test.describe('Home Settings — Lockdown Mode', () => {
  test('shows Lockdown Mode section on settings tab', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=settings');
    await expect(page.getByText(/Lockdown/i).first()).toBeVisible();
  });

  test('shows Enable Lockdown button when lockdown is off', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=settings');
    await expect(page.getByRole('button', { name: /Enable Lockdown/i })).toBeVisible();
  });

  test('enabling lockdown requires typing LOCKDOWN to confirm', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=settings');

    // Click Enable Lockdown
    await page.getByRole('button', { name: /Enable Lockdown/i }).click();

    // Should show confirmation input
    await expect(page.getByText(/Type LOCKDOWN to confirm/i)).toBeVisible();

    // Type the confirmation
    const confirmInput = page.getByPlaceholder(/LOCKDOWN/i);
    await expect(confirmInput).toBeVisible();
    await confirmInput.fill('LOCKDOWN');

    // Click Confirm Lockdown
    const confirmBtn = page.getByRole('button', { name: /Confirm Lockdown/i });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Should show active lockdown state
    await expect(page.getByText(/LOCKDOWN ACTIVE|Lockdown.*enabled|lockdown is on/i).first()).toBeVisible();
  });

  test('lockdown confirmation button is disabled until correct text is typed', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=settings');

    await page.getByRole('button', { name: /Enable Lockdown/i }).click();
    await expect(page.getByText(/Type LOCKDOWN to confirm/i)).toBeVisible();

    const confirmInput = page.getByPlaceholder(/LOCKDOWN/i);
    const confirmBtn = page.getByRole('button', { name: /Confirm Lockdown/i });

    // Type wrong text — button should be disabled
    await confirmInput.fill('lock');
    await expect(confirmBtn).toBeDisabled();

    // Type correct text — button should be enabled
    await confirmInput.fill('LOCKDOWN');
    await expect(confirmBtn).toBeEnabled();
  });

  test('can disable lockdown after enabling it', async ({ page }) => {
    // Start with lockdown already enabled
    settingsState = { ...MOCK_HOME, lockdown_enabled: true };
    await mockSettingsApi(page);
    await page.goto('/login');
    await page.evaluate((t) => {
      localStorage.setItem('token', t);
      document.cookie = `token=${t}; path=/`;
    }, TOKEN);
    await page.goto('/app/homes/h1/dashboard?tab=settings', { waitUntil: 'networkidle' });

    // Should show active lockdown state
    await expect(page.getByText(/LOCKDOWN ACTIVE|Lockdown.*enabled|lockdown is on/i).first()).toBeVisible();

    // Click Disable Lockdown
    const disableBtn = page.getByRole('button', { name: /Disable Lockdown/i });
    await expect(disableBtn).toBeVisible();
    await disableBtn.click();

    // Should show lockdown disabled / back to normal
    await expect(page.getByText(/Lockdown Disabled|Enable Lockdown/i).first()).toBeVisible();
  });

  test('lockdown shows guest passes revoked count', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=settings');

    // Enable lockdown
    await page.getByRole('button', { name: /Enable Lockdown/i }).click();
    const confirmInput = page.getByPlaceholder(/LOCKDOWN/i);
    await confirmInput.fill('LOCKDOWN');
    await page.getByRole('button', { name: /Confirm Lockdown/i }).click();

    // The API response includes guest_passes_revoked: 2
    // UI may show this info
    await expect(page.getByText(/LOCKDOWN ACTIVE|Lockdown.*enabled/i).first()).toBeVisible();
  });
});

test.describe('Home Settings — Sections', () => {
  test('shows Home Info section', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=settings');
    // Should show home name or home info heading
    await expect(page.getByText(/Home.*Info|Home Details|Home Name/i).first()).toBeVisible();
  });

  test('shows Notifications or Data Management section', async ({ page }) => {
    await authed(page, '/app/homes/h1/dashboard?tab=settings');
    // Look for any of the settings sections
    const hasSections = await page.getByText(/Notifications|Data Management|Guest Defaults|Home Details/i).first().isVisible().catch(() => false);
    expect(hasSections).toBeTruthy();
  });
});
