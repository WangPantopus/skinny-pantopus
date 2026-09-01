'use client';

import { X, Info } from 'lucide-react';
import type { FeedPrefs } from '@/hooks/useFeedPreferences';

interface FeedPreferencesPanelProps {
  open: boolean;
  onClose: () => void;
  prefs: FeedPrefs | null;
  updatePref: (key: string, value: boolean) => void;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 rounded-full transition flex-shrink-0 ${checked ? 'bg-emerald-600' : 'bg-gray-300'}`}>
      <span className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function FeedPreferencesPanel({ open, onClose, prefs, updatePref }: FeedPreferencesPanelProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-app-surface rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border-subtle">
          <h3 className="text-base font-semibold text-app-text">Pulse Preferences</h3>
          <button onClick={onClose} className="p-1 text-app-text-muted hover:text-app-text transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!prefs ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="px-5 py-4 space-y-1">
            {/* Place Feed */}
            <p className="text-[11px] font-bold text-app-text-muted uppercase tracking-wider mb-2">Place Feed</p>

            <div className="flex items-center justify-between py-3 border-b border-app-border-subtle">
              <div className="flex-1 mr-3">
                <p className="text-sm font-medium text-app-text">Show deals</p>
                <p className="text-xs text-app-text-secondary mt-0.5">Deals and promotions from local businesses</p>
              </div>
              <Toggle checked={!prefs.hide_deals_place} onChange={(v) => updatePref('hideDealsPlace', !v)} />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-app-border-subtle">
              <div className="flex-1 mr-3">
                <p className="text-sm font-medium text-app-text">Show safety alerts</p>
                <p className="text-xs text-app-text-secondary mt-0.5">Crime reports, hazards, and safety warnings</p>
              </div>
              <Toggle checked={!prefs.hide_alerts_place} onChange={(v) => updatePref('hideAlertsPlace', !v)} />
            </div>

            {/* Content */}
            <p className="text-[11px] font-bold text-app-text-muted uppercase tracking-wider mt-4 mb-2">Content</p>

            <div className="flex items-center justify-between py-3 border-b border-app-border-subtle">
              <div className="flex-1 mr-3">
                <p className="text-sm font-medium text-app-text">Show political content</p>
                <p className="text-xs text-app-text-secondary mt-0.5">Political posts are hidden by default to keep your feed focused</p>
              </div>
              <Toggle
                checked={!!prefs.show_politics_place}
                onChange={(v) => {
                  updatePref('showPoliticsPlace', v);
                  updatePref('showPoliticsConnections', v);
                }}
              />
            </div>

            {/* Footer note */}
            <div className="flex items-center gap-2 pt-4 pb-2">
              <Info className="w-3.5 h-3.5 text-app-text-muted flex-shrink-0" />
              <p className="text-xs text-app-text-muted">These preferences sync across all your devices.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
