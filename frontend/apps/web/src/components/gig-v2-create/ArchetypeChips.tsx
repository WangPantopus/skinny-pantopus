'use client';

import { useState } from 'react';
import type { TaskArchetype } from '@pantopus/types';

interface ArchetypeChipsProps {
  inferredArchetype: TaskArchetype;
  selectedArchetype: TaskArchetype | null;
  onSelect: (archetype: TaskArchetype | null) => void;
}

const PRIMARY_CHIPS: { value: TaskArchetype; icon: string; label: string }[] = [
  { value: 'quick_help', icon: '\u26A1', label: 'Quick Help' },
  { value: 'delivery_errand', icon: '\uD83D\uDE9A', label: 'Delivery' },
  { value: 'home_service', icon: '\uD83C\uDFE0', label: 'Home Service' },
  { value: 'pro_service_quote', icon: '\uD83D\uDD27', label: 'Pro Service' },
  { value: 'care_task', icon: '\uD83E\uDDD2', label: 'Care' },
];

const EXTRA_CHIPS: { value: TaskArchetype; icon: string; label: string }[] = [
  { value: 'event_shift', icon: '\uD83C\uDF89', label: 'Event' },
  { value: 'remote_task', icon: '\uD83D\uDCBB', label: 'Remote' },
  { value: 'recurring_service', icon: '\uD83D\uDD01', label: 'Recurring' },
];

export default function ArchetypeChips({
  inferredArchetype,
  selectedArchetype,
  onSelect,
}: ArchetypeChipsProps) {
  const [expanded, setExpanded] = useState(false);

  const active = selectedArchetype ?? inferredArchetype;

  // If the active archetype is in the extra set, auto-expand
  const needsExpand = EXTRA_CHIPS.some((c) => c.value === active);
  const chips = expanded || needsExpand ? [...PRIMARY_CHIPS, ...EXTRA_CHIPS] : PRIMARY_CHIPS;

  const handlePress = (value: TaskArchetype) => {
    if (selectedArchetype === value) {
      // Deselect → revert to AI inference
      onSelect(null);
    } else {
      onSelect(value);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-app-text-secondary uppercase tracking-wide">
          Task type
        </span>
        {selectedArchetype && selectedArchetype !== inferredArchetype && (
          <span className="text-[11px] text-amber-500 italic">overridden</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => {
          const isActive = active === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => handlePress(chip.value)}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${
                isActive
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-app-surface border-app-border text-app-text-secondary hover:border-app-border'
              }`}
            >
              {chip.icon} {chip.label}
            </button>
          );
        })}
        {!expanded && !needsExpand && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="px-3 py-1.5 rounded-full border border-app-border-subtle bg-app-surface text-sm font-medium text-app-text-muted hover:text-app-text-secondary transition"
          >
            More&hellip;
          </button>
        )}
      </div>
    </div>
  );
}
