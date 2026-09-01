'use client';

export type ResponseWindow = 5 | 10 | 15 | 30;
export type FulfillmentMode = 'come_here' | 'pickup_deliver' | 'roadside';

export interface UrgentData {
  responseWindowMinutes: ResponseWindow;
  fulfillmentMode: FulfillmentMode;
  shareLocationDuringTask: boolean;
  roadsideVehicleNotes: string;
}

interface UrgentModuleProps {
  data: UrgentData;
  onChange: (data: UrgentData) => void;
}

const RESPONSE_CHIPS: { value: ResponseWindow; label: string }[] = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
];

const FULFILLMENT_CHIPS: { value: FulfillmentMode; icon: string; label: string }[] = [
  { value: 'come_here', icon: '\uD83D\uDCCD', label: 'Come to me' },
  { value: 'pickup_deliver', icon: '\uD83D\uDCE6', label: 'Pick up & bring here' },
  { value: 'roadside', icon: '\uD83D\uDE97', label: 'Roadside help' },
];

export default function UrgentModule({ data, onChange }: UrgentModuleProps) {
  const update = (partial: Partial<UrgentData>) => onChange({ ...data, ...partial });

  return (
    <div className="border border-app-border border-l-4 border-l-amber-500 rounded-xl bg-app-surface p-4 space-y-3">
      <h4 className="text-base font-bold text-app-text">{'\u26A1'} Urgent Help</h4>

      {/* Response window */}
      <fieldset className="space-y-1">
        <legend className="text-sm font-semibold text-app-text-strong">Respond within</legend>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {RESPONSE_CHIPS.map((chip) => (
            <button key={chip.value} type="button" onClick={() => update({ responseWindowMinutes: chip.value })}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${data.responseWindowMinutes === chip.value ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-app-surface border-app-border text-app-text-secondary'}`}>
              {chip.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Fulfillment mode */}
      <fieldset className="space-y-1">
        <legend className="text-sm font-semibold text-app-text-strong">What do you need?</legend>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {FULFILLMENT_CHIPS.map((chip) => (
            <button key={chip.value} type="button" onClick={() => update({ fulfillmentMode: chip.value })}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${data.fulfillmentMode === chip.value ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-app-surface border-app-border text-app-text-secondary'}`}>
              {chip.icon} {chip.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Roadside vehicle notes */}
      {data.fulfillmentMode === 'roadside' && (
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-app-text-strong">Vehicle details</span>
          <textarea value={data.roadsideVehicleNotes} onChange={(e) => update({ roadsideVehicleNotes: e.target.value })} placeholder="Make, model, color, location on road..." rows={3}
            className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
        </label>
      )}

      {/* Share location toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm text-app-text-strong">Share live location during task?</p>
          <p className="text-xs text-app-text-muted mt-0.5">Helper sees your location in real-time until the task is complete</p>
        </div>
        <button type="button" role="switch" aria-checked={data.shareLocationDuringTask} onClick={() => update({ shareLocationDuringTask: !data.shareLocationDuringTask })}
          className={`relative w-11 h-6 rounded-full transition flex-shrink-0 ${data.shareLocationDuringTask ? 'bg-emerald-600' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${data.shareLocationDuringTask ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {/* Safety banner */}
      <div className="bg-red-50 rounded-lg p-3 mt-1">
        <p className="text-sm font-semibold text-red-600 leading-snug">
          {'\uD83D\uDEA8'} For medical emergencies, fire, or violent situations, call 911 first.
        </p>
      </div>
    </div>
  );
}
