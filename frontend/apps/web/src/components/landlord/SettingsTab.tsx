'use client';

/**
 * SettingsTab — Property management settings.
 * Approval policy, required verification, staff delegation.
 */

import { useEffect, useState, useCallback } from 'react';
import * as api from '@pantopus/api';
import type { landlord } from '@pantopus/api';

type Props = {
  homeId: string;
};

const VERIFICATION_METHODS = [
  { value: null, label: 'None required' },
  { value: 'mail_code', label: 'Mail verification code' },
  { value: 'landlord_invite', label: 'Landlord invite only' },
  { value: 'doc_upload', label: 'Document upload' },
];

const STAFF_PERMISSIONS = [
  { key: 'manage_units', label: 'Manage Units', description: 'Add, edit, and remove units' },
  { key: 'manage_leases', label: 'Manage Leases', description: 'Approve, deny, and end leases' },
  { key: 'send_notices', label: 'Send Notices', description: 'Send official notices to tenants' },
  { key: 'view_tenants', label: 'View Tenants', description: 'See tenant details and history' },
  { key: 'manage_settings', label: 'Manage Settings', description: 'Change property settings' },
];

// ── Toggle ──────────────────────────────────────────────────

function Toggle({
  enabled,
  onChange,
  label,
  description,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-app-text">{label}</p>
        <p className="text-xs text-app-text-secondary mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
          enabled ? 'bg-primary-500' : 'bg-app-surface-sunken'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-app-surface transition-transform shadow ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    </div>
  );
}

// ── Add staff modal ─────────────────────────────────────────

function AddStaffModal({
  homeId,
  onClose,
  onSuccess,
}: {
  homeId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('office_admin');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    'view_tenants', 'send_notices',
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const togglePermission = (key: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  };

  const handleAdd = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.landlord.addStaff(homeId, {
        email: email.trim(),
        role,
        permissions: selectedPermissions,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add staff member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-app-surface rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-app-text mb-1">Add Staff Member</h3>
        <p className="text-sm text-app-text-secondary mb-4">Grant access to help manage this property.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@example.com"
              className="w-full px-4 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-app-surface"
            >
              <option value="office_admin">Office Admin</option>
              <option value="maintenance_staff">Maintenance Staff</option>
              <option value="leasing_agent">Leasing Agent</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-2">Permissions</label>
            <div className="space-y-2">
              {STAFF_PERMISSIONS.map((perm) => (
                <label key={perm.key} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(perm.key)}
                    onChange={() => togglePermission(perm.key)}
                    className="mt-0.5 h-4 w-4 rounded border-app-border text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm text-app-text">{perm.label}</p>
                    <p className="text-xs text-app-text-secondary">{perm.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-app-text-secondary hover:text-app-text">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!email.trim() || loading}
            className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-black transition-colors disabled:opacity-40"
          >
            {loading ? 'Adding...' : 'Add Staff'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────

export default function SettingsTab({ homeId }: Props) {
  const [settings, setSettings] = useState<landlord.PropertySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.landlord.getPropertySettings(homeId);
      setSettings(res.settings);
    } catch {
      // Default settings if endpoint not deployed
      setSettings({
        auto_approve_invites: false,
        required_verification_method: null,
        staff: [],
      });
    } finally {
      setLoading(false);
    }
  }, [homeId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSetting = useCallback(async (updates: Partial<{ auto_approve_invites: boolean; required_verification_method: string | null }>) => {
    setSaving(true);
    try {
      const res = await api.landlord.updatePropertySettings(homeId, updates);
      setSettings(res.settings);
    } catch (err: unknown) {
      console.error('Settings update failed:', err);
    } finally {
      setSaving(false);
    }
  }, [homeId]);

  const handleRemoveStaff = useCallback(async (staffId: string) => {
    try {
      await api.landlord.removeStaff(homeId, staffId);
      loadSettings();
    } catch (err: unknown) {
      console.error('Remove staff failed:', err);
    }
  }, [homeId, loadSettings]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-app-border border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* Approval Policy */}
      <div className="rounded-xl border border-app-border bg-app-surface p-5">
        <h4 className="font-semibold text-app-text mb-1">Approval Policy</h4>
        <p className="text-xs text-app-text-secondary mb-3">Control how tenant invites and requests are handled.</p>

        <Toggle
          enabled={settings.auto_approve_invites}
          onChange={(v) => updateSetting({ auto_approve_invites: v })}
          label="Auto-approve invites"
          description="When enabled, tenants who accept an invite are automatically granted access without manual approval."
        />
      </div>

      {/* Required Verification */}
      <div className="rounded-xl border border-app-border bg-app-surface p-5">
        <h4 className="font-semibold text-app-text mb-1">Required Tenant Verification</h4>
        <p className="text-xs text-app-text-secondary mb-3">Set the minimum verification method tenants must complete.</p>

        <div className="space-y-2">
          {VERIFICATION_METHODS.map((method) => (
            <label
              key={method.value ?? 'none'}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                settings.required_verification_method === method.value
                  ? 'border-primary-300 bg-primary-50/50'
                  : 'border-app-border hover:border-app-border'
              }`}
            >
              <input
                type="radio"
                name="verification_method"
                checked={settings.required_verification_method === method.value}
                onChange={() => updateSetting({ required_verification_method: method.value })}
                className="h-4 w-4 border-app-border text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-app-text">{method.label}</span>
            </label>
          ))}
        </div>
        {saving && <p className="mt-2 text-xs text-app-text-muted">Saving...</p>}
      </div>

      {/* Staff Delegation */}
      <div className="rounded-xl border border-app-border bg-app-surface p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-semibold text-app-text">Staff Members</h4>
            <p className="text-xs text-app-text-secondary mt-0.5">Add office admins with explicit permissions.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddStaff(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Staff
          </button>
        </div>

        {settings.staff.length === 0 ? (
          <p className="text-sm text-app-text-secondary py-4 text-center">
            No staff members added. You&apos;re the only one managing this property.
          </p>
        ) : (
          <div className="divide-y divide-app-border-subtle">
            {settings.staff.map((member) => (
              <div key={member.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-app-text">{member.name}</p>
                  <p className="text-xs text-app-text-secondary">{member.email}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {member.permissions.map((p) => (
                      <span key={p} className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-app-surface-sunken text-app-text-secondary capitalize">
                        {p.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveStaff(member.id)}
                  className="px-2.5 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add staff modal */}
      {showAddStaff && (
        <AddStaffModal
          homeId={homeId}
          onClose={() => setShowAddStaff(false)}
          onSuccess={loadSettings}
        />
      )}
    </div>
  );
}
