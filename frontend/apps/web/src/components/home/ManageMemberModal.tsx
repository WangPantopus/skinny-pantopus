'use client';

import { useState, useEffect } from 'react';
import UserIdentityLink from '@/components/user/UserIdentityLink';

// ============================================================
// Permission display groups for the toggle UI
// ============================================================

const PERMISSION_GROUPS = [
  {
    label: 'Home',
    permissions: [
      { key: 'home.view', label: 'View home info', icon: '🏠' },
      { key: 'home.edit', label: 'Edit home profile', icon: '✏️' },
    ],
  },
  {
    label: 'Members',
    permissions: [
      { key: 'members.view', label: 'View members', icon: '👥' },
      { key: 'members.manage', label: 'Manage members', icon: '⚙️' },
    ],
  },
  {
    label: 'Calendar & Tasks',
    permissions: [
      { key: 'calendar.view', label: 'View calendar', icon: '📅' },
      { key: 'calendar.edit', label: 'Edit calendar', icon: '📝' },
      { key: 'tasks.view', label: 'View tasks', icon: '📋' },
      { key: 'tasks.edit', label: 'Edit tasks', icon: '✅' },
      { key: 'tasks.manage', label: 'Manage tasks', icon: '🔧' },
    ],
  },
  {
    label: 'Maintenance',
    permissions: [
      { key: 'maintenance.view', label: 'View issues', icon: '🔍' },
      { key: 'maintenance.edit', label: 'Edit issues', icon: '🛠️' },
    ],
  },
  {
    label: 'Documents & Mailbox',
    permissions: [
      { key: 'docs.view', label: 'View docs', icon: '📄' },
      { key: 'docs.upload', label: 'Upload docs', icon: '📤' },
      { key: 'mailbox.view', label: 'View mailbox', icon: '📬' },
    ],
  },
  {
    label: 'Access & Security',
    permissions: [
      { key: 'access.view_wifi', label: 'View WiFi', icon: '📶' },
      { key: 'access.view_codes', label: 'View access codes', icon: '🔑' },
      { key: 'access.manage', label: 'Manage access', icon: '🔐' },
    ],
  },
  {
    label: 'Finance & Sensitive',
    permissions: [
      { key: 'finance.view', label: 'View finance', icon: '💰' },
      { key: 'finance.manage', label: 'Manage finance', icon: '💳' },
      { key: 'sensitive.view', label: 'View sensitive data', icon: '👁️' },
    ],
  },
];

// ============================================================
// Component
// ============================================================

export default function ManageMemberModal({
  open,
  onClose,
  member,
  homeId,
  isOwner,
  onUpdate,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  member: Record<string, any> | null;
  homeId: string;
  isOwner: boolean;
  onUpdate: () => void;
  onRemove: () => void;
}) {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [presets, setPresets] = useState<{ key: string; display_name: string; role_base?: string; [k: string]: unknown }[]>([]);
  const [roleBase, setRoleBase] = useState('member');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const memberName = member?.user?.name || member?.user?.username || member?.name || 'Member';
  const isTargetOwner = member?.role === 'owner' || member?.role_base === 'owner';

  // Load member's permissions + presets
  useEffect(() => {
    if (!open || !member) return;
    setError('');
    setConfirmRemove(false);
    setShowAdvanced(false);

    (async () => {
      setLoading(true);
      try {
        const { get } = await import('@pantopus/api');
        const [permsRes, presetsRes] = await Promise.allSettled([
          get(`/api/homes/${homeId}/members/${member.user_id}/permissions`),
          get(`/api/homes/${homeId}/role-presets`),
        ]);

        if (permsRes.status === 'fulfilled') {
          const data = permsRes.value as Record<string, any>;
          setPermissions(data.permissions || []);
          setRoleBase(data.role_base || member.role_base || 'member');
        }

        if (presetsRes.status === 'fulfilled') {
          setPresets((presetsRes.value as Record<string, any>).presets as { key: string; display_name: string; role_base?: string; [k: string]: unknown }[] || []);
        }
      } catch {
        setError('Failed to load member details');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, member, homeId]);

	  const handleApplyPreset = async (presetKey: string) => {
	    if (!member) return;
	    const memberUserId = member.user_id;
	    setSaving(true);
	    setError('');
	    try {
	      const { post } = await import('@pantopus/api');
	      await post(`/api/homes/${homeId}/members/${memberUserId}/role`, { preset_key: presetKey });

	      // Reload permissions
	      const { get } = await import('@pantopus/api');
	      const data = await get(`/api/homes/${homeId}/members/${memberUserId}/permissions`) as Record<string, any>;
      setPermissions(data.permissions || []);
      setRoleBase(data.role_base || 'member');
      onUpdate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to apply preset');
    } finally {
      setSaving(false);
    }
  };

	  const handleTogglePermission = async (permission: string, allowed: boolean) => {
	    if (!member) return;
	    const memberUserId = member.user_id;
	    setSaving(true);
	    setError('');
	    try {
	      const { post } = await import('@pantopus/api');
	      await post(`/api/homes/${homeId}/members/${memberUserId}/permissions`, { permission, allowed });

      // Update local state
      if (allowed) {
        setPermissions(prev => [...new Set([...prev, permission])]);
      } else {
        setPermissions(prev => prev.filter(p => p !== permission));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update permission');
    } finally {
      setSaving(false);
    }
  };

	  const handleRemove = async () => {
	    if (!member) return;
	    const memberUserId = member.user_id;
	    setSaving(true);
	    setError('');
	    try {
	      const { del } = await import('@pantopus/api');
	      await del(`/api/homes/${homeId}/members/${memberUserId}`);
      onRemove();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !member) return null;

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
        <div
          className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-app-border-subtle">
            <div className="flex items-center justify-between">
              <div>
                <UserIdentityLink
                  userId={member?.user_id || member?.user?.id}
                  username={member?.user?.username}
                  displayName={memberName}
                  avatarUrl={member?.user?.profile_picture_url}
                  textClassName="text-lg font-semibold text-app-text hover:text-primary-600"
                />
                <p className="text-xs text-app-text-secondary mt-0.5">
                  Role: <span className="font-medium">{roleBase?.replace('_', ' ')}</span>
                  {member.end_at && (
                    <span className="ml-2 text-orange-600">
                      expires {new Date(member.end_at).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-app-hover rounded-lg transition text-app-text-secondary"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">{error}</div>
            )}

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-app-border border-t-gray-700 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Quick preset buttons (only if not owner) */}
                {isOwner && !isTargetOwner && (
                  <div>
                    <label className="block text-sm font-medium text-app-text-strong mb-2">Quick role change</label>
                    <div className="grid grid-cols-2 gap-2">
                      {presets.slice(0, 6).map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          disabled={saving}
                          onClick={() => handleApplyPreset(p.key)}
                          className={`text-left px-3 py-2 rounded-lg border transition text-sm ${
                            roleBase === p.role_base
                              ? 'bg-app-surface-sunken border-app-border'
                              : 'bg-app-surface border-app-border hover:border-app-border'
                          } disabled:opacity-50`}
                        >
                          <div className="font-medium text-xs">{p.display_name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Advanced: per-permission toggles */}
                {isOwner && !isTargetOwner && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {showAdvanced ? '— Hide' : '+ Show'} advanced permissions
                    </button>

                    {showAdvanced && (
                      <div className="mt-3 space-y-4">
                        {PERMISSION_GROUPS.map((group) => (
                          <div key={group.label}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted mb-1.5">
                              {group.label}
                            </p>
                            <div className="space-y-1">
                              {group.permissions.map((perm) => {
                                const hasIt = permissions.includes(perm.key);
                                return (
                                  <label
                                    key={perm.key}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-app-hover cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={hasIt}
                                      onChange={() => handleTogglePermission(perm.key, !hasIt)}
                                      disabled={saving}
                                      className="w-4 h-4 rounded border-app-border text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-xs">{perm.icon}</span>
                                    <span className="text-sm text-app-text-strong">{perm.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Permissions summary (read-only if not owner) */}
                {!isOwner && (
                  <div>
                    <label className="block text-sm font-medium text-app-text-strong mb-2">Permissions</label>
                    <div className="flex flex-wrap gap-1.5">
                      {permissions.map((p) => (
                        <span
                          key={p}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-app-surface-sunken text-app-text-secondary border border-app-border"
                        >
                          {p}
                        </span>
                      ))}
                      {permissions.length === 0 && (
                        <span className="text-xs text-app-text-muted">No permissions</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Remove member */}
                {isOwner && !isTargetOwner && (
                  <div className="pt-3 border-t border-app-border-subtle">
                    {!confirmRemove ? (
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(true)}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Remove from home
                      </button>
                    ) : (
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-red-600">Remove {memberName}?</p>
                        <button
                          type="button"
                          onClick={handleRemove}
                          disabled={saving}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          {saving ? 'Removing...' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(false)}
                          className="px-3 py-1.5 border border-app-border text-app-text-secondary text-xs font-medium rounded-lg hover:bg-app-hover"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
