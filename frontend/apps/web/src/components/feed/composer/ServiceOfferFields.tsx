'use client';

interface ServiceOfferFieldsProps {
  serviceCategory: string;
  onServiceCategoryChange: (v: string) => void;
}

export default function ServiceOfferFields({
  serviceCategory, onServiceCategoryChange,
}: ServiceOfferFieldsProps) {
  return (
    <div className="mx-4 mb-3 p-3 bg-violet-50 rounded-xl space-y-2 border border-violet-100">
      <input className="w-full px-3 py-2 text-sm border border-app bg-surface rounded-lg text-app" placeholder="Service category (e.g. Plumbing, Tutoring)" value={serviceCategory} onChange={(e) => onServiceCategoryChange(e.target.value)} />
    </div>
  );
}
