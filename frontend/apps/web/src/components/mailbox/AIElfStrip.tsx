'use client';

import type { MailItemV2, KeyFactEntry } from '@/types/mailbox';

type AIElfStripProps = {
  item?: MailItemV2;
  keyFacts?: KeyFactEntry[];
  summary?: string;
  onAddAsset?: () => void;
  onViewMapPin?: () => void;
};

/** Extract key facts from item — handles both array and string forms */
function extractItemFacts(item: MailItemV2): KeyFactEntry[] {
  const raw = item.key_facts;
  if (Array.isArray(raw)) return raw as KeyFactEntry[];
  return [];
}

/** Duck-type check for asset detection suggestion */
function hasAssetSuggestion(item: MailItemV2): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(item as any).asset_detection;
}

/** Duck-type check for map pin presence */
function hasMapPin(item: MailItemV2): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(item as any).map_pin_id;
}

export default function AIElfStrip({ item, keyFacts, summary: summaryProp, onAddAsset, onViewMapPin }: AIElfStripProps) {
  const facts = item ? extractItemFacts(item) : (keyFacts ?? []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary = summaryProp ?? (item ? (item as any).ai_elf_summary as string | undefined : undefined);
  const showAsset = item ? hasAssetSuggestion(item) : false;
  const showMapPin = item ? hasMapPin(item) : false;

  if (facts.length === 0 && !summary && !showAsset && !showMapPin) return null;

  return (
    <div className="px-3 py-2.5 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-lg">
      {/* Elf branding */}
      <p className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 mb-1.5 flex items-center gap-1">
        <span className="text-violet-500">&#10022;</span>
        Mailbox Elf
      </p>

      {/* Summary */}
      {summary && (
        <p className="text-sm text-app-text-strong mb-2">{summary}</p>
      )}

      {/* Key facts — horizontal pill format */}
      {facts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {facts.map((fact, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-app-surface border border-violet-200 dark:border-violet-700 rounded-full text-xs"
            >
              <span className="text-app-text-secondary dark:text-app-text-muted">{fact.field}:</span>
              <span className="font-medium text-app-text">{fact.value}</span>
              {fact.confidence < 0.8 && (
                <span className="text-[10px] text-app-text-muted" title={`${Math.round(fact.confidence * 100)}% confidence`}>~</span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Asset suggestion indicator */}
      {showAsset && (
        <button
          type="button"
          onClick={onAddAsset}
          className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 hover:underline mb-1"
        >
          <span aria-hidden="true">&#127968;</span>
          New asset detected — add to Records?
        </button>
      )}

      {/* Map pin indicator */}
      {showMapPin && (
        <button
          type="button"
          onClick={onViewMapPin}
          className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-400 hover:underline"
        >
          <span aria-hidden="true">&#128205;</span>
          Pin added to your home map
        </button>
      )}
    </div>
  );
}
