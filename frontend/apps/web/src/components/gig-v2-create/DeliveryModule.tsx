'use client';

import { DELIVERY_CATEGORIES } from '@pantopus/types';

export function isDeliveryCategory(category: string): boolean {
  return DELIVERY_CATEGORIES.some(
    (c) => c.toLowerCase() === (category || '').toLowerCase(),
  );
}

export interface DeliveryData {
  pickupAddress: string;
  pickupNotes: string;
  dropoffAddress: string;
  dropoffNotes: string;
  deliveryProofRequired: boolean;
  items: { name: string; notes: string; budgetCap: string; preferredStore: string }[];
}

interface DeliveryModuleProps {
  category: string;
  data: DeliveryData;
  onChange: (data: DeliveryData) => void;
  sameAsTaskLocation?: boolean;
  onSameAsTaskLocationChange?: (val: boolean) => void;
}

export default function DeliveryModule({
  category,
  data,
  onChange,
  sameAsTaskLocation = false,
  onSameAsTaskLocationChange,
}: DeliveryModuleProps) {
  const update = (partial: Partial<DeliveryData>) => onChange({ ...data, ...partial });

  const addItem = () =>
    update({ items: [...data.items, { name: '', notes: '', budgetCap: '', preferredStore: '' }] });
  const updateItem = (idx: number, field: string, value: string) =>
    update({ items: data.items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)) });
  const removeItem = (idx: number) =>
    update({ items: data.items.filter((_, i) => i !== idx) });

  return (
    <div className="border border-app-border rounded-xl bg-app-surface p-4 space-y-4">
      <h4 className="text-base font-bold text-app-text">{'\uD83D\uDE9A'} Delivery Details</h4>

      {/* Pickup */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-app-text-strong">Pickup</p>
        {onSameAsTaskLocationChange && (
          <label className="flex items-center justify-between">
            <span className="text-sm text-app-text-strong">Same as task location</span>
            <button
              type="button"
              role="switch"
              aria-checked={sameAsTaskLocation}
              onClick={() => onSameAsTaskLocationChange(!sameAsTaskLocation)}
              className={`relative w-11 h-6 rounded-full transition ${sameAsTaskLocation ? 'bg-emerald-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sameAsTaskLocation ? 'translate-x-5' : ''}`} />
            </button>
          </label>
        )}
        {!sameAsTaskLocation && (
          <input
            type="text"
            value={data.pickupAddress}
            onChange={(e) => update({ pickupAddress: e.target.value })}
            placeholder="Pickup address"
            className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        )}
        <input
          type="text"
          value={data.pickupNotes}
          onChange={(e) => update({ pickupNotes: e.target.value })}
          placeholder="e.g., Ask for John at the counter"
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>

      {/* Dropoff */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-app-text-strong">Dropoff</p>
        <input
          type="text"
          value={data.dropoffAddress}
          onChange={(e) => update({ dropoffAddress: e.target.value })}
          placeholder="Dropoff address (defaults to your home)"
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <input
          type="text"
          value={data.dropoffNotes}
          onChange={(e) => update({ dropoffNotes: e.target.value })}
          placeholder="e.g., Leave on the front porch"
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>

      {/* Items */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-app-text-strong">Items</p>
        {data.items.map((item, idx) => (
          <div key={idx} className="border border-app-border-subtle rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-app-text-muted">Item {idx + 1}</span>
              <button type="button" onClick={() => removeItem(idx)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
            </div>
            <input type="text" value={item.name} onChange={(e) => updateItem(idx, 'name', e.target.value)} placeholder="Item name" className="w-full px-3 py-1.5 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            <input type="text" value={item.preferredStore} onChange={(e) => updateItem(idx, 'preferredStore', e.target.value)} placeholder="Preferred store" className="w-full px-3 py-1.5 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
        ))}
        <button type="button" onClick={addItem} className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
          + Add item
        </button>
      </div>

      {/* Proof toggle */}
      <label className="flex items-center justify-between">
        <span className="text-sm text-app-text-strong">Require delivery proof photo</span>
        <button
          type="button"
          role="switch"
          aria-checked={data.deliveryProofRequired}
          onClick={() => update({ deliveryProofRequired: !data.deliveryProofRequired })}
          className={`relative w-11 h-6 rounded-full transition ${data.deliveryProofRequired ? 'bg-emerald-600' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${data.deliveryProofRequired ? 'translate-x-5' : ''}`} />
        </button>
      </label>
    </div>
  );
}
