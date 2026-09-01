/**
 * P2.5 — Audience-zone composer.
 *
 * Asserts unified-IA §4.2 + §4.3 properties:
 *   1. The "Posting as" label is fixed to the persona handle — there is
 *      no picker and no way for the user to switch the signature.
 *   2. The "Visible to" dropdown offers exactly Public / Followers /
 *      Members / Insiders. None of the personal-zone audiences (Nearby,
 *      Connections, Place, Household, Target Area) appear.
 *   3. Submitting with the Members option calls
 *      api.broadcast.publishBroadcastMessage with
 *      { visibility: 'tier_or_above', target_tier_rank: 2 }.
 *   4. Reach counts come from getMembershipStats and render alongside
 *      each visibility option.
 *   5. The component never renders any home/business/place selector.
 *
 * Plus the media contract: POST /api/upload/post-media answers with FOUR
 * parallel arrays and the optimistic message handed to `onPosted` has to
 * carry all four across, or the just-published update renders without its
 * video posters and with every Live Photo downgraded to a dead still until
 * the next refetch.
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const apiMock = require('@pantopus/api');

beforeEach(() => {
  jest.clearAllMocks();
  apiMock.personas.getMembershipStats.mockResolvedValue({
    counts: { followers: 1200, members: 14, insiders: 3, direct: 1 },
  });
  apiMock.broadcast.publishBroadcastMessage.mockResolvedValue({
    message: {
      id: 'msg-1',
      channel_id: 'channel-1',
      persona_id: 'persona-1',
      body: 'Audience update',
      visibility: 'tier_or_above',
      target_tier_rank: 2,
      status: 'published',
      media: [],
      delivered_count: 0,
      read_count: 0,
      created_at: '2026-05-08T10:00:00Z',
    },
  });
});

afterEach(() => cleanup());

function renderComposer(overrides: Record<string, any> = {}) {
  const { AudienceComposer } = require('../src/components/audience/AudienceComposer');
  return render(
    <AudienceComposer
      personaId="persona-1"
      personaHandle="mayabuilds"
      channelId="channel-1"
      {...overrides}
    />,
  );
}

describe('AudienceComposer (P2.5)', () => {
  test('Posting-as label is fixed to the persona handle (no picker)', () => {
    renderComposer();
    const label = screen.getByTestId('audience-composer-posting-as');
    expect(label).toHaveTextContent('Posting as');
    expect(label).toHaveTextContent('@mayabuilds');
    // No "Change" button (PostComposer's picker affordance) — the
    // signature is fixed.
    expect(screen.queryByRole('button', { name: /^Change$/ })).not.toBeInTheDocument();
    // Persona-zone marker for serializer-style asserts.
    const composer = screen.getByTestId('audience-composer');
    expect(composer).toHaveAttribute('data-zone', 'audience');
  });

  test('Visible-to dropdown offers exactly Public/Followers/Members/Insiders — no personal-zone audiences', async () => {
    renderComposer();
    // Wait until reach counts have rendered so the option labels are
    // their final values.
    await waitFor(() => {
      const select = screen.getByTestId('audience-composer-visibility') as HTMLSelectElement;
      const labels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent || '');
      expect(labels[1]).toMatch(/reach/);
    });

    const select = screen.getByTestId('audience-composer-visibility') as HTMLSelectElement;
    const optionLabels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent || '');
    expect(optionLabels).toHaveLength(4);
    expect(optionLabels[0]).toMatch(/^Public/);
    expect(optionLabels[1]).toMatch(/^Followers/);
    expect(optionLabels[2]).toMatch(/^Members/);
    expect(optionLabels[3]).toMatch(/^Insiders/);

    // Forbidden personal-zone audience values must not appear anywhere
    // in the composer markup.
    const composerHtml = screen.getByTestId('audience-composer').innerHTML;
    for (const forbidden of ['Nearby', 'Connections', 'Household', 'Target Area', 'Home Place']) {
      expect(composerHtml).not.toContain(forbidden);
    }
  });

  test('Members submit calls publishBroadcastMessage with tier_or_above + rank 2', async () => {
    const onPosted = jest.fn();
    renderComposer({ onPosted });
    await waitFor(() => expect(apiMock.personas.getMembershipStats).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('audience-composer-body'), {
      target: { value: 'Members-only update' },
    });
    fireEvent.change(screen.getByTestId('audience-composer-visibility'), {
      target: { value: 'members' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('audience-composer-submit'));
    });

    expect(apiMock.broadcast.publishBroadcastMessage).toHaveBeenCalledWith('channel-1', {
      body: 'Members-only update',
      visibility: 'tier_or_above',
      target_tier_rank: 2,
    });
    expect(onPosted).toHaveBeenCalledTimes(1);
  });

  test('Reach counts render based on getMembershipStats response', async () => {
    renderComposer();
    // Wait until the rendered option labels reflect the resolved stats.
    await waitFor(() => {
      const select = screen.getByTestId('audience-composer-visibility') as HTMLSelectElement;
      const labels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent || '');
      expect(labels[1]).toContain('1,200 reach');
    });
    const select = screen.getByTestId('audience-composer-visibility') as HTMLSelectElement;
    const labels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent || '');
    expect(labels[1]).toContain('1,200 reach');   // Followers
    expect(labels[2]).toContain('14 reach');      // Members
    expect(labels[3]).toContain('3 reach');       // Insiders
  });

  test('Optimistic media keeps media_thumbnails and media_live_urls, not just url + type', async () => {
    const onPosted = jest.fn();
    apiMock.upload.uploadPostMedia.mockResolvedValue({
      message: 'ok',
      media_urls: ['https://cdn.test/live-still.jpg', 'https://cdn.test/plain.jpg'],
      media_types: ['live_photo', 'image'],
      media_thumbnails: ['https://cdn.test/live-thumb.jpg', ''],
      media_live_urls: ['https://cdn.test/live-clip.mov', ''],
    });
    renderComposer({ onPosted });
    await waitFor(() => expect(apiMock.personas.getMembershipStats).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('audience-composer-body'), {
      target: { value: 'Update with a Live Photo' },
    });
    // jsdom's DataTransfer is a stub, so the file list is assigned directly.
    const file = new File(['still'], 'live-still.jpg', { type: 'image/jpeg' });
    const input = document
      .querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await act(async () => {
      fireEvent.click(screen.getByTestId('audience-composer-submit'));
    });

    expect(apiMock.upload.uploadPostMedia).toHaveBeenCalled();
    const posted = onPosted.mock.calls[0][0];
    // Slot 0 is a Live Photo: still + poster + companion clip all survive,
    // in the {url, type, thumbnailUrl, liveVideoUrl} shape the read path
    // normalizes (src/components/audience/broadcastMedia.tsx).
    expect(posted.media[0]).toEqual({
      url: 'https://cdn.test/live-still.jpg',
      type: 'live_photo',
      thumbnailUrl: 'https://cdn.test/live-thumb.jpg',
      liveVideoUrl: 'https://cdn.test/live-clip.mov',
    });
    // Slot 1 is a plain image: the blank padding is dropped rather than
    // stored as "" — matching mediaFromPost on the server.
    expect(posted.media[1]).toEqual({
      url: 'https://cdn.test/plain.jpg',
      type: 'image',
    });
  });

  test('Component never renders a home/business/place selector or persona-picker affordance', () => {
    renderComposer();
    const composer = screen.getByTestId('audience-composer');
    // No Personal-zone identity test ids — those are emitted by
    // PostComposer's picker chips, not this component.
    expect(composer.querySelector('[data-testid="posting-identity-personal"]')).toBeNull();
    expect(composer.querySelector('[data-testid="posting-identity-home"]')).toBeNull();
    expect(composer.querySelector('[data-testid="posting-identity-business"]')).toBeNull();
    expect(composer.querySelector('[data-testid="posting-identity-persona"]')).toBeNull();
    // No visible "Place" / "Home" / "Business" controls.
    expect(composer.textContent || '').not.toMatch(/Place|Household|Business|Nearby|Target Area/);
  });
});
