'use client';

/**
 * Full-screen media viewer for a post's parallel media arrays.
 *
 * Lifted from the lightbox PostDetailPanel renders inline
 * (components/feed/PostDetailPanel.tsx:550-628) — same overlay, same close
 * / prev / next controls, same `<video controls autoPlay>` branch — with
 * one branch added: a Live Photo slot renders `LivePhotoTile` in its
 * replay-pill variant, which is the web analogue of the "LIVE" pill iOS
 * shows in `PostMediaViewer`
 * (Features/Shared/Media/PostMediaComponents.swift) and Android in
 * `PostMediaViewer` (ui/screens/shared/media/PostMediaComponents.kt).
 *
 * It exists as its own component because AudienceProfileClient — the public
 * Beacon page — has no PostDetailPanel to open: its posts come from
 * GET /api/personas/:handle/posts and are read-only, so there is nothing to
 * comment on or like. Rather than invent a third lightbox, both surfaces
 * should converge here; PostDetailPanel's copy is left alone for now
 * because rewiring its local `lightboxIndex` state is out of scope.
 */

import { useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import FeedMediaImage from './FeedMediaImage';
import LivePhotoTile from './LivePhotoTile';
import { resolvePostMediaSlots } from './PostMediaGrid';

interface PostMediaLightboxProps {
  urls: string[];
  /** Parallel array of media types ('image' | 'video' | 'live_photo'). */
  mediaTypes?: string[];
  /** Parallel array of Live Photo companion clips (`media_live_urls`). */
  liveUrls?: string[];
  /** Slot to show; `null` keeps the viewer closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export default function PostMediaLightbox({
  urls,
  mediaTypes,
  liveUrls,
  index,
  onIndexChange,
  onClose,
}: PostMediaLightboxProps) {
  const count = urls.length;
  const isOpen = index !== null && count > 0 && index < count;

  const step = useCallback(
    (delta: number) => {
      if (index === null || count === 0) return;
      onIndexChange((index + delta + count) % count);
    },
    [count, index, onIndexChange],
  );

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (count < 2) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, count, onClose, step]);

  // Same body-scroll lock PostDetailPanel takes while its lightbox is up.
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (!isOpen || index === null) return null;

  const slot = resolvePostMediaSlots(urls, mediaTypes, liveUrls)[index];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Full size media"
      data-testid="post-media-lightbox"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-[102] rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); step(-1); }}
            className="absolute left-2 top-1/2 z-[102] -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 md:left-4"
            aria-label="Previous media"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); step(1); }}
            className="absolute right-2 top-1/2 z-[102] -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 md:right-4"
            aria-label="Next media"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        </>
      )}

      <div
        className="relative max-h-[min(92vh,1080px)] max-w-[min(96vw,1920px)]"
        onClick={(e) => e.stopPropagation()}
      >
        {slot.kind === 'live' ? (
          // `key` forces a fresh tile per slot so a clip that was mid-play
          // does not survive a prev/next step. The tile needs a sized box:
          // its layers are `absolute inset-0`, and `object-contain`
          // letterboxes the still inside it.
          <LivePhotoTile
            key={index}
            stillUrl={urls[index]}
            videoUrl={slot.liveUrl}
            fit="contain"
            showsDot={false}
            showsReplayPill
            className="h-[min(92vh,1080px)] w-[min(96vw,1920px)]"
          />
        ) : slot.kind === 'video' ? (
          <video
            key={index}
            src={urls[index]}
            controls
            autoPlay
            className="max-h-[min(92vh,1080px)] w-auto max-w-full rounded-lg"
          />
        ) : (
          <FeedMediaImage
            src={urls[index]}
            alt=""
            width={1920}
            height={1080}
            className="max-h-[min(92vh,1080px)] w-auto max-w-full object-contain"
            priority
          />
        )}
      </div>

      {count > 1 && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-[102] -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
          {index + 1} / {count}
        </div>
      )}
    </div>
  );
}
