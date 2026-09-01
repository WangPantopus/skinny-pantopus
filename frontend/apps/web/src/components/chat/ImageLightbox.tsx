'use client';

import { useEffect } from 'react';

interface ImageLightboxProps {
  imageUrl: string | null;
  title?: string;
  onClose: () => void;
}

export default function ImageLightbox({ imageUrl, title, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!imageUrl) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Title */}
      {title && (
        <div className="absolute top-4 left-4 text-white text-sm bg-black/50 px-3 py-1.5 rounded-lg z-10">
          {title}
        </div>
      )}

      {/* Native img: arbitrary chat URLs; avoids next/image dev sizing warnings in lightbox. */}
      <img
        src={imageUrl}
        alt={title || 'Image preview'}
        className="rounded-lg shadow-2xl"
        style={{
          width: 'auto',
          height: 'auto',
          maxWidth: '90vw',
          maxHeight: '90vh',
          objectFit: 'contain',
        }}
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}
