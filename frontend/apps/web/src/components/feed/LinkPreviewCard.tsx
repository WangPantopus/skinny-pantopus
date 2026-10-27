'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import * as api from '@pantopus/api';
import type { LinkPreviewData } from '@pantopus/api';

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const INTERNAL_HOSTS = new Set(['pantopus.com', 'www.pantopus.com', 'localhost', '127.0.0.1']);

// One request per link for the page's life, shared by every card that shows it.
const previewRequests = new Map<string, Promise<LinkPreviewData | null>>();

function loadPreview(url: string): Promise<LinkPreviewData | null> {
  let request = previewRequests.get(url);
  if (!request) {
    request = api.linkPreview.getLinkPreview(url).catch((error) => {
      // A busy, slow or offline moment passes, so a later card may ask again.
      const status = (error as { statusCode?: number } | undefined)?.statusCode;
      if (!status || status === 429 || status >= 500) previewRequests.delete(url);
      return null;
    });
    previewRequests.set(url, request);
  }
  return request;
}

function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function postLinks(content: string) {
  return Array.from(content.matchAll(URL_REGEX)).flatMap(match => {
    let text = match[0].replace(/[.,!?;:]+$/, '');
    for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
      while (text.endsWith(close) && text.split(close).length > text.split(open).length) text = text.slice(0, -1);
    }
    try {
      const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
      return ['http:', 'https:'].includes(url.protocol) ? [{ text, url: url.href, index: match.index! }] : [];
    } catch { return []; }
  });
}

function findFirstExternalUrl(content: string): string | null {
  return postLinks(content).find(link => !INTERNAL_HOSTS.has(new URL(link.url).hostname))?.url ?? null;
}

/** All links stay usable even when a site doesn't provide preview metadata. */
export function PostLinkContent({ content }: { content: string }) {
  let cursor = 0;
  const parts = postLinks(content).flatMap(link => {
    const before = content.slice(cursor, link.index);
    cursor = link.index + link.text.length;
    return [before, <a key={link.index} href={link.url} target="_blank" rel="noopener noreferrer"
      className="text-app-link underline" onClick={event => event.stopPropagation()}>{link.text}</a>];
  });
  return <>{parts}{content.slice(cursor)}</>;
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
    setPreview(null);

    let cancelled = false;
    loadPreview(externalUrl).then((data) => {
      if (!cancelled) setPreview(data);
    });

    return () => { cancelled = true; };
  }, [content]);

  if (!url || !preview || (!preview.title && !preview.description)) return null;

  const hostname = preview.siteName || getHostname(url);

  // Text only: the page's own image would load from a host the poster picked,
  // showing it every viewer's IP address.
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mx-4 mb-3 block overflow-hidden rounded-2xl border border-app bg-app-surface-hover transition hover:shadow-md"
    >
      <div className="space-y-1 px-4 py-3">
        {hostname && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-app-link">
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
        <div className="flex items-center gap-1 pt-1 text-xs font-semibold text-app-link">
          <span>Read article</span>
          <ExternalLink className="h-3 w-3" />
        </div>
      </div>
    </a>
  );
}
