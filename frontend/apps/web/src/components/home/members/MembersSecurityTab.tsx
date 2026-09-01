'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from '@pantopus/api';
import { getInitials } from '@pantopus/ui-utils';
import type { GuestPass, AuditEntry } from '@pantopus/api';
import type { HomeMember } from '@pantopus/types';
import ResidencyClaimsPanel from '../ResidencyClaimsPanel';
import MemberDetail from './MemberDetail';
import InviteFlow from './InviteFlow';
import LockdownPanel from './LockdownPanel';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import Image from 'next/image';

// ---- Role config (shared with MembersPanel) ----

const ROLE_CONFIG: Record<string, { color: string; icon: string; label: string; order: number }> = {
  owner:             { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: '👑', label: 'Owner', order: 0 },
  admin:             { color: 'bg-purple-50 text-purple-700 border-purple-200', icon: '🛡️', label: 'Admin', order: 1 },
  manager:           { color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: '🔧', label: 'Manager', order: 2 },
  member:            { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: '🏠', label: 'Member', order: 3 },
  restricted_member: { color: 'bg-pink-50 text-pink-700 border-pink-200', icon: '👶', label: 'Restricted', order: 4 },
  guest:             { color: 'bg-app-surface-raised text-app-text-secondary border-app-border', icon: '🎟️', label: 'Guest', order: 5 },
};

const LEGACY_ROLE_MAP: Record<string, string> = {
  tenant: 'member', roommate: 'member', renter: 'member', family: 'member',
  property_manager: 'manager', caregiver: 'restricted_member',
};

function resolveRole(m: Record<string, any>) {
  const base = (m.role_base as string) || LEGACY_ROLE_MAP[m.role as string] || (m.role as string) || 'member';
  const config = ROLE_CONFIG[base] || ROLE_CONFIG.member;
  return { base, config };
}

// ---- Audit log filter categories ----

const AUDIT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'access', label: 'Access Events' },
  { key: 'sharing', label: 'Sharing Events' },
  { key: 'membership', label: 'Membership' },
  { key: 'secrets', label: 'Secret Reveals' },
];

function matchesAuditFilter(entry: AuditEntry, filter: string): boolean {
  if (filter === 'all') return true;
  const action = entry.action || '';
  if (filter === 'access') return action.includes('login') || action.includes('access') || action.includes('view');
  if (filter === 'sharing') return action.includes('guest_pass') || action.includes('scoped_grant') || action.includes('share');
  if (filter === 'membership') return action.includes('member') || action.includes('invite') || action.includes('role') || action.includes('remove');
  if (filter === 'secrets') return action.includes('secret') || action.includes('reveal') || action.includes('access_code');
  return true;
}

// ---- Avatar helpers ----

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
];

function getAvatarColor(m: Record<string, any>) {
  const str = (m.user_id as string) || (m.id as string) || '';
  const idx = str.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}

// ============================================================
// Main Component
// ============================================================

export default function MembersSecurityTab({
  homeId,
  home,
  members,
  can,
  currentUserId,
  onInvite,
  onMembersChange,
}: {
  homeId: string;
  home: Record<string, any> & { owner_id?: string };
  members: HomeMember[];
  can: (perm: string) => boolean;
  currentUserId: string | null;
  onInvite: (data: Record<string, any>) => Promise<void>;
  onMembersChange: () => void;
}) {
  const isOwner = home?.owner_id === currentUserId;

  // Detail panel
  const [detailMember, setDetailMember] = useState<HomeMember | null>(null);

  // Invite flow
  const [showInvite, setShowInvite] = useState(false);

  // Guest passes summary
  const [activePasses, setActivePasses] = useState(0);

  // Audit log
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState('all');
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  // Lockdown
  const [lockdownEnabled, setLockdownEnabled] = useState(false);
  const [showLockdown, setShowLockdown] = useState(false);
  const [secretsCount, setSecretsCount] = useState(0);

  // Load supplementary data
  useEffect(() => {
    (async () => {
      try {
        const [passesRes, settingsRes, secretsRes] = await Promise.allSettled([
          api.homeIam.getGuestPasses(homeId),
          api.homeProfile.getHomeSettings(homeId),
          api.homeProfile.getHomeAccessSecrets(homeId),
        ]);
        if (passesRes.status === 'fulfilled') {
          const passes = (passesRes.value as Record<string, any>).passes || [];
          const active = passes.filter(
            (p: GuestPass) => !p.revoked_at && p.status !== 'revoked' && p.status !== 'expired' &&
              (!p.end_at || new Date(p.end_at) > new Date())
          );
          setActivePasses(active.length);
        }
        if (settingsRes.status === 'fulfilled') {
          const s = settingsRes.value as Record<string, any>;
          setLockdownEnabled(s?.home?.lockdown_enabled || false);
        }
        if (secretsRes.status === 'fulfilled') {
          setSecretsCount(((secretsRes.value as Record<string, any>).secrets || []).length);
        }
      } catch {
        // Non-critical
      }
    })();
  }, [homeId]);

  // Load audit log
  const loadAudit = useCallback(async (offset: number, append: boolean) => {
    setAuditLoading(true);
    try {
      const res = await api.homeIam.getAuditLog(homeId, { limit: 20, offset });
      const entries = res.entries || [];
      if (append) {
        setAuditEntries((prev) => [...prev, ...entries]);
      } else {
        setAuditEntries(entries);
      }
      setAuditHasMore(entries.length >= 20);
      setAuditOffset(offset + entries.length);
    } catch {
      if (!append) setAuditEntries([]);
    }
    setAuditLoading(false);
  }, [homeId]);

  const handleShowAudit = () => {
    if (!showAudit) {
      setShowAudit(true);
      setAuditOffset(0);
      loadAudit(0, false);
    } else {
      setShowAudit(false);
    }
  };

  // Group members by role
  const active = members.filter((m) => m.is_active !== false);
  const pending = members.filter((m) => m.is_active === false);

  const grouped = active.reduce<Record<string, HomeMember[]>>((acc, m) => {
    const { base } = resolveRole(m);
    if (!acc[base]) acc[base] = [];
    acc[base].push(m);
    return acc;
  }, {});

  // Sort groups by role order
  const sortedGroups = Object.entries(grouped).sort(
    ([a], [b]) => (ROLE_CONFIG[a]?.order ?? 99) - (ROLE_CONFIG[b]?.order ?? 99)
  );

  const filteredAudit = auditEntries.filter((e) => matchesAuditFilter(e, auditFilter));

  return (
    <div className="space-y-6">
      {/* Member Detail Slide Panel */}
      <MemberDetail
        open={!!detailMember}
        onClose={() => setDetailMember(null)}
        member={detailMember}
        homeId={homeId}
        isOwner={isOwner}
        members={members}
        onUpdate={onMembersChange}
        onRemoved={() => { setDetailMember(null); onMembersChange(); }}
      />

      {/* Invite Flow */}
      <InviteFlow
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onInvite={async (data) => { await onInvite(data); onMembersChange(); }}
        homeId={homeId}
      />

      {/* Lockdown Panel */}
      <LockdownPanel
        open={showLockdown}
        onClose={() => setShowLockdown(false)}
        homeId={homeId}
        lockdownEnabled={lockdownEnabled}
        onLockdownChange={(enabled) => setLockdownEnabled(enabled)}
      />

      {/* Residency Claims (existing) */}
      <ResidencyClaimsPanel homeId={homeId} canManage={can('members.manage')} />

      {/* ===== Section 1: Members List ===== */}
      <div className="bg-app-surface rounded-xl border border-app-border">
        <div className="px-5 py-4 border-b border-app-border-subtle flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-app-text">Members</h3>
            <p className="text-xs text-app-text-secondary mt-0.5">{active.length} active member{active.length !== 1 ? 's' : ''}</p>
          </div>
          {can('members.manage') && (
            <button
              onClick={() => setShowInvite(true)}
              className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition"
            >
              + Invite
            </button>
          )}
        </div>

        <div className="divide-y divide-app-border-subtle">
          {sortedGroups.map(([roleBase, roleMembers]) => {
            const cfg = ROLE_CONFIG[roleBase] || ROLE_CONFIG.member;
            return (
              <div key={roleBase}>
                <div className="px-5 py-2 bg-app-surface-raised/50">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">
                    {cfg.icon} {cfg.label}s ({roleMembers.length})
                  </p>
                </div>
                {roleMembers.map((m) => (
                  <MemberRow
                    key={m.id || m.user_id}
                    member={m}
                    homeOwnerId={home?.owner_id}
                    onClick={() => setDetailMember(m)}
                  />
                ))}
              </div>
            );
          })}

          {/* Pending Invites */}
          {pending.length > 0 && (
            <div>
              <div className="px-5 py-2 bg-app-surface-raised/50">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">
                  Pending Invites ({pending.length})
                </p>
              </div>
              {pending.map((m) => {
                const name = m.user?.name || m.user?.username || m.email || 'Invited';
                return (
                  <div key={m.id || m.user_id} className="px-5 py-3 flex items-center gap-3 opacity-60">
                    <div className="w-10 h-10 rounded-full bg-app-surface-sunken flex items-center justify-center text-xs text-app-text-secondary flex-shrink-0">?</div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm text-app-text-secondary">{name}</span>
                    </div>
                    <span className="text-[10px] text-app-text-muted bg-app-surface-sunken rounded-full px-2 py-0.5">Pending</span>
                  </div>
                );
              })}
            </div>
          )}

          {active.length === 0 && pending.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-app-text-muted">
              No members yet. Invite someone to get started.
            </div>
          )}
        </div>
      </div>

      {/* ===== Section 2: Security Center ===== */}
      <div>
        <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-3">Security Center</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Guest Passes Card */}
          <div className="bg-app-surface rounded-xl border border-app-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🔗</span>
              <span className="text-sm font-semibold text-app-text">Guest Passes</span>
            </div>
            <div className="text-2xl font-bold text-app-text">{activePasses}</div>
            <p className="text-[10px] text-app-text-muted mt-0.5">active pass{activePasses !== 1 ? 'es' : ''}</p>
          </div>

          {/* Secret Vault Card */}
          <div className="bg-app-surface rounded-xl border border-app-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🔐</span>
              <span className="text-sm font-semibold text-app-text">Secret Vault</span>
            </div>
            <div className="text-2xl font-bold text-app-text">{secretsCount}</div>
            <p className="text-[10px] text-app-text-muted mt-0.5">access secret{secretsCount !== 1 ? 's' : ''} stored</p>
          </div>

          {/* Lockdown Mode Card */}
          {can('security.manage') && (
            <div className={`bg-app-surface rounded-xl border p-4 ${lockdownEnabled ? 'border-red-300 bg-red-50/30' : 'border-app-border'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{lockdownEnabled ? '🔒' : '🛡️'}</span>
                    <span className="text-sm font-semibold text-app-text">Lockdown Mode</span>
                  </div>
                  <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 border ${
                    lockdownEnabled
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-green-50 text-green-700 border-green-200'
                  }`}>
                    {lockdownEnabled ? 'ENABLED' : 'Disabled'}
                  </span>
                </div>
                <button
                  onClick={() => setShowLockdown(true)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 transition"
                >
                  Manage
                </button>
              </div>
            </div>
          )}

          {/* Home Verification */}
          <div className="bg-app-surface rounded-xl border border-app-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">✅</span>
              <span className="text-sm font-semibold text-app-text">Verification</span>
            </div>
            <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 border ${
              home?.verified
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-app-surface-sunken text-app-text-secondary border-app-border'
            }`}>
              {home?.verified ? 'Verified' : 'Not verified'}
            </span>
          </div>
        </div>
      </div>

      {/* ===== Section 3: Audit Log ===== */}
      {(isOwner || can('security.manage')) && (
        <div>
          <button
            onClick={handleShowAudit}
            className="flex items-center gap-2 text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-3 hover:text-app-text-strong transition"
          >
            <span className={`transform transition-transform ${showAudit ? 'rotate-90' : ''}`}>▶</span>
            Audit Log
          </button>

          {showAudit && (
            <div className="space-y-3">
              {/* Filter buttons */}
              <div className="flex gap-1 overflow-x-auto pb-1">
                {AUDIT_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setAuditFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                      auditFilter === f.key
                        ? 'bg-gray-900 text-white'
                        : 'bg-app-surface-sunken text-app-text-secondary hover:bg-app-hover'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Entries */}
              <div className="bg-app-surface rounded-xl border border-app-border divide-y divide-app-border-subtle">
                {auditLoading && auditEntries.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-app-text-muted">Loading audit log...</div>
                ) : filteredAudit.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-app-text-muted">
                    No events matching this filter
                  </div>
                ) : (
                  filteredAudit.map((entry) => (
                    <AuditRow key={entry.id} entry={entry} />
                  ))
                )}
              </div>

              {/* Load More */}
              {auditHasMore && (
                <div className="text-center">
                  <button
                    onClick={() => loadAudit(auditOffset, true)}
                    disabled={auditLoading}
                    className="px-4 py-2 text-xs font-medium text-app-text-secondary bg-app-surface-sunken rounded-lg hover:bg-app-hover disabled:opacity-50 transition"
                  >
                    {auditLoading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Member Row ----

function MemberRow({
  member,
  homeOwnerId,
  onClick,
}: {
  member: Record<string, any>;
  homeOwnerId?: string;
  onClick: () => void;
}) {
  const name = member.user?.name || member.user?.username || member.name || member.username || 'Unknown';
  const isOwner = member.user_id === homeOwnerId || member.role === 'owner' || member.role_base === 'owner';
  const { config } = resolveRole(member);
  const profilePic = member.user?.profile_picture_url || member.user?.avatar_url;
  const joinedDate = member.created_at || member.start_at;

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-app-hover/50 transition"
    >
      {profilePic ? (
        <Image src={profilePic} alt={name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" width={40} height={40} sizes="40px" quality={75} />
      ) : (
        <div className={`w-10 h-10 rounded-full ${getAvatarColor(member)} text-white flex items-center justify-center text-sm font-bold flex-shrink-0`}>
          {getInitials(name)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <UserIdentityLink
            userId={member.user_id || member.user?.id}
            username={member.user?.username}
            displayName={name}
            avatarUrl={profilePic}
            textClassName="text-sm font-medium text-app-text truncate hover:text-primary-600"
            stopPropagation
          />
          {isOwner && <span className="text-xs">👑</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {member.user?.username && (
            <span className="text-[10px] text-app-text-muted">@{member.user.username}</span>
          )}
          {joinedDate && (
            <span className="text-[10px] text-gray-300">
              Joined {new Date(joinedDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </span>
          )}
          {member.age_band && member.age_band !== 'adult' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-50 text-pink-600 border border-pink-100">
              {member.age_band}
            </span>
          )}
        </div>
      </div>

      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border flex-shrink-0 ${config.color}`}>
        {config.icon} {config.label}
      </span>
    </button>
  );
}

// ---- Audit Row ----

const ACTION_ICONS: Record<string, string> = {
  member_invited: '📧',
  member_removed: '🚪',
  role_changed: '🔄',
  guest_pass_created: '🔗',
  guest_pass_revoked: '❌',
  secret_revealed: '👁️',
  lockdown_enabled: '🔒',
  lockdown_disabled: '🔓',
  settings_updated: '⚙️',
};

function AuditRow({ entry }: { entry: AuditEntry }) {
  const icon = ACTION_ICONS[entry.action] || '📝';
  const actorName = entry.actor?.name || entry.actor?.username || 'System';

  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <span className="text-sm flex-shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-app-text-strong">
          <UserIdentityLink
            userId={entry.actor?.id}
            username={entry.actor?.username}
            displayName={actorName}
            textClassName="font-medium text-app-text hover:text-primary-600"
          />
          {' '}
          <span>{entry.action.replace(/_/g, ' ')}</span>
          {entry.target_type && (
            <span className="text-app-text-muted"> on {entry.target_type}</span>
          )}
        </div>
        <div className="text-[10px] text-app-text-muted mt-0.5">
          {new Date(entry.created_at).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}
