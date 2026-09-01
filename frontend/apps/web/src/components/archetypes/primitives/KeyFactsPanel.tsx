// ============================================================
// KeyFactsPanel — sunken K/V list. Mono values + copy icon for IDs.
// ============================================================

'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export interface KeyFact {
  label: string;
  value: string;
  monospace?: boolean;
  copyable?: boolean;
}

export interface KeyFactsPanelProps {
  facts: KeyFact[];
  className?: string;
}

export default function KeyFactsPanel({ facts, className = '' }: KeyFactsPanelProps) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleCopy = async (fact: KeyFact, idx: number) => {
    try {
      await navigator.clipboard.writeText(fact.value);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <dl className={`bg-app-surface-sunken rounded-xl p-3 divide-y divide-app-border ${className}`}>
      {facts.map((fact, idx) => (
        <div
          key={`${fact.label}-${idx}`}
          className="py-2 flex items-baseline gap-4 first:pt-0 last:pb-0"
        >
          <dt className="w-36 shrink-0 text-[11px] font-semibold uppercase tracking-[0.04em] text-app-text-secondary">
            {fact.label}
          </dt>
          <dd className="flex-1 min-w-0 flex items-center gap-2">
            <span
              className={`flex-1 min-w-0 truncate text-sm text-app-text font-medium ${fact.monospace ? 'font-mono text-[13px]' : ''}`}
            >
              {fact.value}
            </span>
            {fact.copyable ? (
              <button
                type="button"
                onClick={() => handleCopy(fact, idx)}
                className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-app-text-muted hover:text-app-text hover:bg-app-hover transition"
                aria-label={`Copy ${fact.label}`}
              >
                {copiedIdx === idx ? <Check size={14} /> : <Copy size={14} />}
              </button>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
