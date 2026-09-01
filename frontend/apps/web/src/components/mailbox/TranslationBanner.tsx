'use client';

import type { MailItemV2 } from '@/types/mailbox';

type TranslationBannerProps = {
  item: MailItemV2;
  detectedLanguage?: string;
  confidence?: number;
  translatedContent?: string;
  onTranslate?: () => void;
  onShowOriginal?: () => void;
  loading?: boolean;
  showingTranslation?: boolean;
};

export default function TranslationBanner({
  detectedLanguage,
  confidence,
  translatedContent,
  onTranslate,
  onShowOriginal,
  loading = false,
  showingTranslation = false,
}: TranslationBannerProps) {
  // Use item subject as context hint when no detected language
  if (!detectedLanguage) return null;

  return (
    <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30">
        <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-indigo-700 dark:text-indigo-300">
            Detected: <strong>{detectedLanguage}</strong>
            {confidence !== undefined && confidence < 0.9 && (
              <span className="text-indigo-400 ml-1">({Math.round(confidence * 100)}%)</span>
            )}
          </p>
        </div>

        {showingTranslation ? (
          <button
            type="button"
            onClick={onShowOriginal}
            className="flex-shrink-0 px-3 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 dark:border-indigo-700 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
          >
            Show original {detectedLanguage}
          </button>
        ) : (
          <button
            type="button"
            onClick={onTranslate}
            disabled={loading}
            className={`flex-shrink-0 px-3 py-1 text-xs font-semibold rounded transition-colors ${
              loading
                ? 'bg-app-surface-sunken text-app-text-secondary cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {loading ? 'Translating...' : 'Translate'}
          </button>
        )}
      </div>

      {/* Translated text display area */}
      {showingTranslation && translatedContent && (
        <div className="px-4 py-3 bg-app-surface border-t border-indigo-100 dark:border-indigo-900">
          <p className="text-sm text-app-text-strong whitespace-pre-wrap">
            {translatedContent}
          </p>
        </div>
      )}
    </div>
  );
}
