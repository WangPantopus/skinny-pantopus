'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import * as api from '@pantopus/api';
import SlidePanel from '../SlidePanel';
import UserIdentityLink from '@/components/user/UserIdentityLink';

// ---- Permission display groups ----

const PERMISSION_GROUPS = [
  {
    label: 'Home',
    permissions: [
      { key: 'home.view', label: 'View home info' },
      { key: 'home.edit', label: 'Edit home profile' },
    ],
  },
  {
    label: 'Members',
    permissions: [
      { key: 'members.view', label: 'View members' },
      { key: 'members.manage', label: 'Manage members' },
    ],
  },
  {
    label: 'Calendar & Tasks',
    permissions: [
      { key: 'calendar.view', label: 'View calendar' },
      { key: 'calendar.edit', label: 'Edit calendar' },
      { key: 'tasks.view', label: 'View tasks' },
      { key: 'tasks.edit', label: 'Edit tasks' },
      { key: 'tasks.manage', label: 'Manage tasks' },
    ],
  },
  {
    label: 'Maintenance',
    permissions: [
      { key: 'maintenance.view', label: 'View issues' },
      { key: 'maintenance.edit', label: 'Edit issues' },
    ],
  },
  {
    label: 'Documents & Mailbox',
    permissions: [
      { key: 'docs.view', label: 'View docs' },
      { key: 'docs.upload', label: 'Upload docs' },
      { key: 'mailbox.view', label: 'View mailbox' },
    ],
  },
  {
    label: 'Access & Security',
    permissions: [
      { key: 'access.view_wifi', label: 'View WiFi' },
      { key: 'access.view_codes', label: 'View access codes' },
      { key: 'access.manage', label: 'Manage access' },
    ],
  },
  {
    label: 'Finance & Sensitive',
    permissions: [
      { key: 'finance.view', label: 'View finance' },
      { key: 'finance.manage', label: 'Manage finance' },
      { key: 'sensitive.view', label: 'View sensitive data' },
    ],
  },
];

const ROLE_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  owner:             { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: '👑', label: 'Owner' },
  admin:             { color: 'bg-purple-50 text-purple-700 border-purple-200', icon: '🛡️', label: 'Admin' },
  manager:           { color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: '🔧', label: 'Manager' },
  member:            { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: '🏠', label: 'Member' },
  restricted_member: { color: 'bg-pink-50 text-pink-700 border-pink-200', icon: '👶', label: 'Restricted' },
  guest:             { color: 'bg-app-surface-raised text-app-text-secondary border-app-border', icon: '🎟️', label: 'Guest' },
};

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', description: 'Full control over home settings and members' },
  { value: 'manager', label: 'Manager', description: 'Manage tasks, issues, bills. No member control' },
  { value: 'member', label: 'Member', description: 'View and contribute to home life' },
  { value: 'restricted_member', label: 'Restricted', description: 'Limited access (chores, basic info)' },
  { value: 'guest', label: 'Guest', description: 'Read-only access to shared info' },
];

interface MemberData {
  user_id: string;
  role?: string;
  role_base?: string;
  name?: string | null;
  created_at?: string;
  start_at?: string | null;
  end_at?: string | null;
  user?: {
    id?: string;
    name?: string;
    username?: string;
    profile_picture_url?: string | null;
    avatar_url?: string;
  };
}

export default function MemberDetail({
  open,
  onClose,
  member,
  homeId,
  isOwner,
  onUpdate,
  onRemoved,
}: {
  open: boolean;
  onClose: () => void;
  member: MemberData | null;
  homeId: string;
  isOwner: boolean;
  members: MemberData[];
  onUpdate: () => void;
  onRemoved: () => void;
}) {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roleBase, setRoleBase] = useState('member');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferConfirmText, setTransferConfirmText] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const memberName = member?.user?.name || member?.user?.username || member?.name || 'Member';
  const memberUsername = member?.user?.username;
  const profilePic = member?.user?.profile_picture_url || member?.user?.avatar_url;
  const isTargetOwner = member?.role === 'owner' || member?.role_base === 'owner';
  const joinedDate = member?.created_at || member?.start_at;

  // Load member permissions
  useEffect(() => {
    if (!open || !member) return;
    setError('');
    setConfirmRemove(false);
    setShowAdvanced(false);
    setShowTransfer(false);
    setTransferConfirmText('');

    (async () => {
      setLoading(true);
      try {
        const res = await api.homeIam.getMemberPermissions(homeId, member.user_id);
        setPermissions(res.permissions || []);
        setRoleBase(res.role_base || member.role_base || 'member');
      } catch {
        setPermissions([]);
        setRoleBase(member?.role_base || 'member');
      }
      setExpiryDate(member?.end_at?.split('T')[0] || '');
      setLoading(false);
    })();
  }, [open, member, homeId]);

	  const handleRoleChange = async (newRole: string) => {
	    if (!member) return;
	    const memberUserId = member.user_id;
	    setSaving(true);
	    setError('');
	    try {
	      await api.homeIam.updateMemberRole(homeId, memberUserId, {
	        role_base: newRole,
	        end_at: expiryDate || undefined,
	      });
      setRoleBase(newRole);

      // Reload permissions for updated role
	      const res = await api.homeIam.getMemberPermissions(homeId, memberUserId);
      setPermissions(res.permissions || []);
      onUpdate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to change role');
    }
    setSaving(false);
  };

	  const handleTogglePermission = async (perm: string, allowed: boolean) => {
	    if (!member) return;
	    const memberUserId = member.user_id;
	    setSaving(true);
	    setError('');
	    try {
	      await api.homeIam.toggleMemberPermission(homeId, memberUserId, { permission: perm, allowed });
      if (allowed) {
        setPermissions((prev) => [...new Set([...prev, perm])]);
      } else {
        setPermissions((prev) => prev.filter((p) => p !== perm));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update permission');
    }
    setSaving(false);
  };

	  const handleRemove = async () => {
	    if (!member) return;
	    const memberUserId = member.user_id;
	    setSaving(true);
	    setError('');
	    try {
	      await api.homeIam.removeMember(homeId, memberUserId);
      onRemoved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
    setSaving(false);
  };

	  const handleTransfer = async () => {
	    if (!member) return;
	    if (transferConfirmText !== 'TRANSFER') return;
	    setSaving(true);
	    setError('');
	    try {
      await api.homeProfile.transferAdmin(homeId, { new_admin_user_id: member.user_id });
      setShowTransfer(false);
      onUpdate();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to transfer ownership');
    }
    setSaving(false);
  };

	  const handleSetExpiry = async () => {
	    if (!member) return;
	    const memberUserId = member.user_id;
	    setSaving(true);
	    setError('');
	    try {
	      await api.homeIam.updateMemberRole(homeId, memberUserId, {
        role_base: roleBase,
        end_at: expiryDate || undefined,
      });
      onUpdate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update expiry');
    }
    setSaving(false);
  };

  // Human-readable permission summary
  const permSummary = PERMISSION_GROUPS
    .filter((g) => g.permissions.some((p) => permissions.includes(p.key)))
    .map((g) => ({
      label: g.label,
      perms: g.permissions.filter((p) => permissions.includes(p.key)).map((p) => p.label),
    }));

  const roleCfg = ROLE_CONFIG[roleBase] || ROLE_CONFIG.member;

  return (
    <SlidePanel open={open} onClose={onClose} title={memberName} subtitle={memberUsername ? `@${memberUsername}` : undefined}>
      <div className="space-y-5">
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-app-border border-t-gray-700 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Profile Header */}
            <div className="flex items-center gap-4">
              {profilePic ? (
                <Image src={profilePic} alt={memberName} width={64} height={64} sizes="64px" quality={75} className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-app-surface-sunken flex items-center justify-center text-xl font-bold text-app-text-secondary">
                  {memberName[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div>
                <UserIdentityLink
                  userId={member?.user_id || member?.user?.id}
                  username={memberUsername}
                  displayName={memberName}
                  avatarUrl={profilePic}
                  textClassName="text-lg font-semibold text-app-text hover:text-primary-600"
                />
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${roleCfg.color}`}>
                    {roleCfg.icon} {roleCfg.label}
                  </span>
                  {isTargetOwner && <span className="text-[10px] text-amber-600 font-medium">Primary Admin</span>}
                </div>
                {joinedDate && (
                  <p className="text-[10px] text-app-text-muted mt-1">
                    Joined {new Date(joinedDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
                {member?.end_at && (
                  <p className="text-[10px] text-orange-600 mt-0.5">
                    Access expires {new Date(member.end_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            {/* Permissions Summary */}
            <div>
              <h4 className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Permissions</h4>
              {permSummary.length > 0 ? (
                <div className="space-y-2">
                  {permSummary.map((group) => (
                    <div key={group.label} className="bg-app-surface-raised rounded-lg px-3 py-2">
                      <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider">{group.label}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {group.perms.map((p) => (
                          <span key={p} className="text-xs text-app-text-secondary bg-app-surface rounded px-2 py-0.5 border border-app-border">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-app-text-muted">No specific permissions assigned</p>
              )}
            </div>

            {/* ===== Admin Actions ===== */}
            {isOwner && !isTargetOwner && (
              <div className="border-t border-app-border-subtle pt-4 space-y-4">
                <h4 className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider">Admin Actions</h4>

                {/* Role Change */}
                <div>
                  <label className="block text-xs font-medium text-app-text-secondary mb-1.5">Change Role</label>
                  <div className="space-y-1.5">
                    {ROLE_OPTIONS.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => handleRoleChange(r.value)}
                        disabled={saving || roleBase === r.value}
                        className={`w-full text-left px-3 py-2 rounded-lg border transition text-sm ${
                          roleBase === r.value
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-app-surface text-app-text-strong border-app-border hover:border-app-border disabled:opacity-50'
                        }`}
                      >
                        <div className="font-medium text-xs">{r.label}</div>
                        <div className={`text-[10px] mt-0.5 ${roleBase === r.value ? 'text-gray-300' : 'text-app-text-muted'}`}>
                          {r.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Access Expiry */}
                <div>
                  <label className="block text-xs font-medium text-app-text-secondary mb-1">Access Expiry Date</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="flex-1 rounded-lg border border-app-border px-3 py-2 text-sm"
                    />
                    <button
                      onClick={handleSetExpiry}
                      disabled={saving}
                      className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50 transition"
                    >
                      Set
                    </button>
                  </div>
                  <p className="text-[10px] text-app-text-muted mt-0.5">
                    {expiryDate ? `Expires ${new Date(expiryDate + 'T00:00:00').toLocaleDateString()}` : 'No expiry set — permanent access'}
                  </p>
                </div>

                {/* Advanced Permissions */}
                <div>
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    {showAdvanced ? '— Hide' : '+ Show'} advanced permissions
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 space-y-3">
                      {PERMISSION_GROUPS.map((group) => (
                        <div key={group.label}>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted mb-1">
                            {group.label}
                          </p>
                          <div className="space-y-0.5">
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

                {/* Remove Member */}
                <div className="border-t border-app-border-subtle pt-3">
                  {!confirmRemove ? (
                    <button
                      onClick={() => setConfirmRemove(true)}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Remove from home
                    </button>
                  ) : (
                    <div className="bg-red-50 rounded-lg p-3 space-y-2">
                      <p className="text-sm text-red-700">Remove <strong>{memberName}</strong> from this home?</p>
                      <p className="text-[10px] text-red-500">They will lose all access immediately.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleRemove}
                          disabled={saving}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          {saving ? 'Removing...' : 'Confirm Remove'}
                        </button>
                        <button
                          onClick={() => setConfirmRemove(false)}
                          className="px-3 py-1.5 border border-app-border text-app-text-secondary text-xs font-medium rounded-lg hover:bg-app-hover"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Transfer Ownership */}
                <div className="border-t border-app-border-subtle pt-3">
                  {!showTransfer ? (
                    <button
                      onClick={() => setShowTransfer(true)}
                      className="text-[10px] text-app-text-muted hover:text-app-text-secondary font-medium"
                    >
                      Transfer primary admin to this member...
                    </button>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                      <p className="text-sm font-semibold text-amber-800">Transfer Home Ownership</p>
                      <p className="text-xs text-amber-700">
                        This will make <strong>{memberName}</strong> the primary admin. You will be demoted to admin.
                        This action cannot be easily undone.
                      </p>
                      <div>
                        <label className="block text-[10px] text-amber-600 mb-1">Type TRANSFER to confirm</label>
                        <input
                          value={transferConfirmText}
                          onChange={(e) => setTransferConfirmText(e.target.value)}
                          className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm font-mono"
                          placeholder="TRANSFER"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleTransfer}
                          disabled={saving || transferConfirmText !== 'TRANSFER'}
                          className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50"
                        >
                          {saving ? 'Transferring...' : 'Transfer Ownership'}
                        </button>
                        <button
                          onClick={() => { setShowTransfer(false); setTransferConfirmText(''); }}
                          className="px-3 py-1.5 border border-app-border text-app-text-secondary text-xs font-medium rounded-lg hover:bg-app-hover"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </SlidePanel>
  );
}
