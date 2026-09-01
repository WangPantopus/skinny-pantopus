'use client';

import { PRO_CATEGORIES } from '@pantopus/types';

export function isProCategory(category: string): boolean {
  return PRO_CATEGORIES.some(
    (c) => c.toLowerCase() === (category || '').toLowerCase(),
  );
}

export interface ProServicesData {
  requiresLicense: boolean;
  licenseType: string;
  requiresInsurance: boolean;
  scopeDescription: string;
  depositRequired: boolean;
  depositAmount: string;
}

interface ProServicesModuleProps {
  category: string;
  data: ProServicesData;
  onChange: (data: ProServicesData) => void;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-app-text-strong">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition ${checked ? 'bg-emerald-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

export default function ProServicesModule({ category, data, onChange }: ProServicesModuleProps) {
  const update = (partial: Partial<ProServicesData>) => onChange({ ...data, ...partial });

  return (
    <div className="border border-app-border rounded-xl bg-app-surface p-4 space-y-3">
      <h4 className="text-base font-bold text-app-text">{'\uD83D\uDD27'} Professional Requirements</h4>

      {/* License */}
      <Toggle checked={data.requiresLicense} onChange={(v) => update({ requiresLicense: v })} label="Requires license" />
      {data.requiresLicense && (
        <input type="text" value={data.licenseType} onChange={(e) => update({ licenseType: e.target.value })} placeholder="License type (e.g., Licensed Plumber)"
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
      )}

      {/* Insurance */}
      <Toggle checked={data.requiresInsurance} onChange={(v) => update({ requiresInsurance: v })} label="Requires insurance" />

      {/* Scope */}
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-app-text-strong">Scope of work</span>
        <textarea value={data.scopeDescription} onChange={(e) => update({ scopeDescription: e.target.value })} placeholder="Describe the scope of work needed..." rows={4}
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
      </label>

      {/* Deposit */}
      <Toggle checked={data.depositRequired} onChange={(v) => update({ depositRequired: v })} label="Require deposit" />
      {data.depositRequired && (
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-app-text-strong">Deposit amount ($)</span>
          <input type="text" inputMode="numeric" value={data.depositAmount} onChange={(e) => update({ depositAmount: e.target.value })} placeholder="0"
            className="w-full max-w-[150px] px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </label>
      )}
    </div>
  );
}
