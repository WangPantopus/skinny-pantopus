'use client';

import FeedMediaImage from './FeedMediaImage';

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

export default function PostMediaGrid({ urls, thumbnailUrls, mediaTypes, onPress, compact = false }: PostMediaGridProps) {
  if (!urls || urls.length === 0) return null;

  const displayUrls = urls.map((url, i) => thumbnailUrls?.[i] || url);

  // Single image — aspect-video
  if (urls.length === 1) {
    return (
      <div className={compact ? 'mt-2' : 'mb-3'}>
        <button type="button" onClick={() => onPress?.(0)} className="w-full block">
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-app-surface-sunken">
            <FeedMediaImage src={displayUrls[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
            {mediaTypes?.[0] === 'video' && <VideoPlayOverlay />}
          </div>
        </button>
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
            {rowIndices.map((i) => (
              <button key={i} type="button" onClick={() => onPress?.(i)}
                className="flex-1 relative aspect-square rounded-lg overflow-hidden bg-app-surface-sunken">
                <FeedMediaImage src={displayUrls[i]} alt="" className="w-full h-full object-cover" loading="lazy" />
                {mediaTypes?.[i] === 'video' && <VideoPlayOverlay />}
                {/* Overflow indicator on last visible item */}
                {i === Math.min(urls.length, 9) - 1 && urls.length > 9 && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">+{urls.length - 9}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
