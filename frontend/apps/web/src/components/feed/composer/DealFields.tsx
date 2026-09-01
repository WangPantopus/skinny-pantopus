'use client';

interface DealFieldsProps {
  dealBusinessName: string;
  onDealBusinessNameChange: (v: string) => void;
  dealExpires: string;
  onDealExpiresChange: (v: string) => void;
}

export default function DealFields({
  dealBusinessName, onDealBusinessNameChange,
  dealExpires, onDealExpiresChange,
}: DealFieldsProps) {
  return (
    <div className="mx-4 mb-3 p-3 bg-green-50 rounded-xl space-y-2 border border-green-100">
      <p className="text-xs font-semibold text-green-700">Deal Info</p>
      <input className="w-full px-3 py-2 text-sm border border-app bg-surface rounded-lg text-app" placeholder="Business name" value={dealBusinessName} onChange={(e) => onDealBusinessNameChange(e.target.value)} />
      <input type="date" className="w-full px-3 py-2 text-sm border border-app bg-surface rounded-lg text-app" placeholder="Expires (optional)" value={dealExpires} onChange={(e) => onDealExpiresChange(e.target.value)} />
    </div>
  );
}
