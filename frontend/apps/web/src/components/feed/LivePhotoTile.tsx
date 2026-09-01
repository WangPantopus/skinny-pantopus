'use client';

/**
 * Web Live Photo tile — still image that crossfades into its companion
 * clip while pressed. The web analogue of iOS `LivePhotoTileView`
 * (apps/ios/Pantopus/Features/Shared/Media/PostMediaComponents.swift:90-235)
 * and Android `LivePhotoTile`
 * (ui/screens/shared/media/PostMediaComponents.kt:392-533).
 *
 * Parity notes with the native tiles:
 * - 300 ms hold threshold before playback starts, so a plain tap stays a
 *   tap and still reaches `onPress` (the lightbox). A hold that actually
 *   played swallows the trailing click, mirroring SwiftUI's tap gesture
 *   never firing after a long press and Compose's `detectTapGestures`
 *   routing a hold to `onPress` instead of `onTap`.
 * - 150 ms opacity crossfade + 1.05x scale on the media layer only; the
 *   dot and the LIVE pill stay put (same as iOS, where the pill is a
 *   sibling of the scaled `mediaLayers`).
 * - The <video> is mounted lazily on the first play and carries
 *   `preload="none"`, so scrolling a feed never pays clip setup cost —
 *   the native tiles build their AVPlayer / ExoPlayer on first press.
 *
 * Where web has to diverge: SwiftUI's `@GestureState` resets itself the
 * instant the finger lifts, and Compose's `tryAwaitRelease` unwinds on
 * cancellation. The browser gives us no such guarantee, so every way a
 * press can end — pointerup, pointercancel, the pointer leaving the
 * tile, touchend, touchcancel, focus loss, tab backgrounding — is wired
 * up explicitly below. Miss one and the clip keeps playing under a
 * finger that has already moved on.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import FeedMediaImage from './FeedMediaImage';

/** Hold before playback starts — iOS `LongPressGesture(minimumDuration: 0.3)`. */
const HOLD_DELAY_MS = 300;

interface LivePhotoTileProps {
  /** Full-size still frame (`media_urls[i]`). */
  stillUrl: string;
  /** Smaller preview for grid cells (`media_thumbnails[i]`), when present. */
  thumbnailUrl?: string | null;
  /** Companion clip (`media_live_urls[i]`) — callers resolve/validate it. */
  videoUrl: string;
  /** `cover` for grid cells, `contain` for lightbox slides. */
  fit?: 'cover' | 'contain';
  /** Yellow indicator dot. Grid tiles show it; the lightbox shows the pill. */
  showsDot?: boolean;
  /** Lightbox variant: a "LIVE" pill that replays the clip once per click. */
  showsReplayPill?: boolean;
  /** Tapping the tile — opens the full-screen viewer on the calling surface. */
  onPress?: () => void;
  className?: string;
}

export default function LivePhotoTile({
  stillUrl,
  thumbnailUrl,
  videoUrl,
  fit = 'cover',
  showsDot = true,
  showsReplayPill = false,
  onPress,
  className = '',
}: LivePhotoTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True once a hold has actually played, so the trailing click is not a tap. */
  const didHoldRef = useRef(false);
  /** True while a pill / keyboard triggered play-once run is in flight. */
  const playOnceRef = useRef(false);
  /** The clip element only exists after the first play. */
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);

  const startPlayback = useCallback((once: boolean) => {
    playOnceRef.current = once;
    setMounted(true);
    setPlaying(true);
  }, []);

  const stopPlayback = useCallback(() => {
    playOnceRef.current = false;
    setPlaying(false);
  }, []);

  const cancelHold = useCallback(() => {
    if (holdTimerRef.current === null) return;
    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  }, []);

  // `mounted` is a dependency because the first play flips it in the same
  // commit that sets `playing` — the element only exists on the re-render.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      // Reasserted imperatively: React does not reflect `muted` onto the
      // element as an attribute, and an unmuted clip would be blocked.
      video.muted = true;
      video.currentTime = 0;
      void video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  }, [playing, mounted]);

  // Presses that end outside the element's own event stream. Backgrounding
  // the tab and losing window focus both leave the clip running otherwise.
  useEffect(() => {
    const stop = () => {
      cancelHold();
      stopPlayback();
    };
    const stopWhenHidden = () => {
      if (document.visibilityState === 'hidden') stop();
    };
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => {
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', stopWhenHidden);
    };
  }, [cancelHold, stopPlayback]);

  useEffect(
    () => () => {
      if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current);
      videoRef.current?.pause();
    },
    [],
  );

  /** Idempotent: pointer and touch handlers both land here on touch devices. */
  const beginHold = useCallback(() => {
    if (holdTimerRef.current !== null || playing) return;
    didHoldRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      didHoldRef.current = true;
      startPlayback(false);
    }, HOLD_DELAY_MS);
  }, [playing, startPlayback]);

  const endHold = useCallback(() => {
    cancelHold();
    // A pill / keyboard replay runs to its own end — a stray pointerup
    // must not cut it short (iOS guards the same way with `isPlayingOnce`).
    if (!playOnceRef.current) stopPlayback();
  }, [cancelHold, stopPlayback]);

  const handleEnded = useCallback(() => {
    if (playOnceRef.current) stopPlayback();
  }, [stopPlayback]);

  const handleClick = useCallback(() => {
    if (didHoldRef.current) {
      didHoldRef.current = false;
      return;
    }
    onPress?.();
  }, [onPress]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      // Swallowed so the browser's synthetic click does not also fire.
      event.preventDefault();
      startPlayback(true);
    },
    [startPlayback],
  );

  /** Every way a press can end, plus the long-press callout that would steal it. */
  const pressHandlers = {
    onPointerDown: beginHold,
    onPointerUp: endHold,
    onPointerCancel: endHold,
    onPointerLeave: endHold,
    onTouchStart: beginHold,
    onTouchEnd: endHold,
    onTouchCancel: endHold,
    onBlur: endHold,
    onContextMenu: (event: React.SyntheticEvent) => event.preventDefault(),
    onDragStart: (event: React.SyntheticEvent) => event.preventDefault(),
  };

  const objectFit = fit === 'cover' ? 'object-cover' : 'object-contain';
  // iOS renders the thumbnail in fill mode and the full still in fit mode.
  const stillSrc = fit === 'cover' ? thumbnailUrl || stillUrl : stillUrl;

  const mediaLayers = (
    <>
      <div
        className={`absolute inset-0 transition-transform duration-150 ease-out ${
          playing ? 'scale-105' : 'scale-100'
        }`}
      >
        <FeedMediaImage src={stillSrc} alt="" className={`h-full w-full ${objectFit}`} loading="lazy" />
        {mounted && (
          <video
            ref={videoRef}
            src={videoUrl}
            preload="none"
            playsInline
            muted
            // Divergence from iOS, which unmutes on press
            // (`player?.isMuted = false`, PostMediaComponents.swift:214):
            // browsers gate unmuted playback on a user-activation check
            // that varies by engine and by how the gesture was delivered,
            // so an unmuted clip would silently fail to start on some of
            // them. A muted clip always plays, and a page that stays
            // silent while a thumb rests on a photo is the safer default.
            aria-hidden="true"
            tabIndex={-1}
            onEnded={handleEnded}
            className={`absolute inset-0 h-full w-full ${objectFit} transition-opacity duration-150 ease-out ${
              playing ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
      </div>
      {showsDot && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-2 h-[7px] w-[7px] rounded-full bg-app-live-badge"
        />
      )}
    </>
  );

  // Viewer variant: the pill is the interactive control, so the frame is a
  // plain element — a button inside a button is invalid and unreachable
  // for assistive tech.
  if (showsReplayPill) {
    return (
      <div
        {...pressHandlers}
        className={`relative select-none overflow-hidden ${className}`}
        style={{ WebkitTouchCallout: 'none' }}
        data-testid="livePhotoTile"
      >
        {mediaLayers}
        <button
          type="button"
          onClick={() => startPlayback(true)}
          aria-label="Play Live Photo"
          className="absolute bottom-3 left-3 inline-flex h-[26px] items-center gap-1 rounded-pill bg-black/55 px-2.5 text-[11px] font-bold text-white"
          data-testid="livePhotoReplay"
        >
          <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-app-live-badge" />
          LIVE
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      {...pressHandlers}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label="Live Photo"
      title="Hold to play"
      className={`relative select-none overflow-hidden ${className}`}
      style={{ WebkitTouchCallout: 'none', touchAction: 'manipulation' }}
      data-testid="livePhotoTile"
    >
      {mediaLayers}
    </button>
  );
}
