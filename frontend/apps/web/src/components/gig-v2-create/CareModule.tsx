'use client';

const CARE_CATEGORIES = ['pet care', 'child care'];

export function isCareCategory(category: string): boolean {
  return CARE_CATEGORIES.includes((category || '').toLowerCase());
}

export type CareType = 'child' | 'pet' | 'elder' | 'other';

export interface CareData {
  careType: CareType;
  agesOrDetails: string;
  count: number;
  specialNeeds: string;
  languagePreference: string;
  preferredHelperId: string | null;
  emergencyNotes: string;
}

interface CareModuleProps {
  category: string;
  data: CareData;
  onChange: (data: CareData) => void;
}

const CARE_TYPE_CHIPS: { value: CareType; icon: string; label: string }[] = [
  { value: 'child', icon: '\uD83E\uDDD2', label: 'Child' },
  { value: 'pet', icon: '\uD83D\uDC3E', label: 'Pet' },
  { value: 'elder', icon: '\uD83E\uDDD3', label: 'Elder' },
  { value: 'other', icon: '\uD83E\uDD1D', label: 'Other' },
];

export default function CareModule({ category, data, onChange }: CareModuleProps) {
  const update = (partial: Partial<CareData>) => onChange({ ...data, ...partial });

  const detailsLabel =
    data.careType === 'pet' ? 'Pet details' : data.careType === 'elder' ? 'Details' : 'Ages / details';
  const detailsPlaceholder =
    data.careType === 'pet'
      ? 'e.g., Golden retriever, 3 years old'
      : data.careType === 'elder'
        ? 'e.g., Mobility assistance needed'
        : 'e.g., 3 and 5 year old';

  return (
    <div className="border border-app-border rounded-xl bg-app-surface p-4 space-y-3">
      <h4 className="text-base font-bold text-app-text">{'\uD83E\uDDD2'} Care Details</h4>

      {/* Care type */}
      <fieldset className="space-y-1">
        <legend className="text-sm font-semibold text-app-text-strong">Care type</legend>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {CARE_TYPE_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => update({ careType: chip.value })}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${
                data.careType === chip.value
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-app-surface border-app-border text-app-text-secondary'
              }`}
            >
              {chip.icon} {chip.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Ages or details */}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-app-text-strong">{detailsLabel}</span>
        <input
          type="text"
          value={data.agesOrDetails}
          onChange={(e) => update({ agesOrDetails: e.target.value })}
          placeholder={detailsPlaceholder}
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </label>

      {/* Count */}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-app-text-strong">
          {data.careType === 'pet' ? 'Number of pets' : 'Number of people'}
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={data.count > 0 ? String(data.count) : ''}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            update({ count: Number.isFinite(n) && n > 0 ? n : 0 });
          }}
          placeholder="1"
          className="w-full max-w-[100px] px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </label>

      {/* Special needs */}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-app-text-strong">Special needs</span>
        <textarea
          value={data.specialNeeds}
          onChange={(e) => update({ specialNeeds: e.target.value })}
          placeholder="Allergies, medications, behavioral notes..."
          rows={3}
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
        />
      </label>

      {/* Language preference */}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-app-text-strong">Language preference</span>
        <input
          type="text"
          value={data.languagePreference}
          onChange={(e) => update({ languagePreference: e.target.value })}
          placeholder="e.g., English, Spanish"
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </label>

      {/* Emergency notes */}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-app-text-strong">Emergency notes</span>
        <textarea
          value={data.emergencyNotes}
          onChange={(e) => update({ emergencyNotes: e.target.value })}
          placeholder="Emergency contact, hospital preference..."
          rows={3}
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
        />
      </label>
    </div>
  );
}
