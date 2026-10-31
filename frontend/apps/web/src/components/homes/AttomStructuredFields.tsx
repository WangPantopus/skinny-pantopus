'use client';

import { useMemo, useState } from 'react';
import type { AttomPropertyDetailPayload } from '@pantopus/api';
import { buildAttomDisplaySections, type AttomDisplaySection } from '@pantopus/utils';

type Section = AttomDisplaySection & { note?: string | null };

type Props = {
  attomPropertyDetail?: AttomPropertyDetailPayload | null;
  /** Sections the server already labeled (a verified owner's county record); shown instead of the raw record. */
  sections?: Section[];
};

function SectionBlock({
  section,
  expanded,
  onToggle,
}: {
  section: Section;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (section.rows.length === 0) return null;

  return (
    <div className="border border-app-border rounded-lg overflow-hidden mb-3">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-app-surface-sunken/60 hover:bg-app-surface-sunken text-left"
      >
        <span className="text-sm font-semibold text-app-text-strong">{section.title}</span>
        <span className="text-xs text-app-text-muted shrink-0">{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded ? (
        <div className="divide-y divide-app-border">
          {section.rows.map((row, i) => (
            <div key={`${section.id}-${i}`} className="grid grid-cols-1 sm:grid-cols-2 gap-1 px-3 py-2 text-xs">
              <div className="text-app-text-secondary leading-snug">{row.label}</div>
              <div className="text-app-text-strong font-medium leading-snug break-words">{row.value}</div>
            </div>
          ))}
          {section.note ? (
            <p className="px-3 py-2 text-xs leading-snug text-app-text-secondary">{section.note}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function AttomStructuredFields({ attomPropertyDetail, sections: labeled }: Props) {
  const sections = useMemo(
    () => labeled ?? buildAttomDisplaySections(attomPropertyDetail ?? undefined),
    [labeled, attomPropertyDetail],
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (sections.length === 0) return null;

  return (
    <div className="space-y-0 mt-3">
      {sections.map((sec) => (
        <SectionBlock
          key={sec.id}
          section={sec}
          expanded={expanded[sec.id] ?? true}
          onToggle={() =>
            setExpanded((prev) => ({
              ...prev,
              [sec.id]: !(prev[sec.id] ?? true),
            }))
          }
        />
      ))}
    </div>
  );
}
