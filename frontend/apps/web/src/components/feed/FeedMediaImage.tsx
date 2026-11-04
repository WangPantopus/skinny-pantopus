'use client';

/* eslint-disable @next/next/no-img-element */

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@pantopus/utils';
import type { ImgHTMLAttributes, ReactNode } from 'react';
import { isPantopusMediaUrl } from '@/lib/media-hosts';

interface FeedMediaImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  /** Layout hint for Next/Image (defaults 800×600). Use larger values for lightbox. */
  width?: number;
  height?: number;
  priority?: boolean;
  /** Optional recovery UI once every source has failed. */
  errorFallback?: ReactNode;
}

function normalizeBaseUrl(base: string): string {
  return (base || '').replace(/\/+$/, '');
}

function toApiUrl(pathLike: string): string {
  const base = normalizeBaseUrl(API_BASE_URL);
  if (!base) return pathLike;
  const path = pathLike.startsWith('/') ? pathLike : `/${pathLike}`;
  return `${base}${path}`;
}

function cloudfrontBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_CLOUDFRONT_URL ||
    process.env.NEXT_PUBLIC_AWS_CLOUDFRONT_URL ||
    '';
  if (!raw) return '';
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return normalizeBaseUrl(withProto);
}

function toCloudfrontUrl(pathLike: string): string {
  const base = cloudfrontBaseUrl();
  if (!base) return '';
  const path = pathLike.startsWith('/') ? pathLike : `/${pathLike}`;
  return `${base}${path}`;
}

function s3KeyFromUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (!u.hostname.includes('.s3.')) return '';
    return u.pathname.replace(/^\/+/, '');
  } catch {
    return '';
  }
}

/** Exported for lightbox / downloads — same resolution order as <FeedMediaImage />. */
export function buildFeedMediaCandidates(raw: string | null | undefined): string[] {
  const cleaned = (raw || '').trim().replace(/^['"]+|['"]+$/g, '');
  if (!cleaned) return [];
  if (/^(data:|blob:)/i.test(cleaned)) return [cleaned];
  if (/^https?:\/\//i.test(cleaned)) {
    const s3Key = s3KeyFromUrl(cleaned);
    const cloudfrontFromS3 = s3Key ? toCloudfrontUrl(s3Key) : '';
    return Array.from(new Set([cloudfrontFromS3, cleaned].filter(Boolean)));
  }
  if (/^\/\//.test(cleaned)) return [cleaned];

  const candidates = [
    toCloudfrontUrl(cleaned),
    cleaned,
    toApiUrl(cleaned),
  ];

  // Legacy local uploads often store bare "uploads/..." paths.
  if (!cleaned.startsWith('uploads/') && !cleaned.startsWith('/uploads/')) {
    candidates.push(toCloudfrontUrl(`uploads/${cleaned.replace(/^\/+/, '')}`));
    candidates.push(toApiUrl(`uploads/${cleaned.replace(/^\/+/, '')}`));
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

export function canUseNextImage(src: string): boolean {
  if (!src) return false;
  if (src.startsWith('/') && !src.startsWith('//')) return true;
  if (/^(data:|blob:)/i.test(src)) return false;

  try {
    const { protocol, hostname, pathname } = new URL(src);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    // Our own S3/CloudFront storage only (the optimizer refuses everyone else's,
    // such as a news site's CDN, so those load as a plain <img>). Only public
    // Supabase objects may enter the shared optimizer; signed/private media
    // must keep loading directly.
    return (
      (process.env.NODE_ENV === 'development' && ['localhost', '127.0.0.1'].includes(hostname)) ||
      hostname === 'pantopus.com' ||
      hostname === 'www.pantopus.com' ||
      (isPantopusMediaUrl(src) && (hostname.endsWith('.amazonaws.com') || hostname.endsWith('.cloudfront.net')
        || (hostname.endsWith('.supabase.co') && pathname.startsWith('/storage/v1/object/public/'))))
    );
  } catch {
    return false;
  }
}

export default function FeedMediaImage({
  src,
  className,
  width = 800,
  height = 600,
  priority,
  errorFallback,
  sizes = '(max-width: 768px) calc(100vw - 32px), 640px',
  ...props
}: FeedMediaImageProps) {
  const candidates = useMemo(() => buildFeedMediaCandidates(src), [src]);
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [bypassOptimizer, setBypassOptimizer] = useState(false);
  const currentSrc = candidates[candidateIdx];

  useEffect(() => {
    setCandidateIdx(0);
    setExhausted(false);
    setBypassOptimizer(false);
  }, [src]);

  if (candidates.length === 0 || exhausted) {
    return errorFallback ?? <div className={`${className ?? ''} flex items-center justify-center text-xs text-app-muted`} role="img" aria-label="Image unavailable">Image unavailable</div>;
  }

  const handleError = () => {
    // The source may still be healthy when an optimizer request fails. Try
    // it directly once before giving up or moving to a legacy URL.
    if (canUseNextImage(currentSrc) && !bypassOptimizer) {
      setBypassOptimizer(true);
      return;
    }
    if (candidateIdx < candidates.length - 1) {
      setBypassOptimizer(false);
      setCandidateIdx((idx) => idx + 1);
    } else {
      setExhausted(true);
    }
  };

  if (!canUseNextImage(currentSrc) || bypassOptimizer) {
    return (
      <img
        alt=""
        {...props}
        src={currentSrc}
        className={className}
        decoding="async"
        onError={handleError}
      />
    );
  }

  return (
    <Image
      alt=""
      {...(props as Record<string, any>)}
      src={currentSrc}
      className={className}
      width={width}
      height={height}
      sizes={sizes}
      quality={80}
      priority={priority}
      onError={handleError}
    />
  );
}
