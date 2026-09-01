'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface DetailsAccordionProps {
  children: ReactNode;
  label?: string;
}

export default function DetailsAccordion({
  children,
  label = 'Add details (optional)',
}: DetailsAccordionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-app-border rounded-xl bg-app-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-app-hover transition"
      >
        <span className="text-sm font-medium text-app-text-secondary">{label}</span>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-app-text-secondary" />
        ) : (
          <ChevronDown className="w-5 h-5 text-app-text-secondary" />
        )}
      </button>
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
