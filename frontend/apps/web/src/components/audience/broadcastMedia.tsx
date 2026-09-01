'use client';

/**
 * Shared rendering helpers for broadcast (Beacon "Updates") message bodies.
 *
 * BroadcastMessageContent and BroadcastTimeline each carried a private,
 * byte-for-byte copy of everything below. Nothing had drifted apart from
 * line wrapping and one `export` keyword, but the duplication meant every
 * media fix had to land twice — which is how the Live Photo affordance
 * stayed missing on both. One module, two importers.
 *
 * A broadcast's `media` is NOT the post-style parallel arrays; it is a list
 * of `{ url, type, thumbnailUrl?, liveVideoUrl? }` objects, assembled
 * server-side by `mediaFromPost` (backend/routes/broadcastChannels.js:200-215)
 * from exactly those parallel arrays. The Live Photo rule survives the
 * transposition unchanged: a slot is live only when its type is
 * `live_photo` AND its companion clip is non-blank.
 */

import type React from 'react';
import type { BroadcastMessage } from '@pantopus/types';
import LivePhotoTile from '@/components/feed/LivePhotoTile';

const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

export type BroadcastMediaItem = {
  url: string;
  type: string;
  thumbnailUrl?: string | null;
  liveVideoUrl?: string | null;
};

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function normalizeMediaType(type: unknown, url: string): string {
  const value = String(type || '').toLowerCase();
  if (value === 'live_photo' || value === 'image' || value === 'video') return value;
  if (value.startsWith('image/')) return 'image';
  if (value.startsWith('video/')) return 'video';
  if (/\.(mp4|mov|m4v|webm)(?:\?|$)/i.test(url)) return 'video';
  return 'image';
}

export function normalizeBroadcastMedia(media: BroadcastMessage['media']): BroadcastMediaItem[] {
  const items = Array.isArray(media) ? (media as unknown[]) : [];
  return items
    .map((item): BroadcastMediaItem | null => {
      if (typeof item === 'string') {
        const url = item.trim();
        return url ? { url, type: normalizeMediaType(null, url) } : null;
      }
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const url = firstString(record.url, record.uri, record.src, record.path);
      if (!url) return null;
      return {
        url,
        type: normalizeMediaType(record.type || record.media_type || record.mimeType || record.mime_type, url),
        thumbnailUrl: firstString(record.thumbnailUrl, record.thumbnail_url, record.thumb, record.thumbnail),
        liveVideoUrl: firstString(record.liveVideoUrl, record.live_video_url, record.media_live_url, record.liveUrl),
      };
    })
    .filter(Boolean) as BroadcastMediaItem[];
}

/**
 * The Live Photo gate, in the broadcast media shape. Mirrors
 * `resolvePostMediaSlots` (components/feed/PostMediaGrid.tsx:29-45) and the
 * native `PostMediaItem.items(...)`: a `live_photo` whose companion clip is
 * blank downgrades to a plain still rather than offering a dead affordance.
 * The write side rejects that combination outright now
 * (backend/routes/broadcastChannels.js:50-55), but rows published before it
 * did are still in the table.
 */
export function isLiveBroadcastMedia(item: BroadcastMediaItem): boolean {
  return item.type === 'live_photo' && Boolean(item.liveVideoUrl?.trim());
}

export function renderBodyWithLinks(body: string) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(URL_REGEX)) {
    const index = match.index ?? -1;
    const url = match[0];
    if (index < 0) continue;
    if (index > lastIndex) parts.push(body.slice(lastIndex, index));
    parts.push(
      <a
        key={`${url}-${index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary-600 underline"
      >
        {url}
      </a>,
    );
    lastIndex = index + url.length;
  }
  if (lastIndex < body.length) parts.push(body.slice(lastIndex));
  return parts.length > 0 ? parts : body;
}

export function BroadcastMediaGrid({ media }: { media: BroadcastMessage['media'] }) {
  const items = normalizeBroadcastMedia(media);
  if (items.length === 0) return null;
  const aspect = items.length === 1 ? 'aspect-video' : 'aspect-square';
  return (
    <div
      data-testid="broadcast-media-grid"
      className={`mt-3 grid gap-2 ${items.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'}`}
    >
      {items.map((item, index) => {
        // Live Photos get the same tile the Pulse feed and the Beacon post
        // column use: yellow dot, hold to crossfade into the clip. Before
        // this they rendered a generic "Play" pill whose href was the raw
        // .mov — a tap left the app for a bare QuickTime file, and the
        // still was never animated. The tile is the interactive element,
        // so it is NOT wrapped in the sibling anchor (interactive content
        // inside <a> is invalid); the tap opens the still instead, which is
        // what every other cell in this grid does.
        if (isLiveBroadcastMedia(item)) {
          return (
            <div
              key={`${item.url}-${index}`}
              className={`relative ${aspect} overflow-hidden rounded-lg border border-app bg-surface-muted`}
            >
              <LivePhotoTile
                stillUrl={item.url}
                thumbnailUrl={item.thumbnailUrl}
                videoUrl={item.liveVideoUrl as string}
                onPress={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                className="absolute inset-0 h-full w-full"
              />
            </div>
          );
        }
        const previewUrl = item.thumbnailUrl || (item.type === 'video' ? null : item.url);
        return (
          <a
            key={`${item.url}-${index}`}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative overflow-hidden rounded-lg border border-app bg-surface-muted"
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className={`${aspect} w-full object-cover`} />
            ) : (
              <div className={`${aspect} flex w-full items-center justify-center text-xs font-semibold text-app-secondary`}>
                Video
              </div>
            )}
            {/*
              Videos only. A `live_photo` that reaches this branch has no
              companion clip, so it has downgraded to a plain still — the
              old code still painted "Play" over it, an affordance with
              nothing behind it.
            */}
            {item.type === 'video' ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                <span className="rounded-full bg-black/55 px-2 py-1 text-xs font-semibold text-white">Play</span>
              </span>
            ) : null}
          </a>
        );
      })}
    </div>
  );
}

export default BroadcastMediaGrid;
