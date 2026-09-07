import { test, expect } from '@playwright/test';

// Isolated browser regression: every API response is a fixture. No accounts,
// mail, follow requests or home records are written outside this test.
test('Home preview survives verification in a new tab, failed save and reload', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const user = { id: '11111111-1111-4111-8111-111111111111', email: 'arrival@example.com', name: 'Arrival Test', username: 'arrival_test', account_type: 'individual' };
  const place = { id: 'saved-fixture', user_id: user.id, label: '120 Example St, Portland, OR', latitude: 45.5, longitude: -122.6, city: 'Portland', state: 'OR', place_type: 'searched' };
  let saved = false;
  let writes = 0;
  let returnTo = '';
  const failures: string[] = [];
  context.on('page', (tab) => tab.on('pageerror', (error) => failures.push(error.message)));
  page.on('pageerror', (error) => failures.push(error.message));
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/socket.io')) return route.fulfill({ status: 200, body: '' });
    if (!url.pathname.startsWith('/api/')) return route.continue();
    let data: unknown = {};
    let status = 200;
    if (url.pathname === '/api/geo/autocomplete') data = { suggestions: [{ suggestion_id: 'fixture', primary_text: '120 Example St', secondary_text: 'Portland, OR', label: place.label, center: { lat: place.latitude, lng: place.longitude }, kind: 'address' }] };
    else if (url.pathname === '/api/public/place') data = { status: 'ready', tier: 'preview', region: 'US', place: { address: '120 Example St', city: 'Portland', state: 'OR', zipcode: '97201' }, sections: [], locked: [] };
    else if (url.pathname === '/api/users/register') {
      returnTo = route.request().postDataJSON().redirectTo;
      data = { requiresEmailVerification: true, user };
    } else if (url.pathname === '/api/users/verify-email') data = { message: 'Email verified' };
    else if (url.pathname === '/api/users/login') {
      await context.addCookies([
        { name: 'pantopus_session', value: '1', url: origin },
        { name: 'pantopus_access', value: 'fixture', url: origin, httpOnly: true },
      ]);
      data = { user };
    } else if (url.pathname === '/api/users/profile') data = { user };
    else if (url.pathname === '/api/saved-places') {
      if (route.request().method() === 'POST') {
        writes += 1;
        expect(route.request().postDataJSON().expectedUserId).toBe(user.id);
        if (writes === 1) { status = 503; data = { error: 'Temporary save failure' }; }
        else { saved = true; data = { savedPlace: place }; }
      } else data = { savedPlaces: saved ? [place] : [] };
    } else if (url.pathname.includes('/homes/primary')) data = { home: null };
    else if (url.pathname.includes('/homes/my-homes')) data = { homes: [] };
    else if (url.pathname.includes('feature-flag')) data = { enabled: false };
    else if (url.pathname.includes('/badges')) data = { badges: {} };
    else if (url.pathname.includes('/notifications')) data = { notifications: [], unread_count: 0 };
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });

  await page.goto('/start');
  await page.getByPlaceholder(/enter your address/i).fill('120 Example');
  await page.getByText('120 Example St', { exact: true }).click();
  await page.getByRole('button', { name: /see your place/i }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page).toHaveURL(/\/register\?redirectTo=/);
  await page.getByLabel(/Email address/).fill(user.email);
  await page.locator('#password').fill('long-password-123');
  await page.locator('#confirmPassword').fill('long-password-123');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/verify-email-sent/);
  expect(returnTo).toMatch(/^\/app\/place\?preview=[a-zA-Z0-9-]+$/);
  expect(returnTo).not.toContain('Example');

  const verifiedTab = await context.newPage();
  await verifiedTab.goto(`/verify-email?token_hash=fixture&type=signup&redirectTo=${encodeURIComponent(returnTo)}`);
  await expect(verifiedTab).toHaveURL(/\/login\?redirectTo=/);
  await verifiedTab.getByLabel('Email address', { exact: true }).fill(user.email);
  await verifiedTab.locator('#password').fill('long-password-123');
  await verifiedTab.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(verifiedTab.getByText(place.label, { exact: true })).toBeVisible();
  expect(writes).toBe(0);
  await verifiedTab.getByRole('button', { name: 'Save privately' }).click();
  await expect(verifiedTab.getByRole('alert').filter({ hasText: 'Temporary save failure' })).toContainText('Temporary save failure');
  await verifiedTab.reload();
  await verifiedTab.getByRole('button', { name: 'Save privately' }).click();
  await expect(verifiedTab).toHaveURL(/savedPlace=saved-fixture/);
  await expect(verifiedTab.getByText(place.label, { exact: true })).toBeVisible();
  await verifiedTab.reload();
  await expect(verifiedTab.getByText(place.label, { exact: true })).toBeVisible();
  expect(writes).toBe(2);
  await verifiedTab.setViewportSize({ width: 390, height: 844 });
  await expect(verifiedTab.locator('main').first()).toHaveCSS('margin-left', '0px');
  await expect.poll(async () => (await verifiedTab.getByRole('heading', { name: place.label }).boundingBox())!.width).toBeGreaterThan(280);
  await verifiedTab.screenshot({ path: '/tmp/pantopus-entry-home-mobile.png', fullPage: true, animations: 'disabled' });
  expect(await verifiedTab.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(failures).toEqual([]);
});
