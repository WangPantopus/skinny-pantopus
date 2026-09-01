'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Camera } from 'lucide-react';

interface ListingGalleryProps {
  images: string[];
  title: string;
}

export default function ListingGallery({ images, title }: ListingGalleryProps) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden mb-6">
        {images.length > 0 ? (
          <div className="relative">
            <div className="aspect-[16/9] bg-app-surface-sunken cursor-pointer relative" onClick={() => setLightboxOpen(true)}>
              <Image src={images[activeImageIdx]} alt={title} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" quality={80} className="object-contain" />
            </div>
            {/* Dot indicators */}
            {images.length > 1 && (
              <div className="flex justify-center gap-1.5 py-3">
                {images.map((_: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIdx(idx)}
                    className={`w-2.5 h-2.5 rounded-full transition ${idx === activeImageIdx ? 'bg-primary-600' : 'bg-gray-300'}`}
                  />
                ))}
              </div>
            )}
            {/* Nav arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setActiveImageIdx(i => (i - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button
                  onClick={() => setActiveImageIdx(i => (i + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="aspect-[16/9] bg-app-surface-raised flex items-center justify-center text-gray-300">
            <div className="text-center">
              <Camera className="w-12 h-12 text-gray-300" />
              <p className="text-sm text-app-text-muted mt-2">No photos</p>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && images.length > 0 && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center" onClick={() => setLightboxOpen(false)}>
          <button onClick={() => setLightboxOpen(false)} className="absolute top-4 right-4 text-white/80 hover:text-white z-10">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <Image
            src={images[activeImageIdx]}
            alt=""
            width={1200}
            height={800}
            className="max-w-full max-h-full object-contain"
            onClick={e => e.stopPropagation()}
            unoptimized
          />
          {images.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); setActiveImageIdx(i => (i - 1 + images.length) % images.length); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-glass/20 text-white flex items-center justify-center hover:bg-glass/30"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                onClick={e => { e.stopPropagation(); setActiveImageIdx(i => (i + 1) % images.length); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-glass/20 text-white flex items-center justify-center hover:bg-glass/30"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </>
          )}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            {activeImageIdx + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}
