'use client';

/* eslint-disable @next/next/no-img-element */
import type { BookletItem } from '@/types/mailbox';

type BookletCardProps = {
  booklet: BookletItem;
  onClick?: () => void;
};

export default function BookletCard({ booklet, onClick }: BookletCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full text-left"
    >
      {/* Fan-stack visual: offset cards behind */}
      <div className="relative">
        <div className="absolute -bottom-1 left-2 right-2 h-24 bg-app-surface-sunken rounded-lg" />
        <div className="absolute -bottom-0.5 left-1 right-1 h-24 bg-app-surface-sunken rounded-lg" />

        {/* Cover */}
        <div className="relative rounded-lg overflow-hidden border border-app-border bg-app-surface shadow-sm group-hover:shadow-md transition-shadow">
          {booklet.cover_image_url ? (
            <img
              src={booklet.cover_image_url}
              alt="Booklet cover"
              className="w-full h-40 object-cover"
            />
          ) : (
            <div className="w-full h-40 bg-app-surface-sunken flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-300 dark:text-app-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          )}

          {/* Info overlay */}
          <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/60 to-transparent">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white font-medium">
                {booklet.page_count} page{booklet.page_count !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-1.5">
                {booklet.streaming_available && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-500/80 text-white text-[10px] font-semibold rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-app-surface animate-pulse" />
                    STREAM
                  </span>
                )}
                {booklet.download_url && (
                  <span className="text-[10px] text-white/80">
                    {booklet.download_size_bytes
                      ? `${(booklet.download_size_bytes / (1024 * 1024)).toFixed(1)} MB`
                      : 'Download'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
