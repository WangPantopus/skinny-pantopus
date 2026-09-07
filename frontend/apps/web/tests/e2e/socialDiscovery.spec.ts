import { test, expect } from '@playwright/test';

// Production screens with isolated HTTP fixtures: no live accounts or writes.
test('Nearby reaches public Beacon discovery and following without a home', async ({
  page,
  context,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'social@example.com',
    name: 'Social Test',
    username: 'social_test',
    account_type: 'individual',
  };
  const errors: string[] = [];
  let muteRequests = 0;
  let publicSearch = false;
  let muted = false;
  page.on('pageerror', (error) => errors.push(error.message));
  await context.addCookies([
    { name: 'pantopus_session', value: '1', url: origin },
    { name: 'pantopus_access', value: 'fixture', url: origin, httpOnly: true },
  ]);
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    let data: unknown = {};
    if (url.pathname === '/api/users/profile') data = { user };
    else if (url.pathname === '/api/neighborhood/meter')
      data = {
        state: 'no_place',
        verified_count: null,
        threshold: 24,
        k_anon_min: 10,
        unlocked: false,
      };
    else if (url.pathname === '/api/personas/me/following')
      data = {
        items: [
          {
            membershipId: 'm1',
            persona: {
              id: 'b1',
              handle: 'garden',
              displayName: 'Garden club',
              status: 'active',
            },
            mutedUntil: muted ? '2099-01-01T00:00:00Z' : null,
            latestPost: { id: 'p1', snippet: 'Seed swap on Saturday' },
            unreadCount: 2,
          },
        ],
        counts: { totalFollowing: 1, unreadBeacons: 1 },
        pagination: { hasMore: false, nextOffset: null },
      };
    else if (url.pathname === '/api/identity/search') {
      publicSearch = url.searchParams.get('scope') === 'public_profiles';
      data = {
        results: [
          {
            id: 'b1',
            type: 'public_profile',
            href: '/@garden',
            title: 'Garden club public profile',
            subtitle: '@garden',
          },
        ],
      };
    } else if (url.pathname.includes('/mute')) {
      muteRequests += 1;
      muted = true;
    } else if (url.pathname.includes('/homes/primary')) data = { home: null };
    else if (url.pathname.includes('/homes/my-homes')) data = { homes: [] };
    else if (url.pathname.includes('feature-flag')) data = { enabled: false };
    else if (url.pathname.includes('/badges')) data = { badges: {} };
    else if (url.pathname.includes('/notifications'))
      data = { notifications: [], unread_count: 0 };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
  await page.goto('/app/nearby');
  await expect(
    page.getByRole('heading', { name: 'Add a home for neighborhood context' }),
  ).toBeVisible();
  const discovery = page.getByRole('navigation', { name: 'Social discovery' });
  await expect(discovery.getByRole('button', { name: /^Pulse/ })).toBeVisible();
  await expect(
    discovery.getByRole('button', { name: /^Connections/ }),
  ).toBeVisible();
  await page.screenshot({
    path: '/tmp/pantopus-social-nearby-web.png',
    fullPage: true,
  });
  await discovery.getByRole('button', { name: /^Beacons/ }).click();
  await expect(page).toHaveURL(/\/app\/beacons$/);
  await expect(
    page.getByRole('link', { name: 'Garden club', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Beacon name or handle' })
    .fill('garden');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(
    page.getByRole('link', { name: /Garden club public profile/ }),
  ).toHaveAttribute('href', '/@garden');
  expect(publicSearch).toBe(true);
  expect(muteRequests).toBe(0);
  await page.getByRole('button', { name: 'Mute for 7 days' }).click();
  await expect(
    page.getByRole('button', { name: 'Unmute', exact: true }),
  ).toBeVisible();
  expect(muteRequests).toBe(1);
  await page.screenshot({
    path: '/tmp/pantopus-social-beacons-web.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await page.getByRole('heading', { name: 'Beacons', exact: true }).boundingBox())?.x).toBeLessThan(24);
  await page.screenshot({
    path: '/tmp/pantopus-social-beacons-mobile-web.png',
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
