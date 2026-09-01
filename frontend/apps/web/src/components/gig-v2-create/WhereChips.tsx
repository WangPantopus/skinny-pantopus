'use client';

type LocationMode = 'home' | 'current' | 'address';

interface WhereChipsProps {
  value: LocationMode;
  onChange: (mode: LocationMode) => void;
  address?: string;
  hasHome: boolean;
  onAddressChange?: (address: string) => void;
}

const CHIPS: { label: string; value: LocationMode; icon: string }[] = [
  { label: 'My Home', value: 'home', icon: '\uD83C\uDFE0' },
  { label: 'Current Location', value: 'current', icon: '\uD83D\uDCCD' },
  { label: 'Other Address', value: 'address', icon: '\uD83D\uDDFA\uFE0F' },
];

export default function WhereChips({
  value,
  onChange,
  address = '',
  hasHome,
  onAddressChange,
}: WhereChipsProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-app-text-strong">Where</p>
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => {
          if (chip.value === 'home' && !hasHome) return null;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => onChange(chip.value)}
              className={`px-3.5 py-2 rounded-full border text-sm font-medium transition ${
                value === chip.value
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-app-surface-sunken border-app-border text-app-text-strong hover:border-app-border'
              }`}
            >
              {chip.icon} {chip.label}
            </button>
          );
        })}
      </div>
      {address && (
        <p className="text-sm text-app-text-secondary truncate">{address}</p>
      )}
      {value === 'address' && (
        <input
          type="text"
          value={address}
          onChange={(e) => onAddressChange?.(e.target.value)}
          placeholder="Enter address..."
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-app-text-muted"
        />
      )}
    </div>
  );
}
