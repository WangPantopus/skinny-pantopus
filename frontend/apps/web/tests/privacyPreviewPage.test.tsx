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
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const apiMock = require('@pantopus/api');

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
});
