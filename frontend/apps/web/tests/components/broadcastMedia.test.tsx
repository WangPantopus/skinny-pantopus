/**
 * Broadcast ("Updates") media rendering.
 *
 * BroadcastMessageContent and BroadcastTimeline used to hold two private,
 * byte-identical copies of this grid, so a Live Photo fix had to land twice
 * and never did. Both now import src/components/audience/broadcastMedia.tsx,
 * and both are exercised here so the copies cannot quietly come back.
 *
 * The rule under test is the same one the post grid enforces
 * (resolvePostMediaSlots, components/feed/PostMediaGrid.tsx): a slot is a
 * Live Photo only when its type is `live_photo` AND its companion clip is
 * non-blank. Anything else is a still.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BroadcastMessageContent from '@/components/audience/BroadcastMessageContent';
import { normalizeBroadcastMedia, isLiveBroadcastMedia } from '@/components/audience/broadcastMedia';
import type { BroadcastMessage } from '@pantopus/types';

const apiMock = require('@pantopus/api');

const LIVE_ITEM = {
  url: 'https://cdn.test/still.jpg',
  type: 'live_photo',
  thumbnailUrl: 'https://cdn.test/thumb.jpg',
  liveVideoUrl: 'https://cdn.test/clip.mov',
};

function messageWith(media: BroadcastMessage['media']): BroadcastMessage {
  return {
    id: 'msg-1',
    channel_id: 'channel-1',
    persona_id: 'persona-1',
    body: 'Shop update',
    visibility: 'public',
    media,
    created_at: '2026-05-08T10:00:00Z',
  };
}

afterEach(() => cleanup());

describe('normalizeBroadcastMedia', () => {
  it('reads the companion clip under every alias the server has emitted', () => {
    const items = normalizeBroadcastMedia([
      { url: 'a.jpg', type: 'live_photo', liveVideoUrl: 'a.mov' },
      { url: 'b.jpg', type: 'live_photo', live_video_url: 'b.mov' },
      { url: 'c.jpg', type: 'live_photo', media_live_url: 'c.mov' },
    ]);
    expect(items.map((item) => item.liveVideoUrl)).toEqual(['a.mov', 'b.mov', 'c.mov']);
    expect(items.every(isLiveBroadcastMedia)).toBe(true);
  });

  it('does not treat a live_photo with no clip as live', () => {
    const [item] = normalizeBroadcastMedia([{ url: 'a.jpg', type: 'live_photo', liveVideoUrl: '   ' }]);
    expect(item.type).toBe('live_photo');
    expect(isLiveBroadcastMedia(item)).toBe(false);
  });
});

describe('BroadcastMediaGrid via BroadcastMessageContent', () => {
  it('renders a Live Photo tile and never links out to the raw clip', () => {
    const { container } = render(<BroadcastMessageContent message={messageWith([LIVE_ITEM])} />);
    expect(screen.getByTestId('livePhotoTile')).toBeInTheDocument();
    // The old grid wrapped the cell in <a href={liveVideoUrl}> — tapping a
    // Live Photo dumped the viewer onto a bare .mov in a new tab.
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).not.toContain('https://cdn.test/clip.mov');
    expect(screen.queryByText('Play')).toBeNull();
  });

  it('downgrades a clipless live_photo to a plain still with no Play affordance', () => {
    const { container } = render(
      <BroadcastMessageContent message={messageWith([{ ...LIVE_ITEM, liveVideoUrl: '' }])} />,
    );
    expect(screen.queryByTestId('livePhotoTile')).toBeNull();
    expect(screen.queryByText('Play')).toBeNull();
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('leaves plain videos on their existing anchor + Play pill', () => {
    const { container } = render(
      <BroadcastMessageContent message={messageWith([{ url: 'https://cdn.test/reel.mp4', type: 'video' }])} />,
    );
    expect(screen.queryByTestId('livePhotoTile')).toBeNull();
    expect(screen.getByText('Play')).toBeInTheDocument();
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://cdn.test/reel.mp4');
  });
});

describe('BroadcastTimeline shares the same grid', () => {
  it('renders the Live Photo tile on the owner-side timeline too', async () => {
    apiMock.broadcast.getBroadcastMessages.mockResolvedValue({
      messages: [messageWith([LIVE_ITEM])],
      analytics: { deliveredCount: 3, readCount: 1 },
    });
    const { BroadcastTimeline } = require('@/components/audience/BroadcastTimeline');
    render(<BroadcastTimeline channelId="channel-1" />);
    await waitFor(() => expect(screen.getByTestId('livePhotoTile')).toBeInTheDocument());
  });
});
