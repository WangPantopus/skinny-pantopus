/**
 * Web Live Photo playback — the read side of the parallel-array contract
 * (`media_urls[i]` / `media_types[i]` / `media_thumbnails[i]` /
 * `media_live_urls[i]` all describe slot i).
 *
 * The resolver cases mirror the native unit tests for
 * `PostMediaItem.items(urls:types:thumbnails:liveURLs:)`
 * (iOS Features/Shared/Media/PostMediaItem.swift:57-95) so a slot that
 * downgrades to a still on iOS/Android downgrades here too.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import PostMediaGrid, { resolvePostMediaSlots } from '@/components/feed/PostMediaGrid';
import LivePhotoTile from '@/components/feed/LivePhotoTile';

/** The <path> inside VideoPlayOverlay's triangle — the grid's video affordance. */
const PLAY_TRIANGLE = 'path[d="M8 5v14l11-7z"]';

describe('resolvePostMediaSlots', () => {
  it('aligned arrays: live only when type + non-blank clip', () => {
    expect(
      resolvePostMediaSlots(
        ['a.jpg', 'b.jpg', 'c.mp4', 'd.jpg'],
        ['live_photo', 'live_photo', 'video', 'image'],
        ['a.mov', '  ', '', ''],
      ),
    ).toEqual([
      { kind: 'live', liveUrl: 'a.mov' },
      { kind: 'image', liveUrl: '' },
      { kind: 'video', liveUrl: '' },
      { kind: 'image', liveUrl: '' },
    ]);
  });

  it('ragged arrays: k-th live_photo consumes k-th surviving clip', () => {
    expect(
      resolvePostMediaSlots(
        ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'],
        ['image', 'live_photo', 'image', 'live_photo'],
        ['first.mov', 'second.mov'],
      ),
    ).toEqual([
      { kind: 'image', liveUrl: '' },
      { kind: 'live', liveUrl: 'first.mov' },
      { kind: 'image', liveUrl: '' },
      { kind: 'live', liveUrl: 'second.mov' },
    ]);
  });

  it('missing liveUrls downgrades every live_photo to image', () => {
    expect(resolvePostMediaSlots(['a.jpg'], ['live_photo'])).toEqual([
      { kind: 'image', liveUrl: '' },
    ]);
  });
});

describe('PostMediaGrid live branch', () => {
  it('renders a LivePhotoTile for a live slot and a plain still otherwise', () => {
    render(
      <PostMediaGrid
        urls={['a.jpg', 'b.jpg']}
        mediaTypes={['live_photo', 'image']}
        liveUrls={['a.mov', '']}
      />,
    );
    expect(screen.getAllByTestId('livePhotoTile')).toHaveLength(1);
  });

  it('a live_photo with a blank clip renders a plain still, not a tile', () => {
    // The backend pads the parallel arrays with "" (backend/routes/
    // personas.js normalizeAlignedMediaUrls), so a live_photo whose
    // companion upload failed arrives as type `live_photo` + empty clip.
    const { container } = render(
      <PostMediaGrid urls={['a.jpg', 'b.jpg']} mediaTypes={['live_photo', 'image']} liveUrls={['   ', '']} />,
    );
    expect(screen.queryByTestId('livePhotoTile')).toBeNull();
    expect(container.querySelectorAll('img')).toHaveLength(2);
    expect(container.querySelector(PLAY_TRIANGLE)).toBeNull();
  });

  it('a video slot still gets the play overlay and no live affordance', () => {
    const { container } = render(
      <PostMediaGrid urls={['a.jpg', 'clip.mp4']} mediaTypes={['live_photo', 'video']} liveUrls={['a.mov', '']} />,
    );
    expect(screen.getAllByTestId('livePhotoTile')).toHaveLength(1);
    expect(container.querySelectorAll(PLAY_TRIANGLE)).toHaveLength(1);
  });

  it('tap on a live tile still reaches onPress', () => {
    const onPress = jest.fn();
    render(<PostMediaGrid urls={['a.jpg']} mediaTypes={['live_photo']} liveUrls={['a.mov']} onPress={onPress} />);
    fireEvent.click(screen.getByTestId('livePhotoTile'));
    expect(onPress).toHaveBeenCalledWith(0);
  });

  it('tap on a live tile in a multi-slot grid reports its own index', () => {
    const onPress = jest.fn();
    render(
      <PostMediaGrid
        urls={['a.jpg', 'b.jpg', 'c.jpg']}
        mediaTypes={['image', 'live_photo', 'image']}
        liveUrls={['', 'b.mov', '']}
        onPress={onPress}
      />,
    );
    fireEvent.click(screen.getByTestId('livePhotoTile'));
    expect(onPress).toHaveBeenCalledWith(1);
  });
});

describe('LivePhotoTile gestures', () => {
  beforeAll(() => {
    // jsdom has no media pipeline.
    window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = jest.fn();
  });

  it('mounts no <video> until a hold starts playback', () => {
    const { container } = render(<LivePhotoTile stillUrl="a.jpg" videoUrl="a.mov" />);
    expect(container.querySelector('video')).toBeNull();
  });

  it('hold plays, release stops, and the trailing click is not a tap', () => {
    jest.useFakeTimers();
    const onPress = jest.fn();
    const { container } = render(<LivePhotoTile stillUrl="a.jpg" videoUrl="a.mov" onPress={onPress} />);
    const tile = screen.getByTestId('livePhotoTile');

    fireEvent.pointerDown(tile);
    act(() => { jest.advanceTimersByTime(400); });
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.className).toContain('opacity-100');
    expect(video?.muted).toBe(true);

    fireEvent.pointerUp(tile);
    fireEvent.click(tile);
    expect(container.querySelector('video')?.className).toContain('opacity-0');
    expect(onPress).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('a short tap never starts playback and does reach onPress', () => {
    jest.useFakeTimers();
    const onPress = jest.fn();
    const { container } = render(<LivePhotoTile stillUrl="a.jpg" videoUrl="a.mov" onPress={onPress} />);
    const tile = screen.getByTestId('livePhotoTile');
    fireEvent.pointerDown(tile);
    act(() => { jest.advanceTimersByTime(100); });
    fireEvent.pointerUp(tile);
    fireEvent.click(tile);
    expect(container.querySelector('video')).toBeNull();
    expect(onPress).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('backgrounding the tab stops a running clip', () => {
    jest.useFakeTimers();
    const { container } = render(<LivePhotoTile stillUrl="a.jpg" videoUrl="a.mov" />);
    fireEvent.pointerDown(screen.getByTestId('livePhotoTile'));
    act(() => { jest.advanceTimersByTime(400); });
    expect(container.querySelector('video')?.className).toContain('opacity-100');

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(container.querySelector('video')?.className).toContain('opacity-0');
    jest.useRealTimers();
  });

  it('replay pill variant exposes a clickable LIVE control', () => {
    const { container } = render(
      <LivePhotoTile stillUrl="a.jpg" videoUrl="a.mov" showsReplayPill showsDot={false} fit="contain" />,
    );
    const pill = screen.getByTestId('livePhotoReplay');
    expect(pill.getAttribute('aria-label')).toBe('Play Live Photo');
    fireEvent.click(pill);
    expect(container.querySelector('video')?.className).toContain('opacity-100');
    // Play-once ends on the clip's own 'ended' event.
    act(() => { fireEvent.ended(container.querySelector('video')!); });
    expect(container.querySelector('video')?.className).toContain('opacity-0');
  });

  it('keyboard Enter plays once without opening the lightbox', () => {
    const onPress = jest.fn();
    const { container } = render(<LivePhotoTile stillUrl="a.jpg" videoUrl="a.mov" onPress={onPress} />);
    fireEvent.keyDown(screen.getByTestId('livePhotoTile'), { key: 'Enter' });
    expect(container.querySelector('video')?.className).toContain('opacity-100');
    expect(onPress).not.toHaveBeenCalled();
  });
});
