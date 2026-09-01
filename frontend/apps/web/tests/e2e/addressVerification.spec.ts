import { test, expect, Page, Route } from '@playwright/test';

// ============================================================
// Address Verification E2E Tests
//
// Tests the AddressEntryFlow and MailVerificationFlow components
// mounted at /app/address-verify with mocked backend responses.
//
// Covers 6 scenarios:
//   1. Happy path:      autocomplete → OK → home setup
//   2. Missing unit:    apartment → MISSING_UNIT → enter unit → OK
//   3. Business:        commercial → BUSINESS → create business
//   4. Mail verify:     address → mail code → enter code → success
//   5. Conflict:        existing household → CONFLICT → request join
//   6. Undeliverable:   bad address → UNDELIVERABLE → edit
//
// All API interactions are route-mocked — no backend needed.
// ============================================================

const API = 'http://localhost:8000';
const TOKEN = 'fake-jwt-token-for-testing';

// ── Mock data ───────────────────────────────────────────────

const MOCK_USER = {
  id: 'u-test-1',
  email: 'tester@test.local',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  name: 'Test User',
  bio: '',
  avatar_url: null,
  created_at: '2024-01-01T00:00:00Z',
};

const MOCK_HUB = {
  user: { id: 'u-test-1', name: 'Test User', username: 'testuser', avatarUrl: null, email: 'tester@test.local' },
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

// ── Verdict response factories ──────────────────────────────

function makeNormalized(overrides: Record<string, any> = {}) {
  return {
    line1: '123 Main St',
    line2: undefined,
    city: 'Portland',
    state: 'OR',
    zip: '97201',
    plus4: '1234',
    lat: 45.5152,
    lng: -122.6784,
    ...overrides,
  };
}

function makeDeliverability(overrides: Record<string, any> = {}) {
  return {
    dpv_match_code: 'Y',
    rdi_type: 'residential',
    missing_secondary: false,
    commercial_mailbox: false,
    vacant_flag: false,
    footnotes: ['AA', 'BB'],
    ...overrides,
  };
}

function makeValidateResponse(
  status: string,
  overrides: Record<string, any> = {},
) {
  const defaults: Record<string, any> = {
    OK: {
      verdict: {
        status: 'OK',
        reasons: ['RDI_RESIDENTIAL', 'DPV_Y'],
        confidence: 0.95,
        normalized: makeNormalized(),
        deliverability: makeDeliverability(),
        classification: { google_place_types: ['premise'], parcel_type: 'residential', building_type: 'single_family' },
        candidates: [],
        next_actions: ['send_mail_code'],
      },
      address_id: 'addr-1',
    },
    MISSING_UNIT: {
      verdict: {
        status: 'MISSING_UNIT',
        reasons: ['MISSING_SECONDARY', 'DPV_SECONDARY_MISSING'],
        confidence: 0.3,
        normalized: makeNormalized({ line1: '456 Oak Ave' }),
        deliverability: makeDeliverability({ dpv_match_code: 'S', missing_secondary: true }),
        candidates: [],
        next_actions: ['prompt_unit'],
      },
      address_id: 'addr-2',
    },
    BUSINESS: {
      verdict: {
        status: 'BUSINESS',
        reasons: ['RDI_COMMERCIAL', 'CMRA_MAILBOX', 'PLACE_COMMERCIAL'],
        confidence: 0.85,
        normalized: makeNormalized({ line1: '789 Commerce Blvd' }),
        deliverability: makeDeliverability({ rdi_type: 'commercial', commercial_mailbox: true }),
        classification: { google_place_types: ['store', 'establishment'], parcel_type: 'commercial', building_type: 'commercial' },
        candidates: [],
        next_actions: ['manual_review'],
      },
      address_id: 'addr-3',
    },
    CONFLICT: {
      verdict: {
        status: 'CONFLICT',
        reasons: ['RDI_RESIDENTIAL', 'DPV_Y', 'EXISTING_HOUSEHOLD'],
        confidence: 0.92,
        normalized: makeNormalized({ line1: '321 Elm St' }),
        deliverability: makeDeliverability(),
        existing_household: { home_id: 'home-existing', member_count: 3, active_roles: ['owner', 'member'] },
        candidates: [],
        next_actions: ['join_existing', 'dispute'],
      },
      address_id: 'addr-4',
    },
    UNDELIVERABLE: {
      verdict: {
        status: 'UNDELIVERABLE',
        reasons: ['DPV_NO_MATCH', 'USPS_VACANT'],
        confidence: 0.1,
        normalized: makeNormalized({ line1: '999 Nowhere Ln' }),
        deliverability: makeDeliverability({ dpv_match_code: 'N', vacant_flag: true }),
        candidates: [],
        next_actions: ['manual_review'],
      },
      address_id: 'addr-5',
    },
  };

  const base = defaults[status] || defaults.OK;
  return { ...base, ...overrides };
}

function makeSuggestions(label: string) {
  return {
    suggestions: [{
      place_id: 'place-1',
      label,
      center: [-122.6784, 45.5152],
      context: [],
      properties: {},
      text: label,
    }],
  };
}

function makeNormalizeResponse(address: string) {
  return {
    normalized: {
      address,
      city: 'Portland',
      state: 'OR',
      zipcode: '97201',
      latitude: 45.5152,
      longitude: -122.6784,
      label: `${address}, Portland, OR 97201`,
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────

async function authed(page: Page, path: string) {
  await page.goto('/login');
  await page.evaluate((t) => {
    localStorage.setItem('token', t);
    localStorage.setItem('pantopus_auth_token', t);
    document.cookie = `token=${t}; path=/`;
  }, TOKEN);
  await page.goto(path, { waitUntil: 'networkidle' });
}

function json(route: Route, data: any, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
}

/**
 * Set up common API mocks (auth, hub, notifications, etc.)
 * The caller provides a customizer for address-specific routes.
 */
async function setupCommonMocks(page: Page, addressMocks: (url: string, method: string, route: Route) => Promise<boolean>) {
  await page.route(`${API}/**`, async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const path = url.replace(API, '');
    const pathname = path.split('?')[0];

    // Auth
    if (pathname === '/api/users/me') return json(route, MOCK_USER);
    if (pathname.startsWith('/api/users/')) return json(route, MOCK_USER);

    // Hub
    if (pathname === '/api/hub') return json(route, MOCK_HUB);

    // Notifications, chat, mailbox
    if (path.startsWith('/api/notifications')) return json(route, { notifications: [], total: 0 });
    if (path.includes('/api/chat')) return json(route, { conversations: [], totalUnread: 0 });
    if (path.startsWith('/api/mailbox')) return json(route, { items: [], total: 0 });

    // Address-specific mocks (handled by caller)
    const handled = await addressMocks(path, method, route);
    if (handled) return;

    // Default
    return json(route, { ok: true });
  });
}

// ============================================================
// TEST 1: Happy path — autocomplete → OK → home setup
// ============================================================

test.describe('TEST 1: Happy path — OK verdict', () => {
  test('enter address → autocomplete select → confirm → proceed to home setup', async ({ page }) => {
    await setupCommonMocks(page, async (path, method, route) => {
      const pathname = path.split('?')[0];

      // Autocomplete suggestions
      if (pathname === '/api/geo/autocomplete') {
        return json(route, makeSuggestions('123 Main St, Portland, OR 97201')), true;
      }

      // Resolve selected address
      if (pathname === '/api/geo/resolve' && method === 'POST') {
        return json(route, makeNormalizeResponse('123 Main St')), true;
      }

      // Validate → OK
      if (pathname === '/api/v1/address/validate' && method === 'POST') {
        return json(route, makeValidateResponse('OK')), true;
      }

      return false;
    });

    await authed(page, '/app/address-verify');

    // Page title visible
    await expect(page.getByTestId('page-title')).toBeVisible();

    // Enter address in autocomplete
    const input = page.locator('input[placeholder*="typing" i], input[role="combobox"]').first();
    await input.fill('123 Main St');

    // Select autocomplete suggestion
    const suggestion = page.getByText('123 Main St, Portland, OR 97201');
    await suggestion.waitFor({ state: 'visible', timeout: 5000 });
    await suggestion.click();

    // Wait for validation and confirm screen
    await expect(page.getByText('Verified address')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('123 Main St')).toBeVisible();
    await expect(page.getByText('High confidence')).toBeVisible();
    await expect(page.getByText('Residential')).toBeVisible();
    await expect(page.getByText('USPS deliverable')).toBeVisible();

    // Click Continue
    await page.getByRole('button', { name: /continue/i }).click();

    // Should arrive at home setup screen
    await expect(page.getByTestId('home-setup-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Set up your home')).toBeVisible();
    await expect(page.getByText('123 Main St, Portland, OR 97201')).toBeVisible();
  });
});

// ============================================================
// TEST 2: Missing unit — MISSING_UNIT → enter unit → OK
// ============================================================

test.describe('TEST 2: Missing unit flow', () => {
  test('apartment building → MISSING_UNIT → enter unit in modal → confirm → OK', async ({ page }) => {
    let unitValidated = false;

    await setupCommonMocks(page, async (path, method, route) => {
      const pathname = path.split('?')[0];

      if (pathname === '/api/geo/autocomplete') {
        return json(route, makeSuggestions('456 Oak Ave, Portland, OR 97201')), true;
      }

      if (pathname === '/api/geo/resolve' && method === 'POST') {
        return json(route, makeNormalizeResponse('456 Oak Ave')), true;
      }

      // First validate → MISSING_UNIT
      if (pathname === '/api/v1/address/validate' && method === 'POST' && !unitValidated) {
        return json(route, makeValidateResponse('MISSING_UNIT')), true;
      }

      // Unit re-validation → OK
      if (pathname === '/api/v1/address/validate/unit' && method === 'POST') {
        unitValidated = true;
        return json(route, makeValidateResponse('OK', {
          verdict: {
            ...makeValidateResponse('OK').verdict,
            normalized: makeNormalized({ line1: '456 Oak Ave', line2: 'Apt 4B' }),
          },
          address_id: 'addr-2-with-unit',
        })), true;
      }

      // Second validate after unit → OK
      if (pathname === '/api/v1/address/validate' && method === 'POST' && unitValidated) {
        return json(route, makeValidateResponse('OK', {
          verdict: {
            ...makeValidateResponse('OK').verdict,
            normalized: makeNormalized({ line1: '456 Oak Ave', line2: 'Apt 4B' }),
          },
        })), true;
      }

      return false;
    });

    await authed(page, '/app/address-verify');

    // Enter address
    const input = page.locator('input[role="combobox"]').first();
    await input.fill('456 Oak Ave');

    // Select suggestion
    const suggestion = page.getByText('456 Oak Ave, Portland, OR 97201');
    await suggestion.waitFor({ state: 'visible', timeout: 5000 });
    await suggestion.click();

    // Should see MISSING_UNIT screen
    await expect(page.getByText('Add your Apt / Unit')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/multi-unit building/i)).toBeVisible();

    // Click unit prefix chip
    await page.getByRole('button', { name: 'Apt' }).click();

    // Enter unit number
    const unitInput = page.locator('#unit-input');
    await unitInput.clear();
    await unitInput.fill('Apt 4B');

    // Click Confirm Unit
    await page.getByRole('button', { name: /confirm unit/i }).click();

    // Should transition to ConfirmAddress (OK)
    await expect(page.getByText('Verified address')).toBeVisible({ timeout: 10000 });

    // Click Continue
    await page.getByRole('button', { name: /continue/i }).click();

    // Should arrive at home setup
    await expect(page.getByTestId('home-setup-screen')).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================
// TEST 3: Business redirect — BUSINESS → create business
// ============================================================

test.describe('TEST 3: Business address redirect', () => {
  test('business address → BUSINESS verdict → click Create Business Profile → business onboarding', async ({ page }) => {
    await setupCommonMocks(page, async (path, method, route) => {
      const pathname = path.split('?')[0];

      if (pathname === '/api/geo/autocomplete') {
        return json(route, makeSuggestions('789 Commerce Blvd, Portland, OR 97201')), true;
      }

      if (pathname === '/api/geo/resolve' && method === 'POST') {
        return json(route, makeNormalizeResponse('789 Commerce Blvd')), true;
      }

      if (pathname === '/api/v1/address/validate' && method === 'POST') {
        return json(route, makeValidateResponse('BUSINESS')), true;
      }

      return false;
    });

    await authed(page, '/app/address-verify');

    // Enter business address
    const input = page.locator('input[role="combobox"]').first();
    await input.fill('789 Commerce Blvd');

    const suggestion = page.getByText('789 Commerce Blvd, Portland, OR 97201');
    await suggestion.waitFor({ state: 'visible', timeout: 5000 });
    await suggestion.click();

    // Should see BUSINESS verdict screen
    await expect(page.getByText('This looks like a business address')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/commercial property/)).toBeVisible();

    // Should show business-related reasons
    await expect(page.getByText('RDI_COMMERCIAL')).toBeVisible();
    await expect(page.getByText('CMRA_MAILBOX')).toBeVisible();

    // Two option buttons should be visible
    await expect(page.getByText('Create a Business Profile')).toBeVisible();
    await expect(page.getByText('This is my home')).toBeVisible();

    // Click "Create a Business Profile"
    await page.getByText('Create a Business Profile').click();

    // Should arrive at business onboarding
    await expect(page.getByTestId('business-onboarding-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Create your business')).toBeVisible();
  });
});

// ============================================================
// TEST 4: Mail verification flow
// ============================================================

test.describe('TEST 4: Mail verification flow', () => {
  test('enter address → select mail verify → code sent → enter code → success → household created', async ({ page }) => {
    await setupCommonMocks(page, async (path, method, route) => {
      const pathname = path.split('?')[0];

      if (pathname === '/api/geo/autocomplete') {
        return json(route, makeSuggestions('555 Maple Dr, Portland, OR 97201')), true;
      }

      if (pathname === '/api/geo/resolve' && method === 'POST') {
        return json(route, makeNormalizeResponse('555 Maple Dr')), true;
      }

      // Validate returns MIXED_USE to trigger method selection
      if (pathname === '/api/v1/address/validate' && method === 'POST') {
        return json(route, {
          verdict: {
            status: 'MIXED_USE',
            reasons: ['RDI_RESIDENTIAL', 'PLACE_COMMERCIAL', 'BUILDING_MIXED_USE'],
            confidence: 0.5,
            normalized: makeNormalized({ line1: '555 Maple Dr' }),
            deliverability: makeDeliverability(),
            classification: { google_place_types: ['premise', 'store'], parcel_type: 'mixed', building_type: 'mixed_use' },
            candidates: [],
            next_actions: ['manual_review', 'send_mail_code'],
          },
          address_id: 'addr-mail-1',
        }), true;
      }

      // Start mail verification
      if (pathname === '/api/v1/address/verify/mail/start' && method === 'POST') {
        return json(route, {
          verification_id: 'ver-1',
          address_id: 'addr-mail-1',
          status: 'pending',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          cooldown_until: new Date(Date.now() + 60 * 1000).toISOString(),
          max_resends: 3,
          resends_remaining: 3,
        }), true;
      }

      // Confirm code → success
      if (pathname === '/api/v1/address/verify/mail/confirm' && method === 'POST') {
        return json(route, {
          status: 'confirmed',
          claim: {
            id: 'claim-1',
            user_id: 'u-test-1',
            address_id: 'addr-mail-1',
            claim_status: 'verified',
            verification_method: 'mail_code',
            confidence: 0.8,
            verdict_status: 'OK',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        }), true;
      }

      return false;
    });

    await authed(page, '/app/address-verify');

    // Enter address
    const input = page.locator('input[role="combobox"]').first();
    await input.fill('555 Maple Dr');

    const suggestion = page.getByText('555 Maple Dr, Portland, OR 97201');
    await suggestion.waitFor({ state: 'visible', timeout: 5000 });
    await suggestion.click();

    // Should see MIXED_USE screen with verification options
    await expect(page.getByText('Mixed-use address')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Choose a verification method')).toBeVisible();

    // Click Mail Code option
    await page.getByText('Mail Code').click();

    // Should transition to MailVerificationFlow — start screen
    await expect(page.getByText('Verify this home by mail')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Send verification code')).toBeVisible();

    // Click "Send verification code"
    await page.getByRole('button', { name: /send verification code/i }).click();

    // Should see "Code sent!" screen
    await expect(page.getByText('Code sent!')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/verification code is on its way/)).toBeVisible();

    // Click "Enter code"
    await page.getByRole('button', { name: /enter code/i }).click();

    // Should see code entry screen
    await expect(page.getByText('Enter your verification code')).toBeVisible({ timeout: 5000 });

    // Enter 6-digit code in individual inputs
    const digitInputs = page.locator('input[aria-label^="Digit"]');
    await expect(digitInputs).toHaveCount(6);

    const code = '123456';
    for (let i = 0; i < 6; i++) {
      await digitInputs.nth(i).fill(code[i]);
    }

    // Wait for auto-submit or click Submit
    // The component auto-submits when the 6th digit is entered.
    // But we can also manually click Submit to be safe.
    const submitBtn = page.getByRole('button', { name: /submit/i });
    if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await submitBtn.click();
    }

    // Should see success screen
    await expect(page.getByText('Welcome home!')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Your address has been verified')).toBeVisible();

    // Click Continue
    await page.getByRole('button', { name: /continue/i }).click();

    // Should see household created screen
    await expect(page.getByTestId('household-created-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Household created!')).toBeVisible();
  });
});

// ============================================================
// TEST 5: Conflict flow — existing household
// ============================================================

test.describe('TEST 5: Conflict flow', () => {
  test('address with existing household → CONFLICT → Request to Join → pending status', async ({ page }) => {
    await setupCommonMocks(page, async (path, method, route) => {
      const pathname = path.split('?')[0];

      if (pathname === '/api/geo/autocomplete') {
        return json(route, makeSuggestions('321 Elm St, Portland, OR 97201')), true;
      }

      if (pathname === '/api/geo/resolve' && method === 'POST') {
        return json(route, makeNormalizeResponse('321 Elm St')), true;
      }

      if (pathname === '/api/v1/address/validate' && method === 'POST') {
        return json(route, makeValidateResponse('CONFLICT')), true;
      }

      return false;
    });

    await authed(page, '/app/address-verify');

    // Enter address
    const input = page.locator('input[role="combobox"]').first();
    await input.fill('321 Elm St');

    const suggestion = page.getByText('321 Elm St, Portland, OR 97201');
    await suggestion.waitFor({ state: 'visible', timeout: 5000 });
    await suggestion.click();

    // Should see CONFLICT screen
    await expect(page.getByText('Address already has a household')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/someone has already registered/i)).toBeVisible();

    // Should show member count
    await expect(page.getByText(/3 members currently registered/)).toBeVisible();

    // Should show three options
    await expect(page.getByText('Request to Join')).toBeVisible();
    await expect(page.getByText("I'm the Owner")).toBeVisible();
    await expect(page.getByText("I'm a Property Manager")).toBeVisible();

    // Click "Request to Join"
    await page.getByText('Request to Join').click();

    // Should show message field and submit button
    await expect(page.getByText('Add a message')).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: /send join request/i })).toBeVisible();

    // Click "Send Join Request"
    await page.getByRole('button', { name: /send join request/i }).click();

    // Should see pending status
    await expect(page.getByTestId('conflict-pending-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Request pending')).toBeVisible();
    await expect(page.getByText(/notified when the household responds/)).toBeVisible();
  });
});

// ============================================================
// TEST 6: Undeliverable — bad address
// ============================================================

test.describe('TEST 6: Undeliverable address', () => {
  test('bad address → UNDELIVERABLE → see error with suggestions → edit address', async ({ page }) => {
    await setupCommonMocks(page, async (path, method, route) => {
      const pathname = path.split('?')[0];

      if (pathname === '/api/geo/autocomplete') {
        return json(route, makeSuggestions('999 Nowhere Ln, Portland, OR 97201')), true;
      }

      if (pathname === '/api/geo/resolve' && method === 'POST') {
        return json(route, makeNormalizeResponse('999 Nowhere Ln')), true;
      }

      if (pathname === '/api/v1/address/validate' && method === 'POST') {
        return json(route, makeValidateResponse('UNDELIVERABLE')), true;
      }

      return false;
    });

    await authed(page, '/app/address-verify');

    // Enter bad address
    const input = page.locator('input[role="combobox"]').first();
    await input.fill('999 Nowhere Ln');

    const suggestion = page.getByText('999 Nowhere Ln, Portland, OR 97201');
    await suggestion.waitFor({ state: 'visible', timeout: 5000 });
    await suggestion.click();

    // Should see UNDELIVERABLE screen
    await expect(page.getByText('Address not deliverable')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/can't receive mail/i)).toBeVisible();

    // Should show DPV_NO_MATCH and USPS_VACANT reasons
    await expect(page.getByText('DPV_NO_MATCH')).toBeVisible();
    await expect(page.getByText('USPS_VACANT')).toBeVisible();

    // Should show "Edit Address" button
    await expect(page.getByRole('button', { name: /edit address/i })).toBeVisible();

    // Should show "Edit address" back link
    await expect(page.getByText('Edit address')).toBeVisible();

    // Click "Edit Address" button
    await page.getByRole('button', { name: /edit address/i }).click();

    // Should return to address search (idle phase)
    await expect(page.getByText('Enter your address')).toBeVisible({ timeout: 5000 });

    // Autocomplete input should be visible again
    await expect(page.locator('input[role="combobox"]').first()).toBeVisible();
  });
});

// ============================================================
// Additional: Validation loading spinner
// ============================================================

test.describe('Validation loading state', () => {
  test('shows loading spinner while validating', async ({ page }) => {
    await setupCommonMocks(page, async (path, method, route) => {
      const pathname = path.split('?')[0];

      if (pathname === '/api/geo/autocomplete') {
        return json(route, makeSuggestions('123 Main St, Portland, OR 97201')), true;
      }

      if (pathname === '/api/geo/resolve' && method === 'POST') {
        return json(route, makeNormalizeResponse('123 Main St')), true;
      }

      // Delay the validate response to test loading state
      if (pathname === '/api/v1/address/validate' && method === 'POST') {
        await new Promise((r) => setTimeout(r, 1000));
        return json(route, makeValidateResponse('OK')), true;
      }

      return false;
    });

    await authed(page, '/app/address-verify');

    const input = page.locator('input[role="combobox"]').first();
    await input.fill('123 Main St');

    const suggestion = page.getByText('123 Main St, Portland, OR 97201');
    await suggestion.waitFor({ state: 'visible', timeout: 5000 });
    await suggestion.click();

    // Should show loading spinner
    await expect(page.getByText('Validating your address...')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Checking with Google, USPS, and local records')).toBeVisible();

    // Eventually shows result
    await expect(page.getByText('Verified address')).toBeVisible({ timeout: 15000 });
  });
});

// ============================================================
// Additional: "Try a different address" back link
// ============================================================

test.describe('Back navigation', () => {
  test('clicking "Try a different address" returns to search', async ({ page }) => {
    await setupCommonMocks(page, async (path, method, route) => {
      const pathname = path.split('?')[0];

      if (pathname === '/api/geo/autocomplete') {
        return json(route, makeSuggestions('123 Main St, Portland, OR 97201')), true;
      }

      if (pathname === '/api/geo/resolve' && method === 'POST') {
        return json(route, makeNormalizeResponse('123 Main St')), true;
      }

      if (pathname === '/api/v1/address/validate' && method === 'POST') {
        return json(route, makeValidateResponse('OK')), true;
      }

      return false;
    });

    await authed(page, '/app/address-verify');

    // Complete flow to OK
    const input = page.locator('input[role="combobox"]').first();
    await input.fill('123 Main St');
    const suggestion = page.getByText('123 Main St, Portland, OR 97201');
    await suggestion.waitFor({ state: 'visible', timeout: 5000 });
    await suggestion.click();

    await expect(page.getByText('Verified address')).toBeVisible({ timeout: 10000 });

    // Click "Change address"
    await page.getByText('Change address').click();

    // Should return to search
    await expect(page.getByText('Enter your address')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[role="combobox"]').first()).toBeVisible();
  });
});
