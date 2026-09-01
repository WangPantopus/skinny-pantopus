/**
 * The public Beacon page (/persona/[handle]) — post media.
 *
 * Its PostMediaGrid used to be called with three of the four parallel
 * arrays and no `onPress`: every Live Photo silently degraded to a still,
 * and each tile was a <button> that did nothing when clicked. Both halves
 * are asserted here, because either one alone still leaves the surface
 * broken — a live tile with nowhere to escalate is as useless as a still.
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

const apiMock = require('@pantopus/api');

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    require('react').createElement('a', { href: String(href), ...props }, children),
}));

// The page reads `audience_profile` through react-query; these tests render
// without a QueryClientProvider, so the hook is stubbed the same way
// identityFirewallWeb.test.tsx stubs it.
jest.mock('@/hooks/useFeatureFlag', () => ({
  useFeatureFlag: () => false,
  useFeatureFlagState: () => ({ enabled: false, isLoading: false, isFetched: true, error: null }),
}));

const PERSONA = {
  type: 'persona',
  id: 'persona-1',
  handle: 'mayabuilds',
  displayName: 'Maya Builds',
  avatarUrl: null,
  bannerUrl: null,
  bio: 'Beacon for tutorials',
  href: '/@mayabuilds',
  publicLinks: [],
  category: 'creator',
  audienceLabel: 'followers',
  audienceMode: 'open',
  followerCount: 42,
  postCount: 1,
  broadcastEnabled: true,
  viewer: {
    isFollowing: false,
    relationshipType: null,
    notificationLevel: 'all',
    followStatus: 'none',
    isOwner: false,
  },
  bridges: { localProfile: null },
};

/** One post, slot 0 a Live Photo and slot 1 a still, as the route returns them. */
const LIVE_POST = {
  id: 'post-1',
  content: 'Workshop tour',
  post_type: 'general',
  created_at: '2026-05-08T10:00:00Z',
  media_urls: ['https://cdn.test/still.jpg', 'https://cdn.test/plain.jpg'],
  media_types: ['live_photo', 'image'],
  media_thumbnails: ['https://cdn.test/thumb.jpg', ''],
  media_live_urls: ['https://cdn.test/clip.mov', ''],
};

beforeEach(() => {
  jest.clearAllMocks();
  apiMock.personas.getPersona.mockResolvedValue({ persona: PERSONA });
  // Not on the shared mock module; assigned here so this file does not
  // reshape a fixture every other suite depends on.
  apiMock.personas.getPersonaPosts = jest.fn().mockResolvedValue({ posts: [LIVE_POST] });
  apiMock.personas.updatePersonaFollowPreferences = jest.fn();
  apiMock.broadcast.getBroadcastMessages.mockResolvedValue({ messages: [], analytics: null });
  apiMock.personaTiers.listPublicTiers.mockResolvedValue({ tiers: [] });
});

afterEach(() => cleanup());

function renderPage() {
  const AudienceProfileClient = require('@/app/persona/[personaHandle]/AudienceProfileClient').default;
  return render(
    <AudienceProfileClient
      initialPersona={PERSONA as any}
      initialChannel={null}
      appUrl="pantopus://persona/mayabuilds"
      linkHref="https://pantopus.com/persona/mayabuilds"
      fallbackUrl={null}
      storeCta={null}
    />,
  );
}

describe('Public Beacon page post media', () => {
  it('renders slot 0 as a Live Photo tile and slot 1 as a plain still', async () => {
    const { container } = renderPage();
    await waitFor(() => expect(screen.getAllByTestId('livePhotoTile')).toHaveLength(1));
    // Two cells, one of them the tile — the still is untouched.
    expect(container.querySelectorAll('img')).toHaveLength(2);
  });

  it('tapping a Live Photo opens the viewer with the LIVE replay pill', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('livePhotoTile')).toBeInTheDocument());
    expect(screen.queryByTestId('post-media-lightbox')).toBeNull();

    fireEvent.click(screen.getByTestId('livePhotoTile'));

    const lightbox = await screen.findByTestId('post-media-lightbox');
    // The viewer's own tile is the replay-pill variant — the web analogue
    // of the "LIVE" pill the native full-screen viewers show.
    expect(within(lightbox).getByTestId('livePhotoReplay')).toHaveAttribute('aria-label', 'Play Live Photo');
    expect(within(lightbox).getByText('1 / 2')).toBeInTheDocument();
  });

  it('closes the viewer on Escape', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('livePhotoTile')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('livePhotoTile'));
    await screen.findByTestId('post-media-lightbox');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('post-media-lightbox')).toBeNull());
  });
});
