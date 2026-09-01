'use client';

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect } from 'react';
import type { BookletItem, BookletPageEntry, MailAction } from '@/types/mailbox';

type ReadingMode = 'flip' | 'scroll' | 'stream';

type BookletViewerProps = {
  booklet: BookletItem;
  title: string;
  sender: string;
  onSaveToVault?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onAction?: (action: MailAction) => void;
};

const STORAGE_KEY = 'pantopus-booklet-reading-mode';

function getStoredMode(): ReadingMode {
  if (typeof window === 'undefined') return 'flip';
  return (localStorage.getItem(STORAGE_KEY) as ReadingMode) || 'flip';
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BookletViewer({
  booklet,
  title,
  sender,
  onSaveToVault,
  onDownload,
  onShare,
}: BookletViewerProps) {
  const isLarge = (booklet.download_size_bytes ?? 0) > 10 * 1024 * 1024;
  const defaultMode = isLarge ? 'stream' : getStoredMode();
  const [mode, setMode] = useState<ReadingMode>(defaultMode);
  const [currentPage, setCurrentPage] = useState(1);
  const pages = booklet.pages;
  const totalPages = booklet.page_count || pages.length;

  // Persist reading mode preference
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  // ── Keyboard navigation for flip mode ─────────────────────
  useEffect(() => {
    if (mode !== 'flip') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentPage(p => Math.max(1, p - 1));
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setCurrentPage(p => Math.min(totalPages, p + 1));
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mode, totalPages]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Cover / header ────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-app-border-subtle flex-shrink-0">
        {booklet.cover_image_url && (
          <div className="mb-3 rounded-lg overflow-hidden bg-app-surface-sunken" style={{ maxHeight: 300 }}>
            <img
              src={booklet.cover_image_url}
              alt={`${title} cover`}
              className="w-full h-full object-contain"
              style={{ maxHeight: 300 }}
            />
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-app-text truncate">{title}</h2>
            <p className="text-xs text-app-text-secondary mt-0.5">{sender}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="px-2 py-0.5 text-[10px] font-medium bg-app-surface-sunken text-app-text-secondary dark:text-app-text-muted rounded-full">
              {totalPages} pages
            </span>
            {isLarge && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full">
                Streaming available
              </span>
            )}
            {booklet.download_size_bytes && (
              <span className="text-[10px] text-app-text-muted">
                {formatSize(booklet.download_size_bytes)}
              </span>
            )}
          </div>
        </div>

        {/* Reading mode toggle */}
        <div className="flex items-center gap-1 mt-3">
          <span className="text-[10px] text-app-text-muted mr-2">Reading mode:</span>
          {(['flip', 'scroll', 'stream'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                mode === m
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-app-text-secondary hover:bg-app-hover dark:hover:bg-gray-800'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content area ──────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === 'flip' && (
          <FlipMode
            pages={pages}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}

        {mode === 'scroll' && (
          <ScrollMode pages={pages} />
        )}

        {mode === 'stream' && (
          <StreamMode downloadUrl={booklet.download_url} title={title} />
        )}
      </div>

      {/* ── Footer actions ────────────────────────────────── */}
      <div className="flex items-center gap-2 px-6 py-3 border-t border-app-border-subtle flex-shrink-0">
        {onSaveToVault && (
          <button
            type="button"
            onClick={onSaveToVault}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-app-border rounded-md text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
            </svg>
            Save to Vault
          </button>
        )}
        {onDownload && booklet.download_url && (
          <a
            href={booklet.download_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-app-border rounded-md text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </a>
        )}
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-app-border rounded-md text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
        )}
      </div>
    </div>
  );
}

// ── Flip mode ───────────────────────────────────────────────

function FlipMode({
  pages,
  currentPage,
  totalPages,
  onPageChange,
}: {
  pages: BookletPageEntry[];
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const pageData = pages[currentPage - 1];

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 py-4">
      {/* Page content */}
      <div className="flex-1 min-h-0 w-full max-w-2xl flex items-center justify-center">
        {pageData?.image_url ? (
          <img
            src={pageData.image_url}
            alt={`Page ${currentPage}`}
            className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
          />
        ) : pageData?.text_content ? (
          <div className="w-full bg-app-surface border border-app-border rounded-lg p-6 overflow-y-auto max-h-full shadow-sm">
            <p className="text-sm text-app-text-strong whitespace-pre-wrap">{pageData.text_content}</p>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full h-48 bg-app-surface-raised rounded-lg">
            <p className="text-xs text-app-text-muted">Page {currentPage} — no preview</p>
          </div>
        )}
      </div>

      {/* Navigation controls */}
      <div className="flex items-center gap-4 mt-4 flex-shrink-0">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className={`p-2 rounded-md transition-colors ${
            currentPage <= 1
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-app-text-secondary hover:bg-app-hover dark:hover:bg-gray-800'
          }`}
          aria-label="Previous page"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="text-xs text-app-text-secondary">
          Page {currentPage} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className={`p-2 rounded-md transition-colors ${
            currentPage >= totalPages
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-app-text-secondary hover:bg-app-hover dark:hover:bg-gray-800'
          }`}
          aria-label="Next page"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Scroll mode ─────────────────────────────────────────────

function ScrollMode({ pages }: { pages: BookletPageEntry[] }) {
  return (
    <div className="h-full overflow-y-auto px-6 py-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {pages.map((page, i) => (
          <div key={i} className="relative">
            <span className="absolute -left-4 top-0 text-[10px] text-app-text-muted">{i + 1}</span>
            {page.image_url ? (
              <img
                src={page.image_url}
                alt={`Page ${i + 1}`}
                className="w-full rounded-lg shadow-sm"
                loading="lazy"
              />
            ) : page.text_content ? (
              <div className="bg-app-surface border border-app-border rounded-lg p-6 shadow-sm">
                <p className="text-sm text-app-text-strong whitespace-pre-wrap">{page.text_content}</p>
              </div>
            ) : (
              <div className="h-32 bg-app-surface-raised rounded-lg flex items-center justify-center">
                <p className="text-xs text-app-text-muted">Page {i + 1}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stream mode (PDF viewer) ────────────────────────────────

function StreamMode({ downloadUrl, title }: { downloadUrl?: string; title: string }) {
  if (!downloadUrl) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-app-text-secondary">No streaming URL available</p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      src={downloadUrl}
      title={title}
      className="w-full h-full border-0"
      sandbox="allow-same-origin allow-scripts"
    />
  );
}
