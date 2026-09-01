'use client';

export interface RemoteData {
  deliverableType: string;
  fileFormat: string;
  revisionCount: number;
  timezone: string;
  meetingRequired: boolean;
  dueDate: string | null;
}

interface RemoteModuleProps {
  data: RemoteData;
  onChange: (data: RemoteData) => void;
}

const DELIVERABLE_CHIPS: { value: string; icon: string; label: string }[] = [
  { value: 'document', icon: '\uD83D\uDCC4', label: 'Document' },
  { value: 'design', icon: '\uD83C\uDFA8', label: 'Design' },
  { value: 'code', icon: '\uD83D\uDCBB', label: 'Code' },
  { value: 'video', icon: '\uD83C\uDFAC', label: 'Video' },
  { value: 'other', icon: '\uD83D\uDCCB', label: 'Other' },
];

export default function RemoteModule({ data, onChange }: RemoteModuleProps) {
  const update = (partial: Partial<RemoteData>) => onChange({ ...data, ...partial });

  const dueDateValue = data.dueDate
    ? new Date(new Date(data.dueDate).getTime() - new Date(data.dueDate).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10)
    : '';

  return (
    <div className="border border-app-border rounded-xl bg-app-surface p-4 space-y-3">
      <h4 className="text-base font-bold text-app-text">{'\uD83D\uDCBB'} Remote Task Details</h4>

      {/* Deliverable type */}
      <fieldset className="space-y-1">
        <legend className="text-sm font-semibold text-app-text-strong">Deliverable type</legend>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {DELIVERABLE_CHIPS.map((chip) => (
            <button key={chip.value} type="button" onClick={() => update({ deliverableType: chip.value })}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${data.deliverableType === chip.value ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-app-surface border-app-border text-app-text-secondary'}`}>
              {chip.icon} {chip.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* File format */}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-app-text-strong">File format</span>
        <input type="text" value={data.fileFormat} onChange={(e) => update({ fileFormat: e.target.value })} placeholder="e.g., PDF, PSD, MP4, .docx"
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
      </label>

      {/* Revision count */}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-app-text-strong">Revisions included</p>
        <div className="flex items-center gap-4 mt-1">
          <button type="button" disabled={data.revisionCount <= 1} onClick={() => update({ revisionCount: Math.max(1, data.revisionCount - 1) })}
            className="w-9 h-9 rounded-full border border-app-border flex items-center justify-center text-lg font-semibold text-app-text disabled:opacity-30">&minus;</button>
          <span className="text-lg font-bold text-app-text min-w-[28px] text-center">{data.revisionCount}</span>
          <button type="button" disabled={data.revisionCount >= 5} onClick={() => update({ revisionCount: Math.min(5, data.revisionCount + 1) })}
            className="w-9 h-9 rounded-full border border-app-border flex items-center justify-center text-lg font-semibold text-app-text disabled:opacity-30">+</button>
        </div>
      </div>

      {/* Timezone */}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-app-text-strong">Timezone preference</span>
        <input type="text" value={data.timezone} onChange={(e) => update({ timezone: e.target.value })} placeholder="e.g., EST, PST, UTC+2"
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
      </label>

      {/* Meeting required */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-app-text-strong">Meeting / call required</span>
        <button type="button" role="switch" aria-checked={data.meetingRequired} onClick={() => update({ meetingRequired: !data.meetingRequired })}
          className={`relative w-11 h-6 rounded-full transition ${data.meetingRequired ? 'bg-emerald-600' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${data.meetingRequired ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {/* Due date */}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-app-text-strong">Due date</span>
        <div className="flex items-center gap-2">
          <input type="date" value={dueDateValue} min={new Date().toISOString().slice(0, 10)} onChange={(e) => update({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          {data.dueDate && <button type="button" onClick={() => update({ dueDate: null })} className="text-xs text-emerald-600 font-medium">Clear</button>}
        </div>
      </label>
    </div>
  );
}
