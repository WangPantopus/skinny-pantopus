/**
 * P2.7 — Privacy preview page (/app/identity/preview).
 *
 * Asserts unified-IA §8.2:
 *   1. Page loads with default surface=local, viewer=public, and renders
 *      the visible + hidden panels using the response from view-as.
 *   2. Switching the viewer triggers a new view-as call with the new
 *      mode and the updated visible payload renders.
 *   3. Switching the surface to persona repopulates the viewer dropdown
 *      with persona-only modes (no household/business teammate options).
 *   4. The sample posts in the view-as payload carry media_live_urls
 *      alongside the other three parallel media arrays, so a Beacon's
 *      Live Photos are previewed as Live Photos rather than silently
 *      downgraded to stills.
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ViewAsPreviewPost } from '@pantopus/types';
import { resolvePostMediaSlots } from '@/components/feed/PostMediaGrid';

const apiMock = require('@pantopus/api');

/**
 * Shaped exactly like one entry of `sample.posts`, which the server builds
 * by copying SAFE_PREVIEW_POST_FIELDS off the row
 * (backend/routes/identityCenter.js:57-90). The `ViewAsPreviewPost`
 * annotation is load-bearing: tsconfig includes tests/, so dropping
 * media_live_urls from the type again fails `tsc --noEmit`, not just this
 * assertion.
 */
const LIVE_PHOTO_SAMPLE_POST: ViewAsPreviewPost = {
  id: 'post-live-1',
  content: 'Behind the scenes',
  media_urls: ['https://cdn.test/still.jpg', 'https://cdn.test/plain.jpg'],
  media_types: ['live_photo', 'live_photo'],
  // Slot 1's clip is blank — the padding the serializers emit when the
  // companion upload never landed.
  media_live_urls: ['https://cdn.test/clip.mov', ''],
  visibility: 'public',
  created_at: '2026-05-08T10:00:00Z',
};

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/app/identity/preview',
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  apiMock.identityCenter.getViewAsPreview.mockImplementation((opts: any) => {
    if (opts?.surface === 'persona') {
      return Promise.resolve({
        surface: 'persona',
        viewer: opts.viewer,
        visible: {
          type: 'persona', id: 'p1', handle: 'mayabuilds',
          displayName: 'Maya Builds', followerCount: 12,
          bridges: { localProfile: null },
        },
        hidden: ['email', 'phone', 'address', 'home_id', 'user_id', 'first_name', 'last_name'],
        sample: { posts: [LIVE_PHOTO_SAMPLE_POST], broadcasts: [] },
      });
    }
    if (opts?.viewer === 'public') {
      return Promise.resolve({
        surface: 'local',
        viewer: 'public',
        visible: {
          type: 'local', id: 'lp1', handle: 'maya',
          displayName: 'Maya Builds',
          viewer: { canMessage: false, relationshipStatus: 'none', isFollowingLocal: false },
        },
        hidden: ['email', 'phone', 'address', 'home_id', 'user_id'],
      });
    }
    if (opts?.viewer === 'neighbor') {
      return Promise.resolve({
        surface: 'local',
        viewer: 'neighbor',
        visible: {
          type: 'local', id: 'lp1', handle: 'maya',
          displayName: 'Maya Builds',
          viewer: { canMessage: true, relationshipStatus: 'accepted', isFollowingLocal: true },
        },
        hidden: ['email', 'phone', 'address', 'home_id'],
      });
    }
    return Promise.resolve({
      surface: opts?.surface || 'local',
      viewer: opts?.viewer || 'public',
      visible: { type: opts?.surface || 'local', id: 'x', handle: 'h' },
      hidden: ['email'],
    });
  });
});

afterEach(() => cleanup());

function loadPage() {
  const Page = require('../src/app/(app)/app/identity/preview/page').default;
  return render(<Page />);
}

describe('Privacy preview page (P2.7)', () => {
  test('loads with default surface=local viewer=public and renders visible + hidden panels', async () => {
    loadPage();

    await waitFor(() => {
      expect(apiMock.identityCenter.getViewAsPreview).toHaveBeenCalledWith({
        surface: 'local',
        viewer: 'public',
      });
    });

    const visiblePanel = await screen.findByTestId('privacy-preview-visible');
    const hiddenPanel = screen.getByTestId('privacy-preview-hidden');
    expect(visiblePanel).toHaveTextContent('Maya Builds');
    expect(hiddenPanel).toHaveTextContent('email');
    expect(hiddenPanel).toHaveTextContent('home_id');
  });

  test('switching viewer to neighbor refetches and updates the visible panel', async () => {
    loadPage();
    await waitFor(() => expect(apiMock.identityCenter.getViewAsPreview).toHaveBeenCalled());

    const select = await screen.findByTestId('privacy-preview-viewer');
    act(() => {
      fireEvent.change(select, { target: { value: 'neighbor' } });
    });

    await waitFor(() => {
      expect(apiMock.identityCenter.getViewAsPreview).toHaveBeenCalledWith({
        surface: 'local',
        viewer: 'neighbor',
      });
    });

    // Connection viewer's `canMessage: true` ends up in the visible
    // panel; the public-viewer assertion above had `canMessage: false`.
    const visiblePanel = await screen.findByTestId('privacy-preview-visible');
    await waitFor(() => expect(visiblePanel).toHaveTextContent(/"canMessage":\s*true/));
  });

  test('switching surface to persona shows persona-only viewer modes', async () => {
    loadPage();
    await waitFor(() => expect(apiMock.identityCenter.getViewAsPreview).toHaveBeenCalled());

    const surfaceSelect = await screen.findByTestId('privacy-preview-surface');
    act(() => {
      fireEvent.change(surfaceSelect, { target: { value: 'persona' } });
    });

    await waitFor(() => {
      expect(apiMock.identityCenter.getViewAsPreview).toHaveBeenCalledWith(
        expect.objectContaining({ surface: 'persona' }),
      );
    });

    const viewerSelect = screen.getByTestId('privacy-preview-viewer') as HTMLSelectElement;
    const optionLabels = Array.from(viewerSelect.querySelectorAll('option')).map((o) => o.value);
    // Persona surface lists Public + persona_follower / member / insider.
    expect(optionLabels).toEqual(expect.arrayContaining(['public', 'persona_follower', 'persona_member', 'persona_insider']));
    // Personal-zone-only viewers must NOT appear when the surface is
    // persona (household/business teammate are personal-side).
    expect(optionLabels).not.toContain('household_member');
    expect(optionLabels).not.toContain('business_teammate');
  });

  test('the persona view-as payload carries media_live_urls parallel to media_urls', async () => {
    loadPage();
    await waitFor(() => expect(apiMock.identityCenter.getViewAsPreview).toHaveBeenCalled());

    act(() => {
      fireEvent.change(screen.getByTestId('privacy-preview-surface'), { target: { value: 'persona' } });
    });
    await waitFor(() => {
      expect(apiMock.identityCenter.getViewAsPreview).toHaveBeenCalledWith(
        expect.objectContaining({ surface: 'persona' }),
      );
    });
    // The panels render from the same response the sample posts ride on.
    await waitFor(() => expect(screen.getByTestId('privacy-preview-visible')).toHaveTextContent('mayabuilds'));

    const preview = await apiMock.identityCenter.getViewAsPreview.mock.results.at(-1)!.value;
    const post: ViewAsPreviewPost = preview.sample.posts[0];
    expect(post.media_live_urls).toHaveLength(post.media_urls!.length);

    // Run the payload through the production resolver rather than
    // eyeballing the arrays: the preview's promise is that what it shows
    // is what the real surface shows, so slot 0 has to come out live and
    // slot 1 — the blank clip — has to come out as a plain still.
    expect(
      resolvePostMediaSlots(post.media_urls!, post.media_types!, post.media_live_urls!),
    ).toEqual([
      { kind: 'live', liveUrl: 'https://cdn.test/clip.mov' },
      { kind: 'image', liveUrl: '' },
    ]);

    // media_live_urls is visible-side data, never a firewalled personal
    // field — it must not turn up in the "Hidden from this viewer" list.
    expect(screen.getByTestId('privacy-preview-hidden')).not.toHaveTextContent('media_live_urls');
  });
});
