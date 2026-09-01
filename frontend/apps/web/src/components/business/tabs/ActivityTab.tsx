'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, UserMinus, LogOut, ArrowLeftRight, ShieldCheck, PenLine,
  MapPin, PlusCircle, Trash2, Tag, Globe, EyeOff, Clock, AlertCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import * as api from '@pantopus/api';
import type { BusinessAuditEntry } from '@pantopus/api';
import { formatTimeAgo } from '@pantopus/ui-utils';

const PAGE_SIZE = 30;

const ACTION_META: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  invite_member:     { icon: UserPlus,        color: '#0284c7', label: 'Invited a member' },
  remove_member:     { icon: UserMinus,       color: '#dc2626', label: 'Removed a member' },
  self_leave:        { icon: LogOut,           color: '#ca8a04', label: 'Left the team' },
  change_role:       { icon: ArrowLeftRight,   color: '#7c3aed', label: 'Changed a role' },
  apply_role_preset: { icon: ShieldCheck,      color: '#0284c7', label: 'Applied a role preset' },
  toggle_permission: { icon: ShieldCheck,      color: '#ea580c', label: 'Changed a permission' },
  update_profile:    { icon: PenLine,          color: '#0284c7', label: 'Updated profile' },
  update_location:   { icon: MapPin,           color: '#16a34a', label: 'Updated location' },
  create_location:   { icon: PlusCircle,       color: '#16a34a', label: 'Added a location' },
  delete_location:   { icon: Trash2,           color: '#dc2626', label: 'Deleted a location' },
  create_catalog:    { icon: Tag,              color: '#16a34a', label: 'Added catalog item' },
  update_catalog:    { icon: Tag,              color: '#0284c7', label: 'Updated catalog item' },
  delete_catalog:    { icon: Trash2,           color: '#dc2626', label: 'Deleted catalog item' },
  publish:           { icon: Globe,            color: '#16a34a', label: 'Published' },
  unpublish:         { icon: EyeOff,           color: '#ca8a04', label: 'Unpublished' },
};

const DEFAULT_META = { icon: Clock, color: '#6b7280', label: 'Action' };

function formatDesc(entry: BusinessAuditEntry): string {
  const meta = ACTION_META[entry.action];
  const base = meta?.label || entry.action.replace(/_/g, ' ');
  const md = (entry as any).metadata || {};
  if (entry.action === 'invite_member' && md.role_base) return `${base} as ${md.role_base}`;
  if (entry.action === 'change_role' && md.new_role_base) return `Changed role to ${md.new_role_base}`;
  if (entry.action === 'apply_role_preset' && md.preset_key) return `Applied preset "${md.preset_key}"`;
  if (entry.action === 'toggle_permission' && md.permission) return `${md.allowed ? 'Granted' : 'Denied'} ${md.permission}`;
  return base;
}

function EntryRow({ entry }: { entry: BusinessAuditEntry }) {
  const meta = ACTION_META[entry.action] || DEFAULT_META;
  const Icon = meta.icon;
  const actor = (entry as any).actor;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-app-border-subtle last:border-0">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: meta.color + '18' }}>
        <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {actor?.profile_picture_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={actor.profile_picture_url} alt="" className="w-4.5 h-4.5 rounded-full" />
          ) : (
            <div className="w-4.5 h-4.5 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-[9px] font-bold text-blue-600">{(actor?.name || '?').charAt(0).toUpperCase()}</span>
            </div>
          )}
          <span className="text-sm font-semibold text-app-text truncate">{actor?.name || actor?.username || 'Unknown'}</span>
        </div>
        <p className="text-sm text-app-text-secondary">{formatDesc(entry)}</p>
        <p className="text-xs text-app-text-muted mt-0.5">{formatTimeAgo(entry.created_at)}</p>
      </div>
    </div>
  );
}

export default function ActivityTab({ businessId }: { businessId: string }) {
  const [entries, setEntries] = useState<BusinessAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (offset = 0) => {
    if (offset === 0) { setLoading(true); setError(null); } else { setLoadingMore(true); }
    try {
      const result = await api.businessIam.getAuditLog(businessId, { limit: PAGE_SIZE, offset });
      const newEntries = result.entries || [];
      setEntries(prev => offset === 0 ? newEntries : [...prev, ...newEntries]);
      setHasMore(newEntries.length >= PAGE_SIZE);
    } catch (e: any) {
      setError(e?.message || 'Failed to load activity');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [businessId]);

  useEffect(() => { load(0); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-app-text">Activity</h2>
        <button onClick={() => load(0)} disabled={loading} className="text-xs text-violet-600 font-medium hover:underline disabled:opacity-50">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin h-8 w-8 border-3 border-violet-600 border-t-transparent rounded-full" /></div>
      ) : error ? (
        <div className="text-center py-16">
          <AlertCircle className="w-10 h-10 mx-auto text-red-500 mb-3" />
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={() => load(0)} className="text-sm text-violet-600 font-medium mt-3 hover:underline">Retry</button>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="w-12 h-12 mx-auto text-app-text-muted mb-3" />
          <p className="text-sm font-medium text-app-text-secondary">No activity yet</p>
          <p className="text-xs text-app-text-muted mt-1">Team actions will appear here</p>
        </div>
      ) : (
        <div className="bg-app-surface border border-app-border rounded-xl p-4">
          {entries.map(entry => <EntryRow key={entry.id} entry={entry} />)}

          {hasMore && (
            <button onClick={() => load(entries.length)} disabled={loadingMore}
              className="w-full py-3 text-sm text-violet-600 font-medium hover:underline disabled:opacity-50 mt-2">
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
