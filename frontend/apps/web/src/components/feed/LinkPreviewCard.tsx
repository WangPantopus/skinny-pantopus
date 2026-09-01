'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import * as api from '@pantopus/api';
import type { LinkPreviewData } from '@pantopus/api';
import FeedMediaImage from './FeedMediaImage';

const URL_REGEX = /(https?:\/\/[^\s]+)/gi;
const INTERNAL_HOSTS = new Set(['pantopus.com', 'www.pantopus.com', 'localhost', '127.0.0.1']);

// In-memory cache to avoid refetching on re-renders
const previewCache = new Map<string, LinkPreviewData | null>();

function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function findFirstExternalUrl(content: string): string | null {
  for (const match of content.matchAll(URL_REGEX)) {
    const url = match[0];
    try {
      const parsed = new URL(url);
      if (!INTERNAL_HOSTS.has(parsed.hostname)) return url;
    } catch {
      continue;
    }
  }
  return null;
}

interface LinkPreviewCardProps {
  content: string;
}

export default function LinkPreviewCard({ content }: LinkPreviewCardProps) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const externalUrl = findFirstExternalUrl(content);
    if (!externalUrl) {
      setUrl(null);
      setPreview(null);
      return;
    }
    setUrl(externalUrl);

    // Check cache
    if (previewCache.has(externalUrl)) {
      setPreview(previewCache.get(externalUrl) ?? null);
      return;
    }

    let cancelled = false;
    api.linkPreview.getLinkPreview(externalUrl).then((data) => {
      if (!cancelled) {
        previewCache.set(externalUrl, data);
        setPreview(data);
      }
    }).catch(() => {
      if (!cancelled) {
        previewCache.set(externalUrl, null);
      }
    });

    return () => { cancelled = true; };
  }, [content]);

  if (!url || !preview || (!preview.title && !preview.description)) return null;

  const hostname = preview.siteName || getHostname(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mx-4 mb-3 block overflow-hidden rounded-2xl border border-app bg-app-surface-hover transition hover:shadow-md"
    >
      {preview.image && (
        <div className="relative aspect-[2/1] w-full overflow-hidden bg-app-surface-sunken">
          <FeedMediaImage
            src={preview.image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      <div className="space-y-1 px-4 py-3">
        {hostname && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-500">
            {hostname}
          </p>
        )}
        {preview.title && (
          <p className="text-sm font-bold leading-snug text-app line-clamp-2">
            {preview.title}
          </p>
        )}
        {preview.description && (
          <p className="text-xs leading-relaxed text-app-muted line-clamp-2">
            {preview.description}
          </p>
        )}
        <div className="flex items-center gap-1 pt-1 text-xs font-semibold text-primary-500">
          <span>Read article</span>
          <ExternalLink className="h-3 w-3" />
        </div>
      </div>
    </a>
  );
}
