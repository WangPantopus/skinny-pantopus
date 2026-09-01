/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockReplace = jest.fn();
const mockPush    = jest.fn();
// IMPORTANT: keep the router object STABLE across renders. Returning a
// new object literal from useRouter() would change reference every render
// and infinite-loop any useEffect that lists `router` in its deps.
const stableRouter = { replace: mockReplace, push: mockPush };
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => stableRouter,
  useSearchParams: () => mockSearchParams,
  redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); },
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: any) =>
    React.createElement('a', { href: String(href), ...props }, children),
}));

jest.mock('@/components/ui/toast-store', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

const mockFlagEnabled = jest.fn().mockReturnValue(true);
jest.mock('@/hooks/useFeatureFlag', () => ({
  useFeatureFlag: (name: string) => mockFlagEnabled(name),
  useFeatureFlagState: (name: string) => ({
    enabled: mockFlagEnabled(name),
    isLoading: false,
    isFetched: true,
    error: null,
  }),
}));

jest.mock('@/lib/featureFlags', () => ({
  webFeatureFlags: {
    identityFirewall: true,
    persona: true,
    personaBroadcast: true,
    personaPaidMemberships: true,
  },
}));

const apiMock = require('@pantopus/api');

const PERSONA_ID = '44444444-4444-4444-4444-444444444444';

function tierFixture(rank: number, overrides: Record<string, unknown> = {}) {
  const defaults: Record<number, any> = {
    1: { name: 'Follower', priceCents: 0, msgThreadsPerPeriod: null,
         creatorCanInitiateDm: false, replyPolicy: 'discretion',
         stripePriceId: null },
    2: { name: 'Member', priceCents: 500, msgThreadsPerPeriod: 5,
         creatorCanInitiateDm: false, replyPolicy: 'discretion',
         stripePriceId: null },
    3: { name: 'Insider', priceCents: 1500, msgThreadsPerPeriod: 25,
         creatorCanInitiateDm: true, replyPolicy: 'within_7_days',
         stripePriceId: null },
  };
  const base = defaults[rank];
  return {
    id: `tier-${rank}`,
    rank,
    description: `${base.name} description`,
    currency: 'USD',
    billingInterval: 'month',
    videoCallsPerPeriod: null,
    videoCallDurationMinutes: null,
    status: 'active',
    position: rank,
    ...base,
    ...overrides,
  };
}

function setApiMocks({
  myPersona = { persona: { id: PERSONA_ID, handle: 'mayabuilds', displayName: 'Maya Builds', followerCount: 12 }, channel: null },
  ownerTiers = [tierFixture(1), tierFixture(2), tierFixture(3)],
  paymentsStatus = { hasAccount: false, ready: false },
}: { myPersona?: any; ownerTiers?: any[]; paymentsStatus?: any } = {}) {
  apiMock.personas.getMyPersona.mockResolvedValue(myPersona);
  apiMock.personaTiers.listOwnerTiers.mockResolvedValue({ tiers: ownerTiers });
  apiMock.personaTiers.updateTier.mockImplementation(
    async (_pid: string, tierId: string, payload: any) => {
      const found = ownerTiers.find((t) => t.id === tierId);
      const next = { ...found };
      if ('name' in payload) next.name = payload.name;
      if ('description' in payload) next.description = payload.description;
      if ('price_cents' in payload) next.priceCents = payload.price_cents;
      if ('msg_threads_per_period' in payload) next.msgThreadsPerPeriod = payload.msg_threads_per_period;
      if ('reply_policy' in payload) next.replyPolicy = payload.reply_policy;
      if ('creator_can_initiate_dm' in payload) next.creatorCanInitiateDm = payload.creator_can_initiate_dm;
      return { tier: next };
    },
  );
  apiMock.personaPayments.getOnboardingStatus.mockResolvedValue({ status: paymentsStatus });
  apiMock.personaPayments.startOnboarding.mockResolvedValue({
    url: 'https://connect.stripe.test/onboarding/mock',
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFlagEnabled.mockReturnValue(true);
  mockSearchParams = new URLSearchParams();
  setApiMocks();
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// AudienceZoneHeader
// ---------------------------------------------------------------------------
describe('AudienceZoneHeader', () => {
  test('renders teal-accented banner with "Beacon" label', () => {
    const { AudienceZoneHeader } = require('@/components/AudienceZoneHeader');
    render(<AudienceZoneHeader handle="mayabuilds" displayName="Maya Builds" />);
    expect(screen.getByText('Beacon')).toBeInTheDocument();
    expect(screen.getByText('@mayabuilds')).toBeInTheDocument();
    const banner = screen.getByRole('banner');
    expect(banner.dataset.zone).toBe('audience');
    expect(banner.className).toMatch(/teal/);
  });
});

// ---------------------------------------------------------------------------
// TierEditor
// ---------------------------------------------------------------------------
describe('TierEditor', () => {
  test('locks price input on rank 1 and shows "Free"', () => {
    const { TierEditor, tierToFormValues } = require('@/components/audience/TierEditor');
    const tier = tierFixture(1);
    const handler = jest.fn();
    render(
      <TierEditor tier={tier} values={tierToFormValues(tier)} onChange={handler} />,
    );
    const priceInput = screen.getByLabelText('Tier price (free, not editable)') as HTMLInputElement;
    expect(priceInput.disabled).toBe(true);
    expect(priceInput.value).toBe('Free');
  });

  test('shows insider-only DM toggle on rank 3', () => {
    const { TierEditor, tierToFormValues } = require('@/components/audience/TierEditor');
    const tier = tierFixture(3);
    render(
      <TierEditor tier={tier} values={tierToFormValues(tier)} onChange={jest.fn()} />,
    );
    expect(
      screen.getByText('Allow myself to start DM threads with these members'),
    ).toBeInTheDocument();
  });

  test('does NOT show insider-only DM toggle on rank 2', () => {
    const { TierEditor, tierToFormValues } = require('@/components/audience/TierEditor');
    const tier = tierFixture(2);
    render(
      <TierEditor tier={tier} values={tierToFormValues(tier)} onChange={jest.fn()} />,
    );
    expect(
      screen.queryByText('Allow myself to start DM threads with these members'),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// /app/audience dashboard
// ---------------------------------------------------------------------------
describe('AudienceDashboardPage', () => {
  test('with the flag off, redirects to /app/persona', async () => {
    mockFlagEnabled.mockReturnValue(false);
    const Page = require('@/app/(app)/app/audience/page').default;
    await act(async () => {
      render(<Page />);
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/app/persona'));
  });

  test('with the flag on, renders the 3-tab shell + status line', async () => {
    const Page = require('@/app/(app)/app/audience/page').default;
    await act(async () => {
      render(<Page />);
    });
    // The handle appears in two places (zone header link + status line),
    // so use getAllByText.
    expect((await screen.findAllByText(/mayabuilds/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/12 followers/)).toBeInTheDocument();
    expect(screen.getByText(/0 paying/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Updates/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Fans/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Inbox/ })).toBeInTheDocument();
    // "Coming soon" pill on the inactive tabs.
    const pills = screen.getAllByText(/Coming soon/);
    expect(pills.length).toBeGreaterThanOrEqual(2);
  });

  test('empty state renders when user has no persona', async () => {
    apiMock.personas.getMyPersona.mockResolvedValue({ persona: null, channel: null });
    const Page = require('@/app/(app)/app/audience/page').default;
    await act(async () => {
      render(<Page />);
    });
    expect(await screen.findByText('Build a public audience')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a Beacon' }))
      .toHaveAttribute('href', '/app/audience/setup');
  });
});

// ---------------------------------------------------------------------------
// /app/audience/manage/tiers
// ---------------------------------------------------------------------------
describe('ManageTiersPage', () => {
  test('renders all 3 tiers and a Save button', async () => {
    const Page = require('@/app/(app)/app/audience/manage/tiers/page').default;
    await act(async () => {
      render(<Page />);
    });
    expect(await screen.findByRole('heading', { name: 'Tier ladder' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Follower' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Member' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Insider' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save changes/ })).toBeInTheDocument();
  });

  test('shows the Stripe-not-connected banner when paid tiers lack stripe_price_id', async () => {
    const Page = require('@/app/(app)/app/audience/manage/tiers/page').default;
    await act(async () => {
      render(<Page />);
    });
    await screen.findByRole('heading', { name: 'Tier ladder' });
    expect(screen.getByRole('status').textContent)
      .toMatch(/Connect your Stripe account/);
  });

  test('hides the Stripe banner when paid tiers all have stripe_price_id', async () => {
    setApiMocks({
      ownerTiers: [
        tierFixture(1),
        tierFixture(2, { stripePriceId: 'price_member' }),
        tierFixture(3, { stripePriceId: 'price_insider' }),
      ],
    });
    const Page = require('@/app/(app)/app/audience/manage/tiers/page').default;
    await act(async () => {
      render(<Page />);
    });
    await screen.findByRole('heading', { name: 'Tier ladder' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// /app/audience/setup
// ---------------------------------------------------------------------------
describe('AudienceSetupPage', () => {
  test('jumps to step 2 when persona already exists', async () => {
    const Page = require('@/app/(app)/app/audience/setup/page').default;
    await act(async () => {
      render(<Page />);
    });
    // Step 2 heading appears.
    expect(await screen.findByRole('heading', { name: 'Configure your tiers' }))
      .toBeInTheDocument();
  });

  test('parks on step 1 when user has no persona', async () => {
    apiMock.personas.getMyPersona.mockResolvedValue({ persona: null, channel: null });
    const Page = require('@/app/(app)/app/audience/setup/page').default;
    await act(async () => {
      render(<Page />);
    });
    expect(await screen.findByRole('heading', { name: /Pick a handle/ }))
      .toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open profile setup' }))
      .toHaveAttribute('href', '/app/persona');
  });

  test('?step=3 lands on the Stripe Connect step with an enabled button', async () => {
    mockSearchParams = new URLSearchParams('step=3');
    const Page = require('@/app/(app)/app/audience/setup/page').default;
    await act(async () => {
      render(<Page />);
    });
    expect(await screen.findByRole('heading', { name: 'Stripe Connect' }))
      .toBeInTheDocument();
    // P1.7: button is now functional. It's enabled once status load
    // settles (the initial fetch returns hasAccount: false / ready:
    // false from the mock).
    const button = await screen.findByRole('button', { name: /Connect Stripe/ });
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  test('?step=3 with ready=true shows the connected confirmation', async () => {
    mockSearchParams = new URLSearchParams('step=3');
    setApiMocks({
      paymentsStatus: {
        hasAccount: true, ready: true,
        chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true,
      },
    });
    const Page = require('@/app/(app)/app/audience/setup/page').default;
    await act(async () => {
      render(<Page />);
    });
    expect(await screen.findByText(/Stripe is connected/)).toBeInTheDocument();
  });
});
