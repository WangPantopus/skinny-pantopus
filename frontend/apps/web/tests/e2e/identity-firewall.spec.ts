import { expect, test, Page, Route } from '@playwright/test';

const API = 'http://localhost:8000';
const TOKEN = 'identity-firewall-e2e-token';

const localProfile = {
  type: 'local',
  id: 'local-1',
  handle: 'riverhome',
  displayName: 'RiverHome',
  avatarUrl: null,
  bio: 'Local profile',
  tagline: 'Verified Resident',
  href: '/riverhome',
  badges: ['Verified Resident'],
  locality: { city: 'Seattle', state: 'WA', neighborhood: null, precision: 'city' },
  stats: { reviews: 0, gigsCompleted: 0, marketplaceSales: 0 },
  viewer: { relationshipStatus: 'none', isFollowingLocal: false, canMessage: false },
  bridges: { audienceProfile: null },
};

const persona = {
  type: 'persona',
  id: 'persona-1',
  handle: 'mayabuilds',
  displayName: 'Maya Builds',
  avatarUrl: null,
  bannerUrl: null,
  bio: 'Public profile for tutorials',
  href: '/@mayabuilds',
  publicLinks: [{ label: 'Website', url: 'https://example.test' }],
  category: 'creator',
  audienceLabel: 'followers',
  audienceMode: 'open',
  followerCount: 1,
  postCount: 1,
  broadcastEnabled: true,
  viewer: {
    isFollowing: false,
    relationshipType: null,
    notificationLevel: 'all',
    followStatus: 'none',
    isOwner: true,
  },
  bridges: { localProfile: null },
};

const channel = { id: 'channel-1', persona_id: 'persona-1', title: 'Maya Builds', status: 'active' };

async function seedAuthedSession(page: Page) {
  await page.addInitScript((token) => {
    window.localStorage.setItem('pantopus_auth_token', token);
  }, TOKEN);
  await page.context().addCookies([
    { name: 'pantopus_access', value: TOKEN, domain: 'localhost', path: '/' },
    { name: 'pantopus_session', value: '1', domain: 'localhost', path: '/' },
  ]);
}

async function mockIdentityApi(page: Page) {
  let pendingApproved = false;
  const handler = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (path === '/api/users/me' || path === '/api/users/profile') {
      return json({
        id: 'user-1',
        email: 'maya@example.test',
        username: 'maya',
        name: 'Maya Local',
        verified: true,
      });
    }
    if (path === '/api/chat/stats') return json({ unreadCount: 0, totalUnread: 0 });
    if (path === '/api/gigs/received-offers') return json({ offers: [] });
    if (path === '/api/listings/me') return json({ listings: [] });
    if (path === '/api/businesses/my-seats') return json({ seats: [] });
    if (path === '/api/businesses/my-businesses') return json({ businesses: [] });
    if (path === '/api/homes/my-homes') return json({ homes: [] });
    if (path === '/api/homes/primary') return json({ home: null });
    if (path === '/api/notifications/unread-count') return json({ unread_count: 0 });

    if (path === '/api/identity-center') {
      return json({
        privateAccount: { email: 'maya@example.test', verified: true },
        localProfile,
        audienceProfile: persona,
        bridges: { show_persona_on_local: false, show_local_on_persona: false },
        homes: [],
        businessProfiles: [],
      });
    }
    if (path === '/api/identity-center/view-as') {
      return json({ surface: 'persona', viewer: 'persona_audience_member', profile: persona });
    }
    if (path === '/api/personas/me') return json({ persona, channel });
    if (path === '/api/personas/persona-1' && method === 'PATCH') return json({ persona });
    if (path === '/api/personas/persona-1/followers') {
      const requestedStatus = url.searchParams.get('status') || 'active';
      const shouldShowFollower = requestedStatus === 'pending' ? !pendingApproved : true;
      return json({
        followers: shouldShowFollower ? [{
          id: 'follow-1',
          status: requestedStatus === 'pending' ? 'pending' : 'active',
          relationshipType: 'follower',
          notificationLevel: 'all',
          publicVisibility: 'visible_to_owner',
          follower: { ...localProfile, id: 'local-follower', handle: 'neighbor', displayName: 'Neighbor Request' },
        }] : [],
        counts: { total: 1, pending: pendingApproved ? 0 : 1, active: pendingApproved ? 1 : 0, muted: 0, blocked: 0, removed: 0 },
      });
    }
    if (path === '/api/personas/persona-1/followers/follow-1' && method === 'PATCH') {
      pendingApproved = true;
      return json({
        follower: {
          id: 'follow-1',
          status: 'active',
          relationshipType: 'follower',
          notificationLevel: 'all',
          publicVisibility: 'visible_to_owner',
          follower: { ...localProfile, id: 'local-follower', handle: 'neighbor', displayName: 'Neighbor Request' },
        },
      });
    }
    if (path === '/api/broadcast/channels/channel-1/messages' && method === 'GET') {
      return json({
        channel,
        persona,
        analytics: { deliveredCount: 4, readCount: 2 },
        messages: [{
          id: 'message-1',
          channel_id: 'channel-1',
          persona_id: 'persona-1',
          body: 'Welcome to follower updates.',
          media: [],
          visibility: 'followers',
          status: 'published',
          delivered_count: 4,
          read_count: 2,
          created_at: '2026-05-05T13:00:00Z',
        }],
      });
    }
    if (path === '/api/broadcast/channels/channel-1/messages' && method === 'POST') {
      return json({
        message: {
          id: 'message-2',
          channel_id: 'channel-1',
          persona_id: 'persona-1',
          body: 'Fresh update',
          media: [],
          visibility: 'followers',
          status: 'published',
          delivered_count: 1,
          read_count: 0,
          created_at: '2026-05-05T14:00:00Z',
        },
      });
    }
    if (path === '/api/identity-center/bridges/persona-1' && method === 'PATCH') {
      const payload = request.postDataJSON() as {
        show_persona_on_local?: boolean;
        show_local_on_persona?: boolean;
      };
      return json({
        bridge: {
          show_persona_on_local: Boolean(payload.show_persona_on_local),
          show_local_on_persona: Boolean(payload.show_local_on_persona),
        },
      });
    }

    return json({});
  };
  await page.route(`${API}/**`, handler);
  await page.route('**/api/**', handler);
  await page.route('**/socket.io/**', (route) => route.abort());
}

async function gotoAppRoute(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'commit', timeout: 30_000 }).catch(() => {
    // Next dev can keep the navigation promise pending during cold route compilation.
    // The following visible UI assertions are the real pass/fail signal.
  });
}

async function expectResponsivePageShell(page: Page) {
  const overflow = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.bodyClientWidth + 1);
  expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.documentClientWidth + 1);

  await expect(page.getByText(/Identity Center|Audience Profile|Broadcast channel|Bridges|View As|Backend preview|Identity Firewall/)).toHaveCount(0);
}

test.describe('Profiles & Privacy web flows', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await mockIdentityApi(page);
    await seedAuthedSession(page);
  });

  test('Beacon owner can manage pending followers', async ({ page }) => {
    await gotoAppRoute(page, '/app/persona');

    await expect(page.getByRole('heading', { name: 'Beacon' })).toBeVisible({ timeout: 45_000 });
    await page.getByRole('tab', { name: 'Followers' }).click();
    await page.getByRole('button', { name: /Pending/i }).click();
    await expect(page.getByText('Neighbor Request')).toBeVisible();
    await page.getByRole('button', { name: /Approve/i }).click();
    await expect(page.getByText('No pending requests.')).toBeVisible();
  });

  test('Updates shows analytics and can publish', async ({ page }) => {
    await gotoAppRoute(page, '/app/persona/broadcast');

    await expect(page.getByRole('heading', { name: 'Updates', level: 1 })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText('Delivered', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Reads', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/4 delivered/i)).toBeVisible();

    await page.getByPlaceholder('Write an update for your followers...').fill('Fresh update');
    await page.getByRole('button', { name: /Post update/i }).click();
    await expect(page.getByText('Fresh update')).toBeVisible();
  });

  test('redesigned management pages fit desktop and mobile viewports', async ({ page }) => {
    const routes = [
      { path: '/app/identity', heading: 'Profiles & Privacy' },
      { path: '/app/persona', heading: 'Beacon' },
      { path: '/app/persona/broadcast', heading: 'Updates' },
    ];
    const viewports = [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const route of routes) {
        await gotoAppRoute(page, route.path);
        await expect(page.getByRole('heading', { name: route.heading, level: 1 })).toBeVisible({ timeout: 30_000 });
        await expectResponsivePageShell(page);
      }
    }
  });
});
