'use client';

import { Search, CheckCircle } from 'lucide-react';

interface LostFoundFieldsProps {
  lostFoundType: 'lost' | 'found';
  onLostFoundTypeChange: (v: 'lost' | 'found') => void;
  contactPref: string;
  onContactPrefChange: (v: string) => void;
}

export default function LostFoundFields({
  lostFoundType, onLostFoundTypeChange,
  contactPref, onContactPrefChange,
}: LostFoundFieldsProps) {
  return (
    <div className="mx-4 mb-3 p-3 bg-yellow-50 rounded-xl space-y-2 border border-yellow-100">
      <div className="flex gap-2">
        <button onClick={() => onLostFoundTypeChange('lost')} className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition flex items-center justify-center gap-1.5 ${lostFoundType === 'lost' ? 'bg-yellow-600 text-white border-yellow-600' : 'border-yellow-300 text-yellow-700'}`}><Search className="w-4 h-4" /> Lost</button>
        <button onClick={() => onLostFoundTypeChange('found')} className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition flex items-center justify-center gap-1.5 ${lostFoundType === 'found' ? 'bg-yellow-600 text-white border-yellow-600' : 'border-yellow-300 text-yellow-700'}`}><CheckCircle className="w-4 h-4" /> Found</button>
      </div>
      <input className="w-full px-3 py-2 text-sm border border-app bg-surface rounded-lg text-app" placeholder="How to contact you" value={contactPref} onChange={(e) => onContactPrefChange(e.target.value)} />
    </div>
  );
}
