'use client';

/* eslint-disable @next/next/no-img-element */

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@pantopus/utils';
import type { ImgHTMLAttributes } from 'react';

interface FeedMediaImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  /** Layout hint for Next/Image (defaults 800×600). Use larger values for lightbox. */
  width?: number;
  height?: number;
  priority?: boolean;
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
    const { protocol, hostname } = new URL(src);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    return (
      hostname === 'localhost' ||
      hostname === 'pantopus.com' ||
      hostname === 'www.pantopus.com' ||
      hostname.endsWith('.amazonaws.com') ||
      hostname.endsWith('.cloudfront.net')
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
  ...props
}: FeedMediaImageProps) {
  const candidates = useMemo(() => buildFeedMediaCandidates(src), [src]);
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const currentSrc = candidates[candidateIdx];

  useEffect(() => {
    setCandidateIdx(0);
    setExhausted(false);
  }, [src]);

  if (candidates.length === 0 || exhausted) {
    return <div className={className} aria-hidden="true" />;
  }

  const handleError = () => {
    if (candidateIdx < candidates.length - 1) {
      setCandidateIdx((idx) => idx + 1);
    } else {
      setExhausted(true);
    }
  };

  if (!canUseNextImage(currentSrc)) {
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
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      quality={80}
      priority={priority}
      onError={handleError}
    />
  );
}
