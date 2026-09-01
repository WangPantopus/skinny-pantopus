'use client';

import type { ScheduleType } from '@pantopus/types';

interface WhenChipsProps {
  value: ScheduleType;
  onChange: (value: ScheduleType) => void;
  scheduledDate: Date | null;
  onScheduledDateChange: (date: Date | null) => void;
}

const CHIPS: { label: string; value: ScheduleType }[] = [
  { label: 'Now', value: 'asap' },
  { label: 'Today', value: 'today' },
  { label: 'Schedule', value: 'scheduled' },
];

export default function WhenChips({
  value,
  onChange,
  scheduledDate,
  onScheduledDateChange,
}: WhenChipsProps) {
  const handleChipPress = (chipValue: ScheduleType) => {
    onChange(chipValue);
    if (chipValue === 'scheduled') {
      if (!scheduledDate) onScheduledDateChange(new Date(Date.now() + 86400000));
    } else {
      onScheduledDateChange(null);
    }
  };

  const dateInputValue = scheduledDate
    ? new Date(scheduledDate.getTime() - scheduledDate.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : '';

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-app-text-strong">When</p>
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => handleChipPress(chip.value)}
            className={`px-4 py-2 rounded-full border text-sm font-medium transition ${
              value === chip.value
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-app-surface-sunken border-app-border text-app-text-strong hover:border-app-border'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {value === 'scheduled' && (
        <input
          type="datetime-local"
          value={dateInputValue}
          min={new Date().toISOString().slice(0, 16)}
          onChange={(e) => {
            const d = e.target.value ? new Date(e.target.value) : null;
            onScheduledDateChange(d);
          }}
          className="px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface focus:outline-none focus:ring-2 focus:ring-emerald-400 max-w-[260px]"
        />
      )}
    </div>
  );
}
