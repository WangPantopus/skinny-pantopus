'use client';

import { Search, CheckCircle } from 'lucide-react';

export type LostFoundContactPref = 'dm' | 'comment' | 'phone';

// The choices the API accepts, labelled as in the iOS and Android composers.
const CONTACT_OPTIONS: { key: LostFoundContactPref; label: string }[] = [
  { key: 'dm', label: 'Direct message' },
  { key: 'comment', label: 'Comments' },
  { key: 'phone', label: 'Phone' },
];

/** Readable text for a stored contact preference: 'dm', 'comment', 'phone' or 'phone|<digits>'. */
export function lostFoundContactLabel(stored: string): string {
  const [key, number] = stored.split('|');
  const option = CONTACT_OPTIONS.find((o) => o.key === key);
  if (!option) return stored;
  return key === 'phone' && number ? `${option.label} ${number}` : option.label;
}

interface LostFoundFieldsProps {
  lostFoundType: 'lost' | 'found';
  onLostFoundTypeChange: (v: 'lost' | 'found') => void;
  contactPref: LostFoundContactPref;
  onContactPrefChange: (v: LostFoundContactPref) => void;
  contactPhone: string;
  onContactPhoneChange: (v: string) => void;
}

export default function LostFoundFields({
  lostFoundType, onLostFoundTypeChange,
  contactPref, onContactPrefChange,
  contactPhone, onContactPhoneChange,
}: LostFoundFieldsProps) {
  return (
    <div className="mx-4 mb-3 p-3 bg-yellow-50 rounded-xl space-y-2 border border-yellow-100">
      <div className="flex gap-2">
        <button onClick={() => onLostFoundTypeChange('lost')} className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition flex items-center justify-center gap-1.5 ${lostFoundType === 'lost' ? 'bg-yellow-600 text-white border-yellow-600' : 'border-yellow-300 text-yellow-700'}`}><Search className="w-4 h-4" /> Lost</button>
        <button onClick={() => onLostFoundTypeChange('found')} className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition flex items-center justify-center gap-1.5 ${lostFoundType === 'found' ? 'bg-yellow-600 text-white border-yellow-600' : 'border-yellow-300 text-yellow-700'}`}><CheckCircle className="w-4 h-4" /> Found</button>
      </div>
      <p id="lost-found-contact-label" className="text-xs font-medium text-yellow-800">How should people contact you?</p>
      <div role="radiogroup" aria-labelledby="lost-found-contact-label" className="flex flex-wrap gap-2">
        {CONTACT_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={contactPref === option.key}
            onClick={() => onContactPrefChange(option.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${contactPref === option.key ? 'bg-yellow-600 text-white border-yellow-600' : 'border-yellow-300 text-yellow-700'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {contactPref === 'phone' && (
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          aria-label="Phone number"
          className="w-full px-3 py-2 text-sm border border-app bg-surface rounded-lg text-app"
          placeholder="(555) 555-0123"
          value={contactPhone}
          onChange={(e) => onContactPhoneChange(e.target.value)}
        />
      )}
    </div>
  );
}
