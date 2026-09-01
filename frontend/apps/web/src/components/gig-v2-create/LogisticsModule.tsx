'use client';

import { useState } from 'react';

export interface LogisticsData {
  workerCount: number;
  vehicleNeeded: boolean;
  vehicleType: string;
  toolsNeeded: string[];
  accessInstructions: string;
  petsOnProperty: boolean;
  stairsInfo: string;
  heavyLifting: boolean;
}

interface LogisticsModuleProps {
  data: LogisticsData;
  onChange: (data: LogisticsData) => void;
}

const STAIRS_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'few_steps', label: 'Few Steps' },
  { value: 'multiple_flights', label: 'Multiple Flights' },
];

function Toggle({ checked, onChange, label, subtext }: { checked: boolean; onChange: (v: boolean) => void; label: string; subtext?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <span className="text-sm text-app-text-strong">{label}</span>
        {subtext && <p className="text-xs text-app-text-muted mt-0.5">{subtext}</p>}
      </div>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition ${checked ? 'bg-emerald-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

export default function LogisticsModule({ data, onChange }: LogisticsModuleProps) {
  const [toolInput, setToolInput] = useState('');
  const update = (partial: Partial<LogisticsData>) => onChange({ ...data, ...partial });

  const addTool = () => {
    const trimmed = toolInput.trim();
    if (!trimmed || data.toolsNeeded.includes(trimmed)) return;
    update({ toolsNeeded: [...data.toolsNeeded, trimmed] });
    setToolInput('');
  };

  return (
    <div className="border border-app-border rounded-xl bg-app-surface p-4 space-y-3">
      <h4 className="text-base font-bold text-app-text">{'\uD83C\uDFD7\uFE0F'} Logistics & Access</h4>

      {/* Worker count */}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-app-text-strong">Workers needed</p>
        <div className="flex items-center gap-4 mt-1">
          <button type="button" disabled={data.workerCount <= 1} onClick={() => update({ workerCount: Math.max(1, data.workerCount - 1) })}
            className="w-9 h-9 rounded-full border border-app-border flex items-center justify-center text-lg font-semibold text-app-text disabled:opacity-30">&minus;</button>
          <span className="text-lg font-bold text-app-text min-w-[28px] text-center">{data.workerCount}</span>
          <button type="button" disabled={data.workerCount >= 10} onClick={() => update({ workerCount: Math.min(10, data.workerCount + 1) })}
            className="w-9 h-9 rounded-full border border-app-border flex items-center justify-center text-lg font-semibold text-app-text disabled:opacity-30">+</button>
        </div>
      </div>

      {/* Vehicle */}
      <Toggle checked={data.vehicleNeeded} onChange={(v) => update({ vehicleNeeded: v })} label="Vehicle needed" />
      {data.vehicleNeeded && (
        <input type="text" value={data.vehicleType} onChange={(e) => update({ vehicleType: e.target.value })} placeholder="e.g., Pickup truck, van, SUV"
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
      )}

      {/* Tools */}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-app-text-strong">Tools needed</p>
        {data.toolsNeeded.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.toolsNeeded.map((tool, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-sm font-medium text-emerald-700">
                {tool}
                <button type="button" onClick={() => update({ toolsNeeded: data.toolsNeeded.filter((_, idx) => idx !== i) })} className="text-emerald-700 font-bold ml-0.5">&times;</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-1">
          <input type="text" value={toolInput} onChange={(e) => setToolInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTool())} placeholder="Add a tool..."
            className="flex-1 px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          <button type="button" onClick={addTool} disabled={!toolInput.trim()} className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:bg-emerald-700 transition">Add</button>
        </div>
      </div>

      {/* Access instructions */}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-app-text-strong">Access instructions</span>
        <textarea value={data.accessInstructions} onChange={(e) => update({ accessInstructions: e.target.value })} placeholder="Gate code, parking info, entry instructions..." rows={3}
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
      </label>

      {/* Pets on property */}
      <Toggle checked={data.petsOnProperty} onChange={(v) => update({ petsOnProperty: v })} label="Pets on property" />

      {/* Stairs */}
      <fieldset className="space-y-1">
        <legend className="text-sm font-semibold text-app-text-strong">Stairs</legend>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {STAIRS_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => update({ stairsInfo: opt.value })}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${data.stairsInfo === opt.value ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-app-surface border-app-border text-app-text-secondary'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Heavy lifting */}
      <Toggle checked={data.heavyLifting} onChange={(v) => update({ heavyLifting: v })} label="Heavy lifting required" />
    </div>
  );
}
