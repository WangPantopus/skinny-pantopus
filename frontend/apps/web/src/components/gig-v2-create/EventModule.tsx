'use client';

export interface EventData {
  eventType: string;
  guestCount: number | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  dressCode: string;
  roleType: string;
  venueDetails: string;
}

interface EventModuleProps {
  data: EventData;
  onChange: (data: EventData) => void;
}

const EVENT_TYPE_CHIPS: { value: string; icon: string; label: string }[] = [
  { value: 'party', icon: '\uD83C\uDF89', label: 'Party' },
  { value: 'wedding', icon: '\uD83D\uDC8D', label: 'Wedding' },
  { value: 'corporate', icon: '\uD83C\uDFE2', label: 'Corporate' },
  { value: 'community', icon: '\uD83C\uDFAA', label: 'Community' },
  { value: 'other', icon: '\uD83D\uDCCB', label: 'Other' },
];

const ROLE_TYPE_CHIPS: { value: string; icon: string; label: string }[] = [
  { value: 'setup', icon: '\uD83D\uDD28', label: 'Setup' },
  { value: 'serving', icon: '\uD83C\uDF7D\uFE0F', label: 'Serving' },
  { value: 'bartending', icon: '\uD83C\uDF78', label: 'Bartending' },
  { value: 'cleanup', icon: '\uD83E\uDDF9', label: 'Cleanup' },
  { value: 'general', icon: '\u2B50', label: 'General' },
];

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function EventModule({ data, onChange }: EventModuleProps) {
  const update = (partial: Partial<EventData>) => onChange({ ...data, ...partial });

  return (
    <div className="border border-app-border rounded-xl bg-app-surface p-4 space-y-3">
      <h4 className="text-base font-bold text-app-text">{'\uD83C\uDF89'} Event Details</h4>

      {/* Event type */}
      <fieldset className="space-y-1">
        <legend className="text-sm font-semibold text-app-text-strong">Event type</legend>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {EVENT_TYPE_CHIPS.map((chip) => (
            <button key={chip.value} type="button" onClick={() => update({ eventType: chip.value })}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${data.eventType === chip.value ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-app-surface border-app-border text-app-text-secondary'}`}>
              {chip.icon} {chip.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Guest count */}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-app-text-strong">Expected guests</span>
        <input type="text" inputMode="numeric" value={data.guestCount != null ? String(data.guestCount) : ''} onChange={(e) => { const n = parseInt(e.target.value, 10); update({ guestCount: Number.isFinite(n) && n > 0 ? n : null }); }} placeholder="e.g., 50"
          className="w-full max-w-[120px] px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
      </label>

      {/* Shift start */}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-app-text-strong">Shift start</span>
        <div className="flex items-center gap-2">
          <input type="datetime-local" value={data.shiftStart ? toDateTimeLocal(data.shiftStart) : ''} min={new Date().toISOString().slice(0, 16)} onChange={(e) => update({ shiftStart: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          {data.shiftStart && <button type="button" onClick={() => update({ shiftStart: null })} className="text-xs text-emerald-600 font-medium">Clear</button>}
        </div>
      </label>

      {/* Shift end */}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-app-text-strong">Shift end</span>
        <div className="flex items-center gap-2">
          <input type="datetime-local" value={data.shiftEnd ? toDateTimeLocal(data.shiftEnd) : ''} min={data.shiftStart ? toDateTimeLocal(data.shiftStart) : new Date().toISOString().slice(0, 16)} onChange={(e) => update({ shiftEnd: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          {data.shiftEnd && <button type="button" onClick={() => update({ shiftEnd: null })} className="text-xs text-emerald-600 font-medium">Clear</button>}
        </div>
      </label>

      {/* Dress code */}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-app-text-strong">Dress code</span>
        <input type="text" value={data.dressCode} onChange={(e) => update({ dressCode: e.target.value })} placeholder="e.g., Black shirt, formal, casual"
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
      </label>

      {/* Role type */}
      <fieldset className="space-y-1">
        <legend className="text-sm font-semibold text-app-text-strong">Role</legend>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {ROLE_TYPE_CHIPS.map((chip) => (
            <button key={chip.value} type="button" onClick={() => update({ roleType: chip.value })}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${data.roleType === chip.value ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-app-surface border-app-border text-app-text-secondary'}`}>
              {chip.icon} {chip.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Venue details */}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-app-text-strong">Venue notes</span>
        <textarea value={data.venueDetails} onChange={(e) => update({ venueDetails: e.target.value })} placeholder="Parking, entrance, setup area..." rows={3}
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
      </label>
    </div>
  );
}
