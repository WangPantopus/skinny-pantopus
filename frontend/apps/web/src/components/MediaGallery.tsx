'use client';

import Image from 'next/image';
import { useState } from 'react';
import { FileText } from 'lucide-react';

interface MediaItem {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;  // 'image', 'video', 'document'
  mime_type: string;
  thumbnail_url?: string | null;
}

interface MediaGalleryProps {
  media: MediaItem[];
  /** Allow deletion? */
  editable?: boolean;
  /** Called when delete is clicked */
  onDelete?: (id: string) => void;
  /** Compact grid for smaller containers */
  compact?: boolean;
}

export default function MediaGallery({
  media,
  editable = false,
  onDelete,
  compact = false,
}: MediaGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!media || media.length === 0) return null;

  const images = media.filter((m) => m.file_type === 'image' || m.mime_type?.startsWith('image/'));
  const videos = media.filter((m) => m.file_type === 'video' || m.mime_type?.startsWith('video/'));
  const docs = media.filter((m) => m.file_type === 'document' || (!m.mime_type?.startsWith('image/') && !m.mime_type?.startsWith('video/')));

  const gridCols = compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';

  return (
    <div className="space-y-4">
      {/* Images */}
      {images.length > 0 && (
        <div className={`grid ${gridCols} gap-2`}>
          {images.map((item, idx) => (
            <div key={item.id} className="relative group">
              <Image
                src={item.thumbnail_url || item.file_url}
                alt={item.file_name}
                className={`w-full ${compact ? 'h-24' : 'h-32 sm:h-40'} object-cover rounded-lg cursor-pointer hover:opacity-90 transition`}
                onClick={() => setLightboxIndex(idx)}
                width={160}
                height={compact ? 96 : 160}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                quality={80}
              />
              {editable && onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <div className="space-y-2">
          {videos.map((item) => (
            <div key={item.id} className="relative group">
              <video
                src={item.file_url}
                controls
                preload="metadata"
                className={`w-full ${compact ? 'max-h-40' : 'max-h-64'} rounded-lg bg-black`}
              />
              {editable && onDelete && (
                <button
                  onClick={() => onDelete(item.id)}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Documents */}
      {docs.length > 0 && (
        <div className="space-y-1.5">
          {docs.map((item) => (
            <div key={item.id} className="flex items-center gap-3 bg-app-surface-raised border border-app-border rounded-lg px-3 py-2">
              <FileText className="w-5 h-5 text-app-text-secondary" />
              <a
                href={item.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-sm text-blue-600 hover:underline truncate"
              >
                {item.file_name}
              </a>
              {editable && onDelete && (
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-app-text-muted hover:text-red-500 transition text-sm"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox for images */}
      {lightboxIndex !== null && images[lightboxIndex] && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={images[lightboxIndex].file_url}
              alt={images[lightboxIndex].file_name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              width={800}
              height={600}
              unoptimized
            />
            <button
              onClick={() => setLightboxIndex(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-app-surface text-app-text rounded-full flex items-center justify-center shadow-lg text-lg font-bold hover:bg-app-hover"
            >
              ✕
            </button>

            {/* Nav arrows */}
            {images.length > 1 && (
              <>
                {lightboxIndex > 0 && (
                  <button
                    onClick={() => setLightboxIndex(lightboxIndex - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-glass/80 text-app-text rounded-full flex items-center justify-center text-xl hover:bg-app-surface"
                  >
                    ‹
                  </button>
                )}
                {lightboxIndex < images.length - 1 && (
                  <button
                    onClick={() => setLightboxIndex(lightboxIndex + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-glass/80 text-app-text rounded-full flex items-center justify-center text-xl hover:bg-app-surface"
                  >
                    ›
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
