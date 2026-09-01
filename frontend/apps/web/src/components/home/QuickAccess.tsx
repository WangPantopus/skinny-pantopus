'use client';

import { useState, useCallback } from 'react';
import * as api from '@pantopus/api';
import type { HomeAccessSecret } from '@pantopus/types';
import { AccessIcons } from '@/lib/icons';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { toast } from '@/components/ui/toast-store';

/* ── type / label maps ─────────────────────────────────────────── */
const ACCESS_TYPES: readonly { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'wifi',      label: 'WiFi',        icon: AccessIcons.wifi },
  { value: 'door_code', label: 'Door Code',   icon: AccessIcons.door_code },
  { value: 'gate_code', label: 'Gate Code',   icon: AccessIcons.gate_code },
  { value: 'lockbox',   label: 'Lockbox',     icon: AccessIcons.lockbox },
  { value: 'garage',    label: 'Garage',      icon: AccessIcons.garage },
  { value: 'alarm',     label: 'Alarm',       icon: AccessIcons.alarm },
  { value: 'other',     label: 'Other',       icon: AccessIcons.other },
];

const VISIBILITY_OPTIONS = [
  { value: 'public',    label: 'Public (guests)',  color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'members',   label: 'Members',          color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'managers',  label: 'Managers only',     color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'sensitive', label: 'Sensitive',         color: 'bg-red-50 text-red-700 border-red-200' },
] as const;

function typeIcon(t: string): LucideIcon { return ACCESS_TYPES.find(a => a.value === t)?.icon ?? AccessIcons.key; }
function typeLabel(t: string) { return ACCESS_TYPES.find(a => a.value === t)?.label ?? t; }
function visBadge(v: string) { return VISIBILITY_OPTIONS.find(o => o.value === v) ?? VISIBILITY_OPTIONS[1]; }

type AccessSecretFormData = {
  id?: string;
  access_type: string;
  label: string;
  secret_value: string;
  notes?: string;
  visibility?: string;
};

/* ── component ─────────────────────────────────────────────────── */
export default function QuickAccess({
  home,
  secrets,
  emergencies,
  homeId,
  canManageAccess = false,
  onSecretsChange,
}: {
  home: Record<string, any>;
  secrets?: HomeAccessSecret[];
  emergencies?: Record<string, any>[];
  homeId?: string;
  canManageAccess?: boolean;
  onSecretsChange?: (secrets: HomeAccessSecret[]) => void;
}) {
  /* ── view toggle: "family" = all data, "guest" = public-only ── */
  const [viewMode, setViewMode] = useState<'family' | 'guest'>('family');

  /* ── accordion states ── */
  const [showCodes, setShowCodes] = useState(true);
  const [showEmergency, setShowEmergency] = useState(false);

  /* ── CRUD state ── */
  const [editingSecret, setEditingSecret] = useState<HomeAccessSecret | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const hid = homeId || home?.id;

  /* ── filter data by viewMode ── */
  const allSecrets = secrets || [];
  const visibleSecrets = viewMode === 'guest'
    ? allSecrets.filter(s => s.visibility === 'public')
    : allSecrets;

  const visibleEmergencies = viewMode === 'guest'
    ? []
    : (emergencies || []);

  const showEntry = home?.entry_instructions && (viewMode === 'family' || home?.entry_visibility !== 'private');
  const showParking = home?.parking_instructions && (viewMode === 'family' || home?.parking_visibility !== 'private');

  /* ── clipboard ── */
  const copyValue = useCallback((id: string, value: string) => {
    navigator.clipboard?.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  /* ── save (create or update) ── */
  const handleSave = async (formData: AccessSecretFormData) => {
    if (!hid) return;
    setSaving(true);
    try {
      if (formData.id) {
        const { id, ...updates } = formData;
        await api.homeProfile.updateHomeAccessSecret(hid, id, updates);
      } else {
        await api.homeProfile.createHomeAccessSecret(hid, formData);
      }
      const res = await api.homeProfile.getHomeAccessSecrets(hid);
      onSecretsChange?.(res.secrets || []);
      setEditingSecret(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  /* ── delete ── */
  const handleDelete = async (secretId: string) => {
    if (!hid) return;
    setSaving(true);
    try {
      await api.homeProfile.deleteHomeAccessSecret(hid, secretId);
      const res = await api.homeProfile.getHomeAccessSecrets(hid);
      onSecretsChange?.(res.secrets || []);
      setConfirmDelete(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-app-surface rounded-xl border border-app-border shadow-sm">
      {/* ── Header with View Toggle ── */}
      <div className="px-4 py-3.5 border-b border-app-border-subtle">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-base font-semibold text-app-text">Quick Access</h3>
        </div>
        {/* Public / Private toggle */}
        <div className="flex bg-app-surface-sunken rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('family')}
            className={`flex-1 text-xs font-medium py-1.5 px-2.5 rounded-md transition-all ${
              viewMode === 'family'
                ? 'bg-app-surface text-app-text shadow-sm'
                : 'text-app-text-secondary hover:text-app-text-strong'
            }`}
          >
            <AccessIcons.familyView className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" /> Family View
          </button>
          <button
            onClick={() => setViewMode('guest')}
            className={`flex-1 text-xs font-medium py-1.5 px-2.5 rounded-md transition-all ${
              viewMode === 'guest'
                ? 'bg-app-surface text-app-text shadow-sm'
                : 'text-app-text-secondary hover:text-app-text-strong'
            }`}
          >
            <AccessIcons.guestView className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" /> Guest View
          </button>
        </div>
        {viewMode === 'guest' && (
          <p className="text-[10px] text-amber-600 mt-1.5 leading-tight">
            Showing only info visible to guests &amp; service providers
          </p>
        )}
      </div>

      <div className="divide-y divide-app-border-subtle">
        {/* ── Entry Instructions ── */}
        {showEntry && (
          <InfoRow icon={AccessIcons.entry} title="Entry" text={home.entry_instructions} />
        )}

        {/* ── Parking ── */}
        {showParking && (
          <InfoRow icon={AccessIcons.parking} title="Parking" text={home.parking_instructions} />
        )}

        {/* ── Access Codes Section ── */}
        <div className="px-4 py-3">
          <button
            onClick={() => setShowCodes(!showCodes)}
            className="flex items-center gap-2.5 w-full text-left"
          >
            <AccessIcons.key className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-semibold text-app-text flex-1">
              Access Codes
              <span className="text-app-text-muted font-normal ml-1">({visibleSecrets.length})</span>
            </span>
            <ChevronIcon open={showCodes} />
          </button>

          {showCodes && (
            <div className="mt-3 space-y-2">
              {visibleSecrets.length === 0 && (
                <p className="text-xs text-app-text-muted text-center py-3">
                  {viewMode === 'guest' ? 'No codes shared with guests' : 'No access codes yet'}
                </p>
              )}

              {visibleSecrets.map((s) => (
                <div key={s.id || `${s.access_type}-${s.label}`} className="border border-app-border-subtle rounded-lg p-2.5 bg-app-surface-raised/70 group">
                  <div className="flex items-start gap-2">
                    {(() => { const TypeIcon = typeIcon(s.access_type); return <TypeIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-app-text-secondary" />; })()}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-app-text">
                          {typeLabel(s.access_type)}
                        </span>
                        {s.label && s.label !== typeLabel(s.access_type) && (
                          <span className="text-[10px] text-app-text-muted">— {s.label}</span>
                        )}
                      </div>

                      {/* Secret value with copy */}
                      <div className="flex items-center gap-1.5 mt-1">
                        <code className="text-xs font-mono text-app-text bg-app-surface border border-app-border px-2 py-0.5 rounded break-all flex-1">
                          {s.secret_value}
                        </code>
	                        <button
	                          onClick={() => copyValue(String(s.id || s.label), s.secret_value || '')}
	                          className="text-app-text-muted hover:text-app-text-secondary flex-shrink-0"
	                          title="Copy to clipboard"
	                        >
	                          {copiedId === String(s.id || s.label) ? (
                            <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </div>

                      {/* Notes */}
                      {s.notes && (
                        <p className="text-[10px] text-app-text-muted mt-1 leading-tight">{s.notes}</p>
                      )}

                      {/* Visibility badge + actions */}
                      <div className="flex items-center justify-between mt-1.5">
	                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${visBadge(s.visibility || 'members').color}`}>
	                          {visBadge(s.visibility || 'members').label}
                        </span>
                        {canManageAccess && viewMode === 'family' && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditingSecret(s)}
                              className="text-[10px] text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Edit
                            </button>
	                            {confirmDelete === String(s.id || '') ? (
	                              <span className="flex items-center gap-1">
	                                <button
	                                  onClick={() => { if (s.id) handleDelete(s.id); }}
                                  disabled={saving}
                                  className="text-[10px] text-red-600 hover:text-red-700 font-medium"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="text-[10px] text-app-text-muted hover:text-app-text-secondary font-medium"
                                >
                                  Cancel
                                </button>
                              </span>
	                            ) : (
	                              <button
	                                onClick={() => setConfirmDelete(String(s.id || ''))}
                                className="text-[10px] text-red-500 hover:text-red-600 font-medium"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add button */}
              {canManageAccess && viewMode === 'family' && !editingSecret && (
                <button
                  onClick={() => setEditingSecret({
                    access_type: 'wifi',
                    label: '',
                    secret_value: '',
                    notes: '',
                    visibility: 'members',
                  })}
                  className="w-full py-2 text-xs font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg border border-dashed border-app-border transition-colors"
                >
                  + Add Access Code
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Emergency Info (family-only) ── */}
        {visibleEmergencies.length > 0 && (
          <div className="px-4 py-3">
            <button
              onClick={() => setShowEmergency(!showEmergency)}
              className="flex items-center gap-2.5 w-full text-left"
            >
              <AccessIcons.emergency className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-semibold text-app-text flex-1">
                Emergency Info
              </span>
              <ChevronIcon open={showEmergency} />
            </button>
            {showEmergency && (
              <div className="ml-7 mt-2.5 space-y-1.5">
                {visibleEmergencies.map((e) => (
                  <div key={e.id} className="text-xs text-app-text-secondary">
                    <span className="font-medium text-app-text">{e.info_type}:</span>{' '}
                    {e.details}
                    {e.location_in_home && (
                      <span className="text-app-text-muted"> — {e.location_in_home}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Home Details ── */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2.5 mb-2">
            <AccessIcons.home className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-semibold text-app-text">Details</span>
          </div>
          <div className="ml-7 grid grid-cols-2 gap-x-4 gap-y-1">
            {home?.home_type && <Detail label="Type" value={home.home_type} />}
            {home?.bedrooms && <Detail label="Bedrooms" value={home.bedrooms} />}
            {home?.bathrooms && <Detail label="Bathrooms" value={home.bathrooms} />}
            {home?.sq_ft && <Detail label="Sq Ft" value={Number(home.sq_ft).toLocaleString()} />}
            {home?.year_built && <Detail label="Year Built" value={home.year_built} />}
          </div>
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {editingSecret && (
        <AccessCodeForm
          initial={editingSecret}
          saving={saving}
          onSave={handleSave}
          onCancel={() => setEditingSecret(null)}
        />
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function InfoRow({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="px-4 py-3 flex items-start gap-2.5">
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0 text-app-text-secondary" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-app-text">{title}</div>
        <div className="text-xs text-app-text-secondary mt-0.5 leading-relaxed">{text}</div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-xs">
      <span className="text-app-text-muted">{label}: </span>
      <span className="text-app-text-strong font-medium capitalize">{value}</span>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <ChevronDown className={`w-4 h-4 text-app-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
  );
}

/* ── Add / Edit inline form (modal overlay) ── */
function AccessCodeForm({
  initial,
  saving,
  onSave,
  onCancel,
}: {
	  initial: Partial<HomeAccessSecret>;
	  saving: boolean;
	  onSave: (data: AccessSecretFormData) => void;
  onCancel: () => void;
}) {
  const isEdit = !!initial.id;
  const [form, setForm] = useState({
    access_type: initial.access_type || 'wifi',
    label: initial.label || '',
    secret_value: initial.secret_value || '',
    notes: initial.notes || '',
    visibility: initial.visibility || 'members',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim() || !form.secret_value.trim()) return;
    onSave(isEdit ? { id: initial.id, ...form } : form);
  };

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30" onClick={onCancel}>
      <div className="bg-app-surface w-full max-w-sm rounded-t-xl sm:rounded-xl shadow-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 border-b border-app-border-subtle flex items-center justify-between">
            <h3 className="text-sm font-semibold text-app-text">
              {isEdit ? 'Edit Access Code' : 'Add Access Code'}
            </h3>
            <button type="button" onClick={onCancel} className="text-app-text-muted hover:text-app-text-secondary">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-5 py-4 space-y-3.5">
            {/* Type picker */}
            <div>
              <label className="block text-xs font-medium text-app-text-strong mb-1.5">Type</label>
              <div className="grid grid-cols-4 gap-1.5">
                {ACCESS_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      set('access_type', t.value);
                      if (!form.label) set('label', t.label);
                    }}
                    className={`text-center py-2 px-1 rounded-lg border text-xs transition-all ${
                      form.access_type === t.value
                        ? 'border-teal-500 bg-teal-50 text-teal-700 font-medium'
                        : 'border-app-border text-app-text-secondary hover:border-app-border'
                    }`}
                  >
                    <t.icon className="w-5 h-5 mx-auto mb-0.5" />
                    <div className="leading-tight">{t.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Label */}
            <div>
              <label className="block text-xs font-medium text-app-text-strong mb-1">Label</label>
              <input
                type="text"
                value={form.label}
                onChange={e => set('label', e.target.value)}
                placeholder="e.g. Front door, Guest WiFi, Side gate"
                className="w-full text-sm border border-app-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                required
              />
            </div>

            {/* Secret value */}
            <div>
              <label className="block text-xs font-medium text-app-text-strong mb-1">Code / Password</label>
              <input
                type="text"
                value={form.secret_value}
                onChange={e => set('secret_value', e.target.value)}
                placeholder="e.g. 1234, MyWiFiPassword"
                className="w-full text-sm font-mono border border-app-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-app-text-strong mb-1">
                Notes <span className="text-app-text-muted font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="e.g. 2.4GHz network, code expires monthly"
                className="w-full text-sm border border-app-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              />
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-xs font-medium text-app-text-strong mb-1.5">Who can see this?</label>
              <div className="grid grid-cols-2 gap-1.5">
                {VISIBILITY_OPTIONS.map(v => (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => set('visibility', v.value)}
                    className={`text-xs py-2 px-2.5 rounded-lg border text-left transition-all ${
                      form.visibility === v.value
                        ? `${v.color} font-medium`
                        : 'border-app-border text-app-text-secondary hover:border-app-border'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-5 py-3.5 border-t border-app-border-subtle flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 text-sm font-medium py-2 rounded-lg border border-app-border text-app-text-strong hover:bg-app-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.label.trim() || !form.secret_value.trim()}
              className="flex-1 text-sm font-medium py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Add Code'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
