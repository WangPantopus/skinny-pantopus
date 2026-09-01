import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8000';
const TOKEN = 'fake-jwt-token-for-testing';
const USER_A = { email: 'yp.wangt@gmail.com', password: 'test123123' };

const MOCK_USER = { id: 'u1', email: USER_A.email, username: 'ypwang', firstName: 'YP', lastName: 'Wang', name: 'YP Wang', bio: '', avatar_url: null, created_at: '2024-01-01T00:00:00Z' };
const MOCK_GIG = { id: 'g1', title: 'Fix faucet', description: 'Leaky faucet', category: 'Home Repair', price: 75, status: 'open', created_at: new Date().toISOString(), poster_id: 'u1', poster: MOCK_USER, tags: [], is_urgent: false, bids: [] };
const MOCK_LISTING = { id: 'l1', title: 'Desk Lamp', description: 'Nice lamp', price: 45, category: 'furniture', condition: 'good', status: 'active', images: [], seller_id: 'u1', created_at: new Date().toISOString() };
const MOCK_HOME = { id: 'h1', address: '123 Main St', name: 'My Place', lat: 37.77, lng: -122.42, created_at: '2024-01-01T00:00:00Z', owner_id: 'u1', members: [] };
const MOCK_POST = { id: 'p1', content: 'Lost golden retriever near park', post_type: 'lost_found', created_at: new Date().toISOString(), author_id: 'u1', author: MOCK_USER, comments_count: 0, likes_count: 0 };
const MOCK_BIZ = { id: 'b1', name: 'Wang Co', description: 'Consulting', category: 'Services', owner_id: 'u1', created_at: '2024-01-01T00:00:00Z', hours: {}, team: [], offers: [] };

const MOCK_HUB = {
  user: { id: 'u1', name: 'YP Wang', username: 'ypwang', avatarUrl: null, email: USER_A.email },
  context: { activeHomeId: null, activePersona: { type: 'personal' } },
  availability: { hasHome: false, hasBusiness: false },
  homes: [],
  businesses: [],
  setup: { steps: [], allDone: true },
  statusItems: [],
  cards: { personal: { unreadChats: 0 } },
  jumpBackIn: [],
  activity: [],
};

async function mockApi(page: Page) {
  const bizState = {
    id: 'b1',
    username: 'wangco',
    name: 'Wang Co',
    email: USER_A.email,
    published: true,
    description: 'Consulting',
    businessType: 'service',
    categories: ['Consulting'],
    locations: [
      {
        id: 'loc-1',
        business_user_id: 'b1',
        label: 'Main',
        is_primary: true,
        address: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zipcode: '94105',
        country: 'US',
        is_active: true,
        sort_order: 0,
      },
    ],
    hours: Array.from({ length: 7 }, (_, i) => ({
      id: `h-${i}`,
      location_id: 'loc-1',
      day_of_week: i,
      open_time: i >= 1 && i <= 5 ? '09:00' : null,
      close_time: i >= 1 && i <= 5 ? '17:00' : null,
      is_closed: i === 0 || i === 6,
    })),
    pages: [
      {
        id: 'page-home',
        business_user_id: 'b1',
        slug: 'home',
        title: 'Home',
        is_default: true,
        show_in_nav: true,
        nav_order: 0,
        draft_revision: 1,
        published_revision: 1,
      },
      {
        id: 'page-about',
        business_user_id: 'b1',
        slug: 'about',
        title: 'About',
        is_default: false,
        show_in_nav: true,
        nav_order: 1,
        draft_revision: 1,
        published_revision: 1,
      },
    ],
  };

  const makePublicResponse = (slug?: string) => {
    const business = {
      id: bizState.id,
      username: bizState.username,
      name: bizState.name,
      email: bizState.email,
      account_type: 'business',
      average_rating: 4.8,
      review_count: 12,
      tagline: 'Trusted by neighbors',
    };
    const profile = {
      business_user_id: bizState.id,
      business_type: bizState.businessType,
      categories: bizState.categories,
      description: bizState.description,
      is_published: bizState.published,
      public_email: bizState.email,
      public_phone: '415-555-0110',
      website: 'https://wangco.example',
    };
    const homeBlocks = [
      {
        id: 'home-text-1',
        page_id: 'page-home',
        revision: 1,
        block_type: 'text',
        schema_version: 1,
        sort_order: 0,
        data: { body: 'Welcome to Wang Co' },
        is_visible: true,
      },
    ];
    const aboutBlocks = [
      {
        id: 'about-text-1',
        page_id: 'page-about',
        revision: 1,
        block_type: 'text',
        schema_version: 1,
        sort_order: 0,
        data: { body: 'About us and service area' },
        is_visible: true,
      },
    ];
    const base = {
      business,
      profile,
      locations: bizState.locations,
      hours: bizState.hours,
      catalog: [],
      review_summary: {
        average_rating: 4.8,
        review_count: 12,
        distribution: { 1: 0, 2: 0, 3: 1, 4: 2, 5: 9 },
      },
      trust: { is_new_business: false },
      pages: bizState.pages,
      defaultPage: { ...bizState.pages[0], blocks: homeBlocks },
    };
    if (!slug) return base;
    if (slug === 'about') {
      return { ...base, currentPage: { ...bizState.pages[1], blocks: aboutBlocks } };
    }
    if (slug === 'home') {
      return { ...base, currentPage: { ...bizState.pages[0], blocks: homeBlocks } };
    }
    return null;
  };

  await page.route(`${API}/**`, async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const path = url.replace(API, '');
    const pathname = path.split('?')[0];
    const json = (d: any, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(d) });

    // Auth — real endpoints are /api/users/*
    if (path === '/api/users/login' && method === 'POST') {
      let body: any = {};
      try { body = route.request().postDataJSON(); } catch {}
      if (body?.password === 'wrongpassword') return json({ error: 'Invalid email or password' }, 401);
      return json({ token: TOKEN, user: MOCK_USER });
    }
    if (path === '/api/users/register' && method === 'POST') return json({ message: 'Please verify your email.', requiresEmailVerification: true });
    if (path === '/api/users/forgot-password' && method === 'POST') return json({ message: 'If that email exists, a reset link has been sent.' });
    if (path === '/api/users/resend-verification' && method === 'POST') return json({ message: 'Sent.' });
    if (path.startsWith('/api/users/oauth/')) return json({ url: 'https://accounts.google.com' });

    // Users
    if (path === '/api/users/me') return json(MOCK_USER);
    if (path.startsWith('/api/users/')) return json(MOCK_USER);

    // Hub
    if (path === '/api/hub') return json(MOCK_HUB);

    // Posts/Feed
    if (pathname === '/api/posts/feed' && method === 'GET') {
      return json({
        posts: [
          {
            id: MOCK_POST.id,
            user_id: 'u1',
            content: MOCK_POST.content,
            post_type: 'ask_local',
            created_at: new Date().toISOString(),
            visibility: 'public',
            like_count: 0,
            comment_count: 0,
            share_count: 0,
            is_pinned: false,
            is_edited: false,
            media_urls: [],
            media_types: [],
            creator: MOCK_USER,
          },
        ],
        pagination: { nextCursor: null, hasMore: false },
      });
    }
    if (pathname === '/api/posts/place-eligibility' && method === 'GET') {
      return json({ eligible: true, readOnly: false, reason: null, trustLevel: 'verified_resident' });
    }
    if (path === '/api/posts' && method === 'GET') return json({ posts: [MOCK_POST], total: 1 });
    if (path === '/api/posts' && method === 'POST') return json({ ...MOCK_POST, id: 'p-new' }, 201);
    if (path.startsWith('/api/posts/')) return json(MOCK_POST);

    // Geo
    if (pathname === '/api/geo/autocomplete' && method === 'GET') {
      return json({ suggestions: [] });
    }

    // Gigs
    if (path === '/api/gigs' && method === 'GET') return json({ gigs: [MOCK_GIG], total: 1, pagination: { page: 1, limit: 15, total: 1 } });
    if (path === '/api/gigs' && method === 'POST') return json({ ...MOCK_GIG, id: 'g-new' }, 201);
    if (path === '/api/gigs/my-gigs') return json({ gigs: [MOCK_GIG], total: 1 });
    if (path === '/api/gigs/my-bids') return json({ bids: [{ id: 'bid1', gig: MOCK_GIG, amount: 60, status: 'pending' }], total: 1 });
    if (path === '/api/gigs/received-offers') return json({ offers: [] });
    if (path === '/api/gigs/saved') return json({ gigs: [], total: 0 });
    if (path.match(/\/api\/gigs\/[^/]+$/) && method === 'GET') {
      if (path.includes('nonexistent')) return json({ error: 'Not found' }, 404);
      return json({ gig: MOCK_GIG });
    }
    if (path.match(/\/api\/gigs\//)) return json({ success: true });

    // Homes
    if (path === '/api/homes' && method === 'GET') return json({ homes: [MOCK_HOME] });
    if (path === '/api/homes' && method === 'POST') return json({ ...MOCK_HOME, id: 'h-new' }, 201);
    if (path.match(/\/api\/homes\/[^/]+/) && method === 'GET') {
      if (path.includes('nonexistent')) return json({ error: 'Not found' }, 404);
      return json({ home: MOCK_HOME });
    }
    if (path.startsWith('/api/homes/')) return json({ success: true });

    // Listings
    if (path === '/api/listings' && method === 'GET') return json({ listings: [MOCK_LISTING], pagination: { page: 1, limit: 20, total: 1 } });
    if (path === '/api/listings/my') return json({ listings: [MOCK_LISTING], pagination: { total: 1 } });
    if (path === '/api/listings/saved') return json({ listings: [], pagination: { total: 0 } });
    if (path.startsWith('/api/listings')) return json(MOCK_LISTING);

    // Chat
    if (path.includes('/api/chat')) return json({ conversations: [], totalUnread: 0, rooms: [], messages: [] });

    // Mailbox
    if (path.startsWith('/api/mailbox')) return json({ items: [{ id: 'm1', subject: 'Welcome', body: 'Hi', read: false, created_at: new Date().toISOString() }], total: 1 });

    // Businesses
    if (pathname === '/api/businesses' && method === 'POST') {
      let body: any = {};
      try { body = route.request().postDataJSON(); } catch {}
      bizState.id = body?.id || 'b-onboard';
      bizState.username = body?.username || 'wangco';
      bizState.name = body?.name || 'Wang Co';
      bizState.email = body?.email || USER_A.email;
      bizState.description = body?.description || '';
      bizState.businessType = body?.business_type || 'service';
      bizState.categories = Array.isArray(body?.categories) ? body.categories : [];
      bizState.published = false;
      bizState.locations = [];
      bizState.hours = [];
      return json({
        message: 'Business created',
        business: {
          id: bizState.id,
          username: bizState.username,
          name: bizState.name,
          email: bizState.email,
          account_type: 'business',
        },
      }, 201);
    }
    if (pathname === '/api/businesses' && method === 'GET') {
      return json({ businesses: [{ ...MOCK_BIZ, id: bizState.id, name: bizState.name }], total: 1 });
    }
    if (pathname === '/api/businesses/discovery') return json({ businesses: [{ ...MOCK_BIZ, id: bizState.id, name: bizState.name }], total: 1 });
    if (pathname === '/api/businesses/search') {
      return json({
        results: [],
        pagination: { page: 1, page_size: 10, total_count: 0, total_pages: 0, has_more: false },
        sort: 'relevance',
        sort_label: 'Recommended',
        filters_active: {
          categories: [],
          radius_miles: 5,
          open_now: false,
          worked_nearby: false,
          accepts_gigs: false,
          new_on_pantopus: false,
          rating_min: null,
        },
        banner: null,
      });
    }
    if (pathname.match(/^\/api\/businesses\/[^/]+\/locations$/) && method === 'POST') {
      let body: any = {};
      try { body = route.request().postDataJSON(); } catch {}
      const locationId = `loc-${bizState.locations.length + 1}`;
      const location = {
        id: locationId,
        business_user_id: bizState.id,
        label: body?.label || 'Main',
        is_primary: !!body?.is_primary || bizState.locations.length === 0,
        address: body?.address || '',
        city: body?.city || '',
        state: body?.state || '',
        zipcode: body?.zipcode || '',
        country: body?.country || 'US',
        is_active: true,
        sort_order: bizState.locations.length,
      };
      bizState.locations.push(location);
      return json({ location }, 201);
    }
    if (pathname.match(/^\/api\/businesses\/[^/]+\/locations\/[^/]+\/hours$/) && method === 'PUT') {
      let body: any = {};
      try { body = route.request().postDataJSON(); } catch {}
      const locId = pathname.split('/')[5];
      const nextHours = Array.isArray(body?.hours) ? body.hours : [];
      bizState.hours = nextHours.map((h: any, i: number) => ({
        id: `h-${locId}-${i}`,
        location_id: locId,
        day_of_week: h.day_of_week,
        open_time: h.open_time,
        close_time: h.close_time,
        is_closed: !!h.is_closed,
      }));
      return json({ hours: bizState.hours });
    }
    if (pathname.match(/^\/api\/businesses\/[^/]+\/publish$/) && method === 'POST') {
      bizState.published = true;
      return json({ message: 'Published' });
    }
    if (pathname.match(/^\/api\/businesses\/[^/]+\/unpublish$/) && method === 'POST') {
      bizState.published = false;
      return json({ message: 'Unpublished' });
    }
    if (pathname.match(/^\/api\/businesses\/[^/]+\/dashboard$/) && method === 'GET') {
      return json({
        business: {
          id: bizState.id,
          username: bizState.username,
          name: bizState.name,
          account_type: 'business',
          average_rating: 4.8,
          review_count: 12,
        },
        profile: {
          business_user_id: bizState.id,
          business_type: bizState.businessType,
          categories: bizState.categories,
          description: bizState.description,
          is_published: bizState.published,
        },
        locations: bizState.locations,
        team: [{ id: 'tm-1', user_id: 'u1', role_base: 'owner', title: 'Owner', is_active: true }],
        catalog: [],
        pages: bizState.pages,
        access: { hasAccess: true, isOwner: true, role_base: 'owner' },
      });
    }
    if (pathname.match(/^\/api\/businesses\/[^/]+$/) && method === 'GET') {
      return json({
        business: {
          id: bizState.id,
          username: bizState.username,
          name: bizState.name,
          account_type: 'business',
        },
        profile: {
          business_user_id: bizState.id,
          business_type: bizState.businessType,
          categories: bizState.categories,
          description: bizState.description,
          is_published: bizState.published,
        },
        locations: bizState.locations,
        access: { hasAccess: true, isOwner: true, role_base: 'owner' },
      });
    }
    if (pathname.startsWith('/api/businesses/')) return json({ business: { ...MOCK_BIZ, id: bizState.id, name: bizState.name } });

    // Public business profile
    if (pathname.match(/^\/api\/b\/[^/]+\/[^/]+$/) && method === 'GET') {
      const slug = pathname.split('/')[4];
      if (!bizState.published) return json({ error: 'Not found' }, 404);
      const res = makePublicResponse(slug);
      if (!res) return json({ error: 'Not found' }, 404);
      return json(res);
    }
    if (pathname.match(/^\/api\/b\/[^/]+$/) && method === 'GET') {
      if (!bizState.published) return json({ error: 'Not found' }, 404);
      return json(makePublicResponse());
    }

    // Notifications
    if (path.includes('notifications')) return json({ notifications: [], unread_count: 0, count: 0, total: 0 });

    // Professional
    if (path.startsWith('/api/professional')) return json({ profile: { skills: [], certifications: [], experience: [] } });

    // Connections / Relationships
    if (path.startsWith('/api/relationships') || path.startsWith('/api/connections')) return json({ connections: [], total: 0 });

    // Wallet / Payments
    if (path.startsWith('/api/wallet')) return json({ balance: 0, transactions: [] });
    if (path.startsWith('/api/payments')) return json({ connected: false });

    // Catch-all
    return json({});
  });
}

async function seedAuthedBrowserSession(page: Page) {
  await page.evaluate((t) => localStorage.setItem('pantopus_auth_token', t), TOKEN);
  await page.context().addCookies([
    {
      name: 'pantopus_session',
      value: '1',
      domain: 'localhost',
      path: '/',
    },
    {
      name: 'pantopus_auth',
      value: TOKEN,
      domain: 'localhost',
      path: '/',
    },
  ]);
}

async function authed(page: Page, path = '/app/hub') {
  await mockApi(page);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await seedAuthedBrowserSession(page);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

// ═══ AUTH ═══
test.describe('Auth Flows', () => {
  test('Login valid → dashboard', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');
    await page.fill('input[name="email"]', USER_A.email);
    await page.fill('input[name="password"]', USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/hub**', { timeout: 20000 });
  });

  test('Login wrong password → error visible', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');
    await page.fill('input[name="email"]', USER_A.email);
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Wait for the error message container (uses bg-red-50 or dark:bg-red-950)
    const errorDiv = page.locator('form div[class*="red"]').first();
    await expect(errorDiv).toBeVisible({ timeout: 10000 });
    const text = await errorDiv.textContent();
    expect(text!.length).toBeGreaterThan(5);
  });

  test('Register → verify email flow', async ({ page }) => {
    await mockApi(page);
    await page.goto('/register');
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'User');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="email"]', 'test@test.com');
    await page.fill('input[name="password"]', 'TestPassword12');
    await page.fill('input[name="confirmPassword"]', 'TestPassword12');
    await page.check('input[name="terms"]');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/verify-email-sent**', { timeout: 15000 });
  });

  test('Forgot password → success message', async ({ page }) => {
    await mockApi(page);
    await page.goto('/forgot-password');
    await page.fill('input[id="email"]', USER_A.email);
    await page.click('button[type="submit"]');
    const successDiv = page.locator('.bg-green-50').first();
    await expect(successDiv).toBeVisible({ timeout: 10000 });
    await expect(successDiv).toContainText('reset link');
  });

  test('Logout → redirected to login', async ({ page }) => {
    await authed(page);
    await page.evaluate(() => localStorage.removeItem('pantopus_auth_token'));
    await page.goto('/app/gigs');
    await page.waitForURL('**/login**', { timeout: 15000 });
  });
});

// ═══ NAVIGATION ═══
test.describe('Navigation', () => {
  const routes = [
    '/app/hub', '/app/feed', '/app/marketplace', '/app/map', '/app/discover',
    '/app/gigs', '/app/chat', '/app/mailbox', '/app/homes', '/app/businesses',
    '/app/notifications', '/app/profile', '/app/my-gigs', '/app/my-bids',
    '/app/my-listings', '/app/saved-listings', '/app/connections', '/app/professional',
  ];
  for (const path of routes) {
    test(`${path} loads`, async ({ page }) => {
      await authed(page, path);
      await page.waitForTimeout(2000);
      await expect(page.locator('body')).not.toContainText('Application error');
      expect((await page.content()).length).toBeGreaterThan(500);
    });
  }

  test('Sidebar opens with nav links', async ({ page }) => {
    await authed(page, '/app/feed');
    await page.click('button[title="Menu"]');
    // The nav sidebar is the one with w-64 class
    const sidebar = page.locator('aside.w-64, aside:has-text("Place"):has-text("Nearby")').first();
    await expect(sidebar).toBeVisible();
    for (const label of ['Place', 'Today', 'Nearby', 'Mail']) {
      await expect(sidebar).toContainText(label);
    }
  });

  test('Header has brand, avatar, chat icon', async ({ page }) => {
    await authed(page, '/app/feed');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('button[aria-label="Profile"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Messages"]')).toBeVisible();
  });

  test('Root redirects to app hub for returning session user', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await seedAuthedBrowserSession(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/app/hub**', { timeout: 15000 });
  });

  test('App routes redirect unauthenticated users to login with redirectTo', async ({ page }) => {
    await mockApi(page);
    await page.goto('/app/hub', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/login?redirectTo=%2Fapp%2Fhub**', { timeout: 15000 });
  });
});

// ═══ FEED ═══
test.describe('Pulse', () => {
  test('Feed loads without crash', async ({ page }) => {
    await authed(page, '/app/feed');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('Place feed supports remote area browsing via viewing-area picker', async ({ page, context }) => {
    await context.grantPermissions(['geolocation'], { origin: 'http://localhost:3000' });
    await context.setGeolocation({ latitude: 45.5231, longitude: -122.6765 });
    await mockApi(page);

    let lastFeedLat: number | null = null;
    let lastFeedLng: number | null = null;

    await page.route(`${API}/api/geo/autocomplete*`, async (route) => {
      const url = new URL(route.request().url());
      const q = (url.searchParams.get('q') || '').toLowerCase();
      if (q.includes('honolulu')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            suggestions: [
              {
                place_id: 'honolulu-1',
                text: 'Honolulu',
                label: 'Honolulu, Hawaii, United States',
                center: [-157.8583, 21.3069],
              },
            ],
          }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ suggestions: [] }) });
    });

    await page.route(`${API}/api/posts/feed*`, async (route) => {
      const url = new URL(route.request().url());
      lastFeedLat = Number(url.searchParams.get('latitude'));
      lastFeedLng = Number(url.searchParams.get('longitude'));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          posts: [
            {
              id: 'p-remote-1',
              user_id: 'u1',
              content: 'Remote area post loaded',
              post_type: 'ask_local',
              created_at: new Date().toISOString(),
              visibility: 'public',
              like_count: 0,
              comment_count: 0,
              share_count: 0,
              is_pinned: false,
              is_edited: false,
              media_urls: [],
              media_types: [],
              creator: MOCK_USER,
            },
          ],
          pagination: { nextCursor: null, hasMore: false },
        }),
      });
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await seedAuthedBrowserSession(page);
    await page.goto('/app/feed', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Viewing:')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Change area' }).click();
    await page.getByPlaceholder('Search city, address, neighborhood...').fill('Honolulu');
    await expect(page.getByText('Honolulu, Hawaii, United States')).toBeVisible({ timeout: 10000 });
    await page.getByText('Honolulu, Hawaii, United States').click();

    await expect(page.getByText('Remote area post loaded')).toBeVisible({ timeout: 10000 });
    await expect.poll(() => lastFeedLat).toBeCloseTo(21.3069, 3);
    await expect.poll(() => lastFeedLng).toBeCloseTo(-157.8583, 3);
  });

  test('Place feed read-only mode shows warning and hides composer while allowing read', async ({ page, context }) => {
    await context.grantPermissions(['geolocation'], { origin: 'http://localhost:3000' });
    await context.setGeolocation({ latitude: 45.5231, longitude: -122.6765 });
    await mockApi(page);

    await page.route(`${API}/api/posts/place-eligibility*`, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          eligible: false,
          readOnly: true,
          reason: 'You need to be physically present (fresh GPS) or be a verified resident/business to post to the Place feed.',
          trustLevel: 'remote_viewer',
        }),
      });
    });

    await page.route(`${API}/api/posts/feed*`, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          posts: [
            {
              id: 'p-readonly-1',
              user_id: 'u1',
              content: 'Read-only users can still browse this place',
              post_type: 'ask_local',
              created_at: new Date().toISOString(),
              visibility: 'public',
              like_count: 0,
              comment_count: 0,
              share_count: 0,
              is_pinned: false,
              is_edited: false,
              media_urls: [],
              media_types: [],
              creator: MOCK_USER,
            },
          ],
          pagination: { nextCursor: null, hasMore: false },
        }),
      });
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await seedAuthedBrowserSession(page);
    await page.goto('/app/feed', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Read-only users can still browse this place')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('You need to be physically present (fresh GPS) or be a verified resident/business to post to the Place feed.')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Share something with your neighborhood…')).toHaveCount(0);

    await page.getByRole('main').getByRole('button', { name: 'Map' }).click();
    await expect(page.getByText('You need to be physically present (fresh GPS) or be a verified resident/business to post to the Place feed.')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'New post' })).toHaveCount(0);
  });
});

// ═══ HOMES ═══
test.describe('Homes', () => {
  test('Homes page loads', async ({ page }) => {
    await authed(page, '/app/homes');
    await expect(page.getByRole('heading', { name: 'My Homes' })).toBeVisible({ timeout: 10000 });
  });
});

// ═══ GIGS ═══
test.describe('Gigs', () => {
  test('Browse page has search and post button', async ({ page }) => {
    await authed(page, '/app/gigs');
    await expect(page.locator('input[placeholder="Search tasks..."]')).toBeVisible();
    // The "Post Task" button in the page header (not sidebar)
    await expect(page.locator('.max-w-7xl button:has-text("Post Task"), header ~ div button:has-text("Post Task")').first()).toBeVisible();
  });

  test('Post Task button exists and gigs/new page loads', async ({ page }) => {
    await authed(page, '/app/gigs');
    // Verify the Post Task button exists in page header
    const postBtn = page.locator('button.bg-primary-600:has-text("Post Task")');
    await expect(postBtn).toBeVisible();
    // Navigate directly to verify the page works
    await page.goto('/app/gigs/new', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('Gig detail loads', async ({ page }) => {
    await authed(page, '/app/gigs/g1');
    await page.waitForTimeout(4000);
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});

// ═══ MARKETPLACE ═══
test.describe('Marketplace', () => {
  test('Marketplace loads', async ({ page }) => {
    await authed(page, '/app/marketplace');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});

// ═══ CHAT ═══
test.describe('Chat', () => {
  test('Chat list loads', async ({ page }) => {
    await authed(page, '/app/chat');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});

// ═══ MAILBOX ═══
test.describe('Mailbox', () => {
  test('Mailbox loads', async ({ page }) => {
    await authed(page, '/app/mailbox');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});

// ═══ BUSINESSES ═══
test.describe('Businesses', () => {
  test('Business list loads', async ({ page }) => {
    await authed(page, '/app/businesses');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('Onboarding wizard publishes and public profile renders', async ({ page }) => {
    const clickWizard = async (testId: string) => {
      await page.evaluate((id) => {
        const el = document.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement | null;
        el?.click();
      }, testId);
    };

    await authed(page, '/app/business/new');
    await expect(page.locator('[data-testid="business-onboarding-heading"]')).toHaveText('Type', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);

    await page.fill('input[placeholder="My Business"]', 'Acme Plumbing');
    await clickWizard('business-onboarding-next');
    await expect(page.locator('[data-testid="business-onboarding-step"]')).toHaveText('Step 2 of 6', { timeout: 10000 });
    await expect(page.locator('[data-testid="business-onboarding-heading"]')).toHaveText('Basic Info', { timeout: 10000 });

    await page.fill('input[placeholder="mybusiness"]', 'acmeplumbing');
    await page.fill('input[placeholder="business@email.com"]', 'owner@acme.example');
    await page.fill('input[placeholder="What does your business do?"]', 'Emergency plumbing service');
    await clickWizard('business-onboarding-next');
    await expect(page.locator('[data-testid="business-onboarding-heading"]')).toHaveText('Location', { timeout: 10000 });

    await page.check('label:has-text("Skip for now") input[type="checkbox"]');
    await clickWizard('business-onboarding-next');
    await expect(page.locator('[data-testid="business-onboarding-heading"]')).toHaveText('Hours', { timeout: 10000 });

    await page.check('label:has-text("Skip for now") input[type="checkbox"]');
    await clickWizard('business-onboarding-next');
    await expect(page.locator('[data-testid="business-onboarding-heading"]')).toHaveText('Media', { timeout: 10000 });

    await page.check('label:has-text("Skip for now") input[type="checkbox"]');
    await clickWizard('business-onboarding-next');
    await expect(page.locator('[data-testid="business-onboarding-heading"]')).toHaveText('Review', { timeout: 10000 });

    await clickWizard('business-onboarding-publish');
    await page.waitForURL('**/app/businesses/b-onboard/dashboard**', { timeout: 20000 });
    await expect(page.locator('h1:has-text("Acme Plumbing")')).toBeVisible({ timeout: 10000 });

    await page.goto('/b/acmeplumbing', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1:has-text("Acme Plumbing")')).toBeVisible({ timeout: 10000 });
  });

  test('Public profile renders default and slug pages', async ({ page }) => {
    await mockApi(page);

    await page.goto('/b/wangco', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1:has-text("Wang Co")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Welcome to Wang Co')).toBeVisible({ timeout: 10000 });

    await page.goto('/b/wangco/about', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1:has-text("Wang Co")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=About us and service area')).toBeVisible({ timeout: 10000 });
  });

  test('Profile settings publish toggle controls public visibility', async ({ page }) => {
    await authed(page, '/app/business/b1/settings/profile');
    await expect(page.locator('h1:has-text("Business Profile Settings")')).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Unpublish' }).click();
    await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible({ timeout: 10000 });

    await page.goto('/b/wangco', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h2:has-text("Business not found")')).toBeVisible({ timeout: 10000 });

    await page.goto('/app/business/b1/settings/profile', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible({ timeout: 10000 });

    await page.goto('/b/wangco', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1:has-text("Wang Co")')).toBeVisible({ timeout: 10000 });
  });

  test('Public slug page shows not-found for missing or unpublished slug', async ({ page }) => {
    await authed(page, '/app/business/b1/settings/profile');
    await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Unpublish' }).click();
    await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible({ timeout: 10000 });

    await page.goto('/b/wangco/about', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h2:has-text("Business not found")')).toBeVisible({ timeout: 10000 });

    await page.goto('/app/business/b1/settings/profile', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible({ timeout: 10000 });

    await page.goto('/b/wangco/not-a-real-slug', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h2:has-text("Business not found")')).toBeVisible({ timeout: 10000 });
  });
});

// ═══ PROFILE & SETTINGS ═══
test.describe('Profile', () => {
  test('Profile page loads', async ({ page }) => {
    await authed(page, '/app/profile');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('Professional page loads', async ({ page }) => {
    await authed(page, '/app/professional');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});

// ═══ MAP ═══
test.describe('Map', () => {
  test('Map page loads', async ({ page }) => {
    await authed(page, '/app/map');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});

// ═══ ERROR STATES ═══
test.describe('Error States', () => {
  test('Nonexistent gig → no crash', async ({ page }) => {
    await authed(page, '/app/gigs/nonexistent-id');
    await page.waitForTimeout(4000);
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('Nonexistent home → no crash', async ({ page }) => {
    await authed(page, '/app/homes/nonexistent-id');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('API down → error UI not blank', async ({ page }) => {
    await page.route(`${API}/**`, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"down"}' }));
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await seedAuthedBrowserSession(page);
    await page.goto('/app/gigs', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    expect((await page.content()).length).toBeGreaterThan(500);
  });

  test('No auth → redirect to login', async ({ page }) => {
    await mockApi(page);
    await page.goto('/app/hub');
    await page.waitForURL('**/login**', { timeout: 15000 });
  });
});
