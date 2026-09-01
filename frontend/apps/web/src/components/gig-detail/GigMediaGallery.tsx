'use client';

import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import Image from 'next/image';
import MediaLightbox, { type LightboxImage } from './MediaLightbox';

// ── Helpers ──

const isImageUrl = (value: string) =>
  /\.(png|jpg|jpeg|gif|webp|heic|heif)$/i.test(value.split('?')[0] || '');

const isImageMime = (mime: string) => /^image\//i.test(mime || '');

const isLikelyDocumentUrl = (value: string) =>
  /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar)$/i.test(value.split('?')[0] || '');

const normalizeRemoteUrl = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) return raw;
  try {
    const u = new URL(raw);
    const encodedPath = u.pathname
      .split('/')
      .map((seg) => {
        if (!seg) return seg;
        try {
          return encodeURIComponent(decodeURIComponent(seg));
        } catch {
          return encodeURIComponent(seg);
        }
      })
      .join('/');
    u.pathname = encodedPath;
    return u.toString();
  } catch {
    return encodeURI(raw);
  }
};

// ── computeImageUrls (exported for parent components) ──

export function computeImageUrls(gig: any, gigMedia: any[]): string[] {
  const attachmentCandidates = [
    gig?.attachments,
    gig?.media_urls,
    gig?.photos,
    gig?.image_urls,
  ];

  const attachmentUrls: string[] = Array.from(
    new Set(
      attachmentCandidates
        .flatMap((list) => (Array.isArray(list) ? list : []))
        .map((entry: any) => {
          if (typeof entry === 'string') return entry.trim();
          if (entry && typeof entry === 'object')
            return (entry.url || entry.file_url || entry.src || '').trim();
          return '';
        })
        .filter((u: string) => u.length > 0),
    ),
  );

  const allMedia = [
    ...gigMedia.map((m: any, idx: number) => ({
      id: m.id || `gig-media-${idx}`,
      url: normalizeRemoteUrl(m.file_url),
      previewUrl: normalizeRemoteUrl(m.thumbnail_url || m.file_url),
      name: m.file_name || 'Media',
      isImage:
        isImageMime(m.mime_type || '') ||
        String(m.file_type || '').toLowerCase() === 'image',
    })),
    ...attachmentUrls.map((url, idx) => ({
      id: `attachment-${idx}`,
      url: normalizeRemoteUrl(url),
      previewUrl: normalizeRemoteUrl(url),
      name: `Attachment ${idx + 1}`,
      isImage: isImageUrl(url) || !isLikelyDocumentUrl(url),
    })),
  ].filter((item) => !!item.url);

  return Array.from(
    new Map(allMedia.map((item) => [item.url, item])).values(),
  )
    .filter((m) => m.isImage)
    .map((m) => m.url);
}

// ── Types ──

interface MediaItem {
  id: string;
  url: string;
  previewUrl: string;
  name: string;
  isImage: boolean;
}

interface GigMediaGalleryProps {
  gig: any;
  gigMedia: any[];
  mediaLoading?: boolean;
}

// ── Component ──

export default function GigMediaGallery({
  gig,
  gigMedia,
  mediaLoading = false,
}: GigMediaGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Build deduplicated media list
  const { dedupedMedia, imageMedia } = useMemo(() => {
    const attachmentCandidates = [
      gig?.attachments,
      gig?.media_urls,
      gig?.photos,
      gig?.image_urls,
    ];

    const attachmentUrls: string[] = Array.from(
      new Set(
        attachmentCandidates
          .flatMap((list) => (Array.isArray(list) ? list : []))
          .map((entry: any) => {
            if (typeof entry === 'string') return entry.trim();
            if (entry && typeof entry === 'object')
              return (entry.url || entry.file_url || entry.src || '').trim();
            return '';
          })
          .filter((u: string) => u.length > 0),
      ),
    );

    const allMedia: MediaItem[] = [
      ...gigMedia.map((m: any, idx: number) => ({
        id: m.id || `gig-media-${idx}`,
        url: normalizeRemoteUrl(m.file_url),
        previewUrl: normalizeRemoteUrl(m.thumbnail_url || m.file_url),
        name: m.file_name || 'Media',
        isImage:
          isImageMime(m.mime_type || '') ||
          String(m.file_type || '').toLowerCase() === 'image',
      })),
      ...attachmentUrls.map((url, idx) => ({
        id: `attachment-${idx}`,
        url: normalizeRemoteUrl(url),
        previewUrl: normalizeRemoteUrl(url),
        name: `Attachment ${idx + 1}`,
        isImage: isImageUrl(url) || !isLikelyDocumentUrl(url),
      })),
    ].filter((item) => !!item.url);

    const deduped = Array.from(
      new Map(allMedia.map((item) => [item.url, item])).values(),
    );

    return {
      dedupedMedia: deduped,
      imageMedia: deduped.filter((m) => m.isImage),
    };
  }, [gig, gigMedia]);

  // Lightbox images
  const lightboxImages: LightboxImage[] = useMemo(
    () => imageMedia.map((m) => ({ url: m.url, name: m.name })),
    [imageMedia],
  );

  if (!mediaLoading && dedupedMedia.length === 0) return null;

  return (
    <div>
      <h3 className="text-base font-semibold text-app-text mb-3">
        Media & Attachments ({dedupedMedia.length})
      </h3>

      {mediaLoading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-app-border border-t-emerald-600" />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {dedupedMedia.map((item) => {
            if (item.isImage) {
              const imageIdx = imageMedia.findIndex((img) => img.url === item.url);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLightboxIndex(imageIdx >= 0 ? imageIdx : 0)}
                  className="flex-shrink-0 w-[130px]"
                >
                  <Image
                    src={item.previewUrl}
                    alt={item.name}
                    width={130}
                    height={96}
                    className="w-[130px] h-24 rounded-lg object-cover bg-app-surface-sunken hover:opacity-90 transition"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    quality={80}
                  />
                  <p className="text-xs text-app-text-secondary mt-1.5 truncate">{item.name}</p>
                </button>
              );
            }

            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 w-[130px]"
              >
                <div className="w-[130px] h-24 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center hover:bg-sky-100 transition">
                  <FileText className="w-7 h-7 text-sky-600" />
                </div>
                <p className="text-xs text-app-text-secondary mt-1.5 truncate">{item.name}</p>
              </a>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <MediaLightbox
          images={lightboxImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
