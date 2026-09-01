'use client';

import type React from 'react';
import type { BroadcastMessage } from '@pantopus/types';

const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

type BroadcastMediaItem = {
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

function renderBodyWithLinks(body: string) {
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

function BroadcastMediaGrid({ media }: { media: BroadcastMessage['media'] }) {
  const items = normalizeBroadcastMedia(media);
  if (items.length === 0) return null;
  return (
    <div className={`mt-3 grid gap-2 ${items.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'}`}>
      {items.map((item, index) => {
        const previewUrl = item.thumbnailUrl || (item.type === 'video' ? null : item.url);
        return (
          <a
            key={`${item.url}-${index}`}
            href={item.liveVideoUrl || item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative overflow-hidden rounded-lg border border-app bg-surface-muted"
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt=""
                className={`${items.length === 1 ? 'aspect-video' : 'aspect-square'} w-full object-cover`}
              />
            ) : (
              <div className={`${items.length === 1 ? 'aspect-video' : 'aspect-square'} flex w-full items-center justify-center text-xs font-semibold text-app-secondary`}>
                Video
              </div>
            )}
            {(item.type === 'video' || item.type === 'live_photo') ? (
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

export default function BroadcastMessageContent({
  message,
  bodyClassName = 'whitespace-pre-wrap text-sm leading-6 text-app',
}: {
  message: BroadcastMessage;
  bodyClassName?: string;
}) {
  const body = message.body || message.teaser || '';
  return (
    <>
      {body ? <p className={bodyClassName}>{renderBodyWithLinks(body)}</p> : null}
      <BroadcastMediaGrid media={message.media} />
    </>
  );
}
