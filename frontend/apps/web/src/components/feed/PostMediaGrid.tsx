'use client';

import FeedMediaImage from './FeedMediaImage';
import LivePhotoTile from './LivePhotoTile';

/** What the tile at a given slot renders as. */
export interface PostMediaSlot {
  kind: 'image' | 'video' | 'live';
  /** Companion clip — non-empty only when `kind === 'live'`. */
  liveUrl: string;
}

/**
 * Resolves the backend's parallel media arrays (`media_urls` /
 * `media_types` / `media_live_urls`) into per-slot render kinds. Ported
 * from iOS `PostMediaItem.items(urls:types:thumbnails:liveURLs:)`
 * (Features/Shared/Media/PostMediaItem.swift:57-95) — deliberately NOT
 * the RN behaviour, which collapses `live_photo` into a generic video
 * affordance.
 *
 * Rules, in native order:
 * - `media_types[i]` decides the kind; missing / unknown → image.
 * - `live_photo` downgrades to a plain image when the companion clip URL
 *   is blank (the arrays pad with "" to keep indices aligned).
 * - When `liveUrls` arrives shorter than `urls` — older serializers
 *   filtered the "" padding out — the k-th `live_photo` slot consumes
 *   the k-th surviving clip URL via a cursor instead of an index lookup.
 */
export function resolvePostMediaSlots(
  urls: string[],
  mediaTypes?: string[],
  liveUrls?: string[],
): PostMediaSlot[] {
  const live = liveUrls ?? [];
  const liveIsAligned = live.length === urls.length;
  let liveCursor = 0;
  return urls.map((_, i): PostMediaSlot => {
    const type = (mediaTypes?.[i] ?? '').trim().toLowerCase();
    if (type === 'video') return { kind: 'video', liveUrl: '' };
    if (type !== 'live_photo') return { kind: 'image', liveUrl: '' };
    const clip = (liveIsAligned ? live[i] : live[liveCursor++]) ?? '';
    const trimmed = clip.trim();
    return trimmed ? { kind: 'live', liveUrl: trimmed } : { kind: 'image', liveUrl: '' };
  });
}

/**
 * Row layout for media grid (up to 3 cols per row).
 * 1→[1], 2→[2], 3→[3], 4→[2,2], 5→[3,2], 6→[3,3], 7+→[3,3,...]
 */
function getMediaGridRows(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [1];
  if (n === 2) return [2];
  if (n === 3) return [3];
  if (n === 4) return [2, 2];
  if (n === 5) return [3, 2];
  if (n === 6) return [3, 3];
  if (n === 7) return [3, 3, 1];
  if (n === 8) return [3, 3, 2];
  return [3, 3, 3];
}

interface PostMediaGridProps {
  urls: string[];
  thumbnailUrls?: string[];
  /** Parallel array of media types ('image' | 'video' | 'live_photo'). */
  mediaTypes?: string[];
  /** Parallel array of Live Photo companion clips (`media_live_urls`). */
  liveUrls?: string[];
  onPress?: (index: number) => void;
  /** Compact mode for feed cards (smaller gap, no outer padding) */
  compact?: boolean;
}

function VideoPlayOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50">
        <svg viewBox="0 0 24 24" fill="white" className="ml-0.5 h-5 w-5">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </div>
  );
}

export default function PostMediaGrid({ urls, thumbnailUrls, mediaTypes, liveUrls, onPress, compact = false }: PostMediaGridProps) {
  if (!urls || urls.length === 0) return null;

  const displayUrls = urls.map((url, i) => thumbnailUrls?.[i] || url);
  const slots = resolvePostMediaSlots(urls, mediaTypes, liveUrls);

  // Single image — aspect-video
  if (urls.length === 1) {
    return (
      <div className={compact ? 'mt-2' : 'mb-3'}>
        {slots[0].kind === 'live' ? (
          // LivePhotoTile is itself the button — no outer wrapper, so the
          // press-and-hold gesture is not nested inside another control.
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-app-surface-sunken">
            <LivePhotoTile
              stillUrl={urls[0]}
              thumbnailUrl={thumbnailUrls?.[0]}
              videoUrl={slots[0].liveUrl}
              onPress={() => onPress?.(0)}
              className="absolute inset-0 h-full w-full"
            />
          </div>
        ) : (
          <button type="button" onClick={() => onPress?.(0)} className="w-full block">
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-app-surface-sunken">
              <FeedMediaImage src={displayUrls[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
              {slots[0].kind === 'video' && <VideoPlayOverlay />}
            </div>
          </button>
        )}
      </div>
    );
  }

  // Multi-image grid
  const rows = getMediaGridRows(urls.length);
  let index = 0;

  return (
    <div className={`space-y-1 ${compact ? 'mt-2' : 'mb-3'}`}>
      {rows.map((colCount, rowIdx) => {
        const rowIndices: number[] = [];
        for (let c = 0; c < colCount && index < urls.length; c++) rowIndices.push(index++);
        return (
          <div key={rowIdx} className="flex gap-1">
            {rowIndices.map((i) => {
              const cellClass = 'flex-1 relative aspect-square rounded-lg overflow-hidden bg-app-surface-sunken';
              // Overflow indicator on last visible item. `pointer-events-none`
              // so it never swallows the tap on the live variant, whose cell
              // is a plain div rather than the button below.
              const overflowIndicator = i === Math.min(urls.length, 9) - 1 && urls.length > 9 && (
                <div className="pointer-events-none absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">+{urls.length - 9}</span>
                </div>
              );
              if (slots[i].kind === 'live') {
                return (
                  <div key={i} className={cellClass}>
                    <LivePhotoTile
                      stillUrl={urls[i]}
                      thumbnailUrl={thumbnailUrls?.[i]}
                      videoUrl={slots[i].liveUrl}
                      onPress={() => onPress?.(i)}
                      className="absolute inset-0 h-full w-full"
                    />
                    {overflowIndicator}
                  </div>
                );
              }
              return (
                <button key={i} type="button" onClick={() => onPress?.(i)} className={cellClass}>
                  <FeedMediaImage src={displayUrls[i]} alt="" className="w-full h-full object-cover" loading="lazy" />
                  {slots[i].kind === 'video' && <VideoPlayOverlay />}
                  {overflowIndicator}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
