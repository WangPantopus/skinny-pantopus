'use client';

interface DealFieldsProps {
  dealBusinessName: string;
  onDealBusinessNameChange: (v: string) => void;
  dealExpires: string;
  onDealExpiresChange: (v: string) => void;
  /** The Place feed refuses a deal without an end date; a Connections deal may leave it empty. */
  expiryRequired?: boolean;
}

export default function DealFields({
  dealBusinessName, onDealBusinessNameChange,
  dealExpires, onDealExpiresChange,
  expiryRequired = false,
}: DealFieldsProps) {
  return (
    <div className="mx-4 mb-3 p-3 bg-green-50 rounded-xl space-y-2 border border-green-100">
      <p className="text-xs font-semibold text-green-700">Deal Info</p>
      <input className="w-full px-3 py-2 text-sm border border-app bg-surface rounded-lg text-app" placeholder="Business name" value={dealBusinessName} onChange={(e) => onDealBusinessNameChange(e.target.value)} />
      {/* A date input draws no placeholder, so the visible label names it (native says "Deal ends"). */}
      <label className="block">
        <span className="block mb-1 text-xs font-medium text-app-muted">{expiryRequired ? 'Deal ends' : 'Deal ends (optional)'}</span>
        <input type="date" aria-required={expiryRequired || undefined} className="w-full px-3 py-2 text-sm border border-app bg-surface rounded-lg text-app" value={dealExpires} onChange={(e) => onDealExpiresChange(e.target.value)} />
      </label>
    </div>
  );
}
