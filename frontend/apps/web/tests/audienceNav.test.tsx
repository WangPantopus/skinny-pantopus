/**
 * P2.2 — visual zone treatment + Audience tab in primary nav.
 *
 * Asserts the unified-IA §3.1, §3.2, §3.6 contract:
 *   1. Users with audience_profile ON see an Audience item in the
 *      primary sidebar.
 *   2. Users with the flag OFF do not see the item.
 *   3. Tapping Audience navigates to /app/audience.
 *   4. The Audience item carries the teal accent (data-accent="teal")
 *      so the visual zone cue is unmissable.
 *   5. Every page under /app/audience/** mounts AudienceZoneHeader.
 *   6. Personal-zone pages (Feed, Marketplace, Messages, Tasks, Hub)
 *      do NOT mount AudienceZoneHeader.
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockPush = jest.fn();
const mockPrefetch = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, prefetch: mockPrefetch }),
  usePathname: () => '/app/hub',
  useSearchParams: () => new URLSearchParams(),
}));

const apiMock = require('@pantopus/api');

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  apiMock.featureFlags.getFeatureFlag.mockResolvedValue({ enabled: false });
  apiMock.personas.getMyPersona.mockResolvedValue({ persona: null });
  apiMock.hub.getHub.mockResolvedValue({});
  apiMock.chat.getUnifiedConversations.mockResolvedValue({ conversations: [] });
});

afterEach(() => cleanup());

describe('Audience primary-nav tab (P2.2)', () => {
  function renderSidebar() {
    const { PersonalSidebarContent } = require('../src/components/AppShell');
    return renderWithClient(
      <PersonalSidebarContent
        currentPath="/app/hub"
        showLabels
        chatUnread={0}
        offersPending={0}
        activeListings={0}
        onNavigate={() => {}}
      />,
    );
  }

  test('flag OFF: Audience item is not in the sidebar', async () => {
    apiMock.featureFlags.getFeatureFlag.mockResolvedValue({ enabled: false });
    renderSidebar();

    // Wait for the flag query to settle.
    await waitFor(() => {
      expect(apiMock.featureFlags.getFeatureFlag).toHaveBeenCalledWith('audience_profile');
    });
    // The Audience entry must be absent.
    expect(screen.queryByTestId('sidebar-audience')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Audience' })).not.toBeInTheDocument();
  });

  test('flag ON: Audience item renders with the teal zone accent', async () => {
    apiMock.featureFlags.getFeatureFlag.mockResolvedValue({ enabled: true });
    renderSidebar();

    const audience = await screen.findByTestId('sidebar-audience');
    expect(audience).toBeInTheDocument();
    expect(audience).toHaveAttribute('data-accent', 'teal');
    expect(audience).toHaveTextContent('Audience');
  });

  test('flag ON: tapping Audience navigates to /app/audience', async () => {
    apiMock.featureFlags.getFeatureFlag.mockResolvedValue({ enabled: true });
    renderSidebar();

    const audience = await screen.findByTestId('sidebar-audience');
    act(() => {
      audience.click();
    });
    expect(mockPush).toHaveBeenCalledWith('/app/audience');
  });

  test('flag ON: Audience tab on /app/audience reports active state', async () => {
    apiMock.featureFlags.getFeatureFlag.mockResolvedValue({ enabled: true });
    const { PersonalSidebarContent } = require('../src/components/AppShell');
    renderWithClient(
      <PersonalSidebarContent
        currentPath="/app/audience"
        showLabels
        chatUnread={0}
        offersPending={0}
        activeListings={0}
        onNavigate={() => {}}
      />,
    );

    const audience = await screen.findByTestId('sidebar-audience');
    expect(audience).toHaveAttribute('data-active', 'true');
    // Other primary items must NOT be active when the user is in audience zone.
    expect(screen.getByRole('button', { name: 'Hub' })).toHaveAttribute('data-active', 'false');
  });
});

describe('AudienceZoneHeader coverage (P2.2)', () => {
  // Source-level checks: every audience-zone page imports + renders
  // <AudienceZoneHeader />, and Personal-zone pages do not.
  const AUDIENCE_PAGES = [
    'app/(app)/app/audience/page.tsx',
    'app/(app)/app/audience/setup/page.tsx',
    'app/(app)/app/audience/manage/tiers/page.tsx',
    'app/(app)/app/audience/manage/blocks/page.tsx',
    'app/(app)/app/audience/inbox/page.tsx',
    'app/(app)/app/audience/inbox/[membershipId]/page.tsx',
    'app/(app)/app/audience/membership/[personaId]/page.tsx',
    'app/(app)/app/audience/membership/[personaId]/inbox/page.tsx',
  ];

  const PERSONAL_PAGES = [
    'app/(app)/app/feed/post/[id]/page.tsx',
    'app/(app)/app/marketplace/ListingCard.tsx',
    'app/(app)/app/gigs/page.tsx',
    'app/(app)/app/my-gigs/page.tsx',
    'app/(app)/app/my-bids/page.tsx',
    'app/(app)/app/profile/page.tsx',
    'app/(app)/app/hub/page.tsx',
  ];

  test.each(AUDIENCE_PAGES)(
    '%s mounts AudienceZoneHeader',
    (rel) => {
      const file = path.resolve(__dirname, '..', 'src', rel);
      const source = fs.readFileSync(file, 'utf8');
      expect(source).toMatch(/from\s+['"]@\/components\/AudienceZoneHeader['"]/);
      expect(source).toMatch(/<AudienceZoneHeader\b/);
    },
  );

  test.each(PERSONAL_PAGES)(
    '%s does NOT import AudienceZoneHeader',
    (rel) => {
      const file = path.resolve(__dirname, '..', 'src', rel);
      if (!fs.existsSync(file)) return;
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/AudienceZoneHeader/);
    },
  );

  test('AudienceZoneHeader renders the persistent zone cue and persona handle', () => {
    const { AudienceZoneHeader } = require('../src/components/AudienceZoneHeader');
    const { container } = render(
      <AudienceZoneHeader handle="mayabuilds" displayName="Maya Builds" />,
    );

    expect(screen.getByRole('banner', { name: /Audience profile zone/i })).toBeInTheDocument();
    expect(screen.getByText('Beacon')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /@mayabuilds/i })).toHaveAttribute('href', '/@mayabuilds');
    // Teal border-bottom is the persistent visual cue.
    const banner = container.querySelector('[data-zone="audience"]');
    expect(banner).not.toBeNull();
    expect(banner!.className).toMatch(/border-teal-200/);
    expect(banner!.className).toMatch(/bg-teal-50/);
  });
});

describe('Audience destination empty state (unified-IA §3.3)', () => {
  test('empty-state CTAs exist on /app/audience for users without a persona', () => {
    const file = path.resolve(
      __dirname,
      '..',
      'src',
      'app/(app)/app/audience/page.tsx',
    );
    const source = fs.readFileSync(file, 'utf8');
    expect(source).toMatch(/Create a Beacon/);
    expect(source).toMatch(/Browse Beacons/);
    expect(source).toMatch(/href="\/app\/audience\/setup"/);
  });
});
