'use client';

import { useEffect } from 'react';
import Image from 'next/image';

// ─── Types ───

export interface LightboxImage {
  url: string;
  name: string;
}

interface MediaLightboxProps {
  images: LightboxImage[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

// ─── Component ───

export default function MediaLightbox({
  images,
  currentIndex,
  onClose,
  onNavigate,
}: MediaLightboxProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        onNavigate(currentIndex > 0 ? currentIndex - 1 : images.length - 1);
      } else if (e.key === 'ArrowRight') {
        onNavigate(currentIndex < images.length - 1 ? currentIndex + 1 : 0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, images.length, onClose, onNavigate]);

  const current = images[currentIndex];
  if (!current) return null;

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl font-bold z-10 w-10 h-10 flex items-center justify-center rounded-full hover:bg-glass/10 transition"
        title="Close (Esc)"
      >
        ✕
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-4 text-white/70 text-sm font-medium">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Previous */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex > 0 ? currentIndex - 1 : images.length - 1);
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-4xl font-bold w-12 h-12 flex items-center justify-center rounded-full hover:bg-glass/10 transition"
          title="Previous (←)"
        >
          ‹
        </button>
      )}

      {/* Image */}
      <Image
        src={current.url}
        alt={current.name}
        width={1200}
        height={800}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        unoptimized
      />

      {/* Next */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex < images.length - 1 ? currentIndex + 1 : 0);
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-4xl font-bold w-12 h-12 flex items-center justify-center rounded-full hover:bg-glass/10 transition"
          title="Next (→)"
        >
          ›
        </button>
      )}
    </div>
  );
}
