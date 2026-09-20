'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '@pantopus/api';
import type { GuestPass } from '@pantopus/api';
import CreateGuestPass from './CreateGuestPass';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import { failureMessage } from './shareFailure';

const QUICK_TEMPLATES: {
  kind: GuestPass['kind'];
  icon: string;
  label: string;
  description: string;
  defaultHours: number;
  sections: string[];
}[] = [
  {
    kind: 'wifi_only',
    icon: '📶',
    label: 'WiFi',
    description: 'Share WiFi credentials only',
    defaultHours: 2,
    sections: ['wifi'],
  },
  {
    kind: 'guest',
    icon: '🏠',
    label: 'Guest',
    description: 'House rules, entry, WiFi, parking',
    defaultHours: 48,
    sections: ['wifi', 'entry_instructions', 'house_rules', 'parking'],
  },
  {
    kind: 'vendor',
    icon: '🔧',
    label: 'Vendor',
    description: 'Entry instructions and emergency info',
    defaultHours: 8,
    sections: ['entry_instructions', 'emergency', 'parking'],
  },
  {
    kind: 'airbnb',
    icon: '🛏️',
    label: 'Airbnb',
    description: 'Full guest guide with all sections',
    defaultHours: 72,
    sections: ['wifi', 'entry_instructions', 'house_rules', 'parking', 'trash_day', 'local_tips', 'emergency'],
  },
];

function timeRemaining(endAt: string | null): string {
  if (!endAt) return 'No expiry';
  const end = new Date(endAt);
  const now = new Date();
  if (end <= now) return 'Expired';
  const diffMs = end.getTime() - now.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h left`;
  }
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

// The list endpoint already decides each pass's current status. Read it here so
// a scheduled or reissue-required link is never advertised as Active; a guest
// opening either one is refused by the share API.
const NEUTRAL_BADGE = 'bg-app-surface-sunken text-app-text-secondary border-app-border';

export function passStatus(pass: GuestPass): 'revoked' | 'expired' | 'reissue_required' | 'scheduled' | 'active' {
  if (pass.revoked_at || pass.status === 'revoked') return 'revoked';
  if (pass.status === 'expired' || pass.status === 'reissue_required' || pass.status === 'scheduled') return pass.status;
  // Older list envelopes omit `status`; keep the existing end-date fallback.
  if (pass.end_at && new Date(pass.end_at) <= new Date()) return 'expired';
  return 'active';
}

function statusBadge(pass: GuestPass) {
  switch (passStatus(pass)) {
    case 'revoked': return { text: 'Revoked', cls: 'bg-red-50 text-red-700 border-red-200' };
    case 'expired': return { text: 'Expired', cls: NEUTRAL_BADGE };
    case 'reissue_required': return { text: 'Needs new link', cls: NEUTRAL_BADGE };
    case 'scheduled': return { text: 'Scheduled', cls: NEUTRAL_BADGE };
    default: return { text: 'Active', cls: 'bg-green-50 text-green-700 border-green-200' };
  }
}

const KIND_ICON: Record<string, string> = {
  wifi_only: '📶',
  guest: '🏠',
  vendor: '🔧',
  airbnb: '🛏️',
};

export default function ShareCenter({
  homeId,
  home: _home,
  secrets: _secrets,
  emergencies: _emergencies,
  can: _can,
  onSecretsChange: _onSecretsChange,
}: {
  homeId: string;
  home: Record<string, any>;
  secrets: Record<string, any>[];
  emergencies: Record<string, any>[];
  can: (perm: string) => boolean;
  onSecretsChange: (s: Record<string, any>[]) => void;
}) {
  const [passes, setPasses] = useState<GuestPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [preselectedKind, setPreselectedKind] = useState<GuestPass['kind'] | null>(null);
  const [showPastPasses, setShowPastPasses] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [listError, setListError] = useState('');
  // A superseded list read must not replace the current one.
  const generation = useRef(0);

  const loadPasses = useCallback(async () => {
    const request = ++generation.current;
    try {
      const res = await api.homeIam.getGuestPasses(homeId, { include_revoked: true });
      if (request !== generation.current) return;
      setPasses(res.passes || []);
      setListError('');
    } catch (err: unknown) {
      if (request !== generation.current) return;
      // An unavailable list is not an empty list; saying "no passes" here would
      // hide links that are still live for whoever holds them.
      setPasses([]);
      setListError(failureMessage(err, 'Guest passes could not be loaded. Retry to check the current links.'));
    }
    if (request === generation.current) setLoading(false);
  }, [homeId]);

  useEffect(() => {
    loadPasses();
    return () => { generation.current++; };
  }, [loadPasses]);

  const handleQuickCreate = (kind: GuestPass['kind']) => {
    setPreselectedKind(kind);
    setShowCreate(true);
  };

  const handleRevoke = async (passId: string) => {
    const yes = await confirmStore.open({ title: 'Revoke guest pass', description: 'The link will stop working immediately.', confirmLabel: 'Revoke', variant: 'destructive' });
    if (!yes) return;
    setRevokingId(passId);
    try {
      await api.homeIam.revokeGuestPass(homeId, passId);
      await loadPasses();
    } catch (err: unknown) {
      // This client rejects with a plain object, so `instanceof Error` would
      // discard the API's actual reason and its recovery code.
      toast.error(failureMessage(err, 'Failed to revoke'));
    }
    setRevokingId(null);
  };

  // A scheduled link still becomes usable, so it stays in the current list with
  // its own badge. Revoked, expired and reissue-required links never work again.
  const activePasses = passes.filter((p) => ['active', 'scheduled'].includes(passStatus(p)));
  const pastPasses = passes.filter((p) => !['active', 'scheduled'].includes(passStatus(p)));

  return (
    <div className="space-y-6">
      {/* Create Guest Pass SlidePanel */}
      <CreateGuestPass
        open={showCreate}
        onClose={() => { setShowCreate(false); setPreselectedKind(null); }}
        homeId={homeId}
        preselectedKind={preselectedKind}
        onIssued={() => { void loadPasses(); }}
        onCreated={() => { setShowCreate(false); setPreselectedKind(null); loadPasses(); }}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-app-text">Share & Guest Access</h2>
          <p className="text-xs text-app-text-secondary mt-0.5">Create shareable links for guests, vendors, and visitors</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition"
        >
          + Custom Pass
        </button>
      </div>

      {/* Quick Share Templates */}
      <div>
        <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Quick Share</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_TEMPLATES.map((tpl) => (
            <button
              key={tpl.kind}
              onClick={() => handleQuickCreate(tpl.kind)}
              className="bg-app-surface rounded-xl border border-app-border p-4 text-left hover:border-app-border hover:shadow-sm transition group"
            >
              <div className="text-2xl mb-2">{tpl.icon}</div>
              <div className="text-sm font-semibold text-app-text group-hover:text-app-text-strong">{tpl.label}</div>
              <div className="text-[10px] text-app-text-muted mt-0.5">{tpl.description}</div>
              <div className="text-[10px] text-gray-300 mt-1">{tpl.defaultHours}h default</div>
            </button>
          ))}
        </div>
      </div>

      {/* Active Passes */}
      <div>
        <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2">
          Active Passes {activePasses.length > 0 && <span className="text-app-text-muted">({activePasses.length})</span>}
        </h3>
        {loading ? (
          <div className="text-center py-6 text-app-text-muted text-sm">Loading passes...</div>
        ) : listError ? (
          <div className="bg-app-surface rounded-xl border border-app-border p-6 text-center">
            <div className="text-2xl mb-1">⚠️</div>
            <p className="text-xs text-app-text-muted">{listError}</p>
            <button
              onClick={() => { setLoading(true); loadPasses(); }}
              className="mt-3 px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition"
            >
              Retry
            </button>
          </div>
        ) : activePasses.length === 0 ? (
          <div className="bg-app-surface rounded-xl border border-app-border p-6 text-center">
            <div className="text-2xl mb-1">🔗</div>
            <p className="text-xs text-app-text-muted">No active guest passes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activePasses.map((pass) => (
              <GuestPassRow
                key={pass.id}
                pass={pass}
                onRevoke={() => handleRevoke(pass.id)}
                revoking={revokingId === pass.id}
                homeId={homeId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Past Passes (collapsed) */}
      {pastPasses.length > 0 && (
        <div>
          <button
            onClick={() => setShowPastPasses(!showPastPasses)}
            className="flex items-center gap-2 text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2 hover:text-app-text-strong transition"
          >
            <span className={`transform transition-transform ${showPastPasses ? 'rotate-90' : ''}`}>▶</span>
            Past Passes ({pastPasses.length})
          </button>
          {showPastPasses && (
            <div className="space-y-2">
              {pastPasses.map((pass) => (
                <GuestPassRow key={pass.id} pass={pass} homeId={homeId} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Guest Pass Row ----

function GuestPassRow({
  pass,
  onRevoke,
  revoking,
  homeId: _homeId,
}: {
  pass: GuestPass;
  onRevoke?: () => void;
  revoking?: boolean;
  homeId: string;
}) {
  const status = passStatus(pass);
  const badge = statusBadge(pass);
  const isActive = status === 'active';
  // A scheduled link is still live for whoever holds it, so it must stay revocable.
  const revocable = isActive || status === 'scheduled';

  return (
    <div className="bg-app-surface rounded-xl border border-app-border shadow-sm px-4 py-3 flex items-center gap-3">
      <span className="text-xl flex-shrink-0">{KIND_ICON[pass.kind] || '🔗'}</span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-app-text truncate">
            {pass.custom_title || pass.label || `${pass.kind} pass`}
          </span>
          <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 border ${badge.cls}`}>
            {badge.text}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-[10px] text-app-text-muted capitalize">{pass.kind.replace('_', ' ')}</span>
          {isActive && (
            <span className="text-[10px] text-app-text-muted">{timeRemaining(pass.end_at)}</span>
          )}
          {status === 'scheduled' && pass.start_at && (
            <span className="text-[10px] text-app-text-muted">
              Starts {new Date(pass.start_at).toLocaleString()}
            </span>
          )}
          <span className="text-[10px] text-app-text-muted">
            {pass.view_count} view{pass.view_count !== 1 ? 's' : ''}
            {pass.max_views ? ` / ${pass.max_views} max` : ''}
          </span>
          {pass.last_viewed_at && (
            <span className="text-[10px] text-gray-300">
              Last viewed {new Date(pass.last_viewed_at).toLocaleDateString()}
            </span>
          )}
        </div>
        {pass.included_sections && pass.included_sections.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {pass.included_sections.map((s) => (
              <span key={s} className="text-[9px] bg-app-surface-raised text-app-text-muted rounded px-1.5 py-0.5 capitalize">
                {s.replace('_', ' ')}
              </span>
            ))}
          </div>
        )}
      </div>

      {revocable && onRevoke && (
        <button
          onClick={onRevoke}
          disabled={revoking}
          className="text-[10px] text-app-text-muted hover:text-red-500 transition px-2 py-1 flex-shrink-0 disabled:opacity-50"
        >
          {revoking ? 'Revoking...' : 'Revoke'}
        </button>
      )}
    </div>
  );
}
