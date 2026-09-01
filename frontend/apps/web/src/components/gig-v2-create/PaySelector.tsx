'use client';

import { useState } from 'react';

interface PaySelectorProps {
  price: string;
  onPriceChange: (price: string) => void;
  openToOffers: boolean;
  onOpenToOffersChange: (value: boolean) => void;
}

const PRESETS = ['20', '40', '60'];

export default function PaySelector({
  price,
  onPriceChange,
  openToOffers,
  onOpenToOffersChange,
}: PaySelectorProps) {
  const [showCustom, setShowCustom] = useState(false);

  const handlePreset = (amount: string) => {
    setShowCustom(false);
    onPriceChange(amount);
    onOpenToOffersChange(false);
  };

  const handleCustom = () => {
    setShowCustom(true);
    onOpenToOffersChange(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-app-text-strong">Pay</p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => handlePreset(amount)}
            className={`px-4 py-2 rounded-full border text-sm font-medium transition ${
              price === amount && !openToOffers
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-app-surface-sunken border-app-border text-app-text-strong hover:border-app-border'
            }`}
          >
            ${amount}
          </button>
        ))}
        <button
          type="button"
          onClick={handleCustom}
          className={`px-4 py-2 rounded-full border text-sm font-medium transition ${
            showCustom && !openToOffers
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'bg-app-surface-sunken border-app-border text-app-text-strong hover:border-app-border'
          }`}
        >
          Custom
        </button>
      </div>

      {showCustom && !openToOffers && (
        <div className="flex items-center border border-app-border rounded-lg bg-app-surface px-3 max-w-[200px]">
          <span className="text-base font-semibold text-app-text-strong">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => onPriceChange(e.target.value)}
            placeholder="Enter amount"
            autoFocus
            className="flex-1 py-2.5 pl-1 text-base text-app-text bg-transparent outline-none placeholder:text-app-text-muted"
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-app-text-strong">Open to offers</span>
        <button
          type="button"
          role="switch"
          aria-checked={openToOffers}
          onClick={() => {
            const next = !openToOffers;
            onOpenToOffersChange(next);
            if (next) {
              setShowCustom(false);
              onPriceChange('');
            }
          }}
          className={`relative w-11 h-6 rounded-full transition ${
            openToOffers ? 'bg-emerald-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              openToOffers ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
