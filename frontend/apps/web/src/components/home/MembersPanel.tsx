'use client';

import { type ReactNode } from 'react';
import { Crown, ShieldCheck, Wrench, Home, Baby, Ticket, Timer } from 'lucide-react';
import { getInitials } from '@pantopus/ui-utils';
import Image from 'next/image';
import UserIdentityLink from '@/components/user/UserIdentityLink';

// ============================================================
// Role display config — maps role_base to visual style
// ============================================================

const ROLE_CONFIG: Record<string, { color: string; icon: ReactNode; label: string }> = {
  owner:             { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Crown className="w-3 h-3" />, label: 'Owner' },
  admin:             { color: 'bg-purple-50 text-purple-700 border-purple-200', icon: <ShieldCheck className="w-3 h-3" />, label: 'Admin' },
  manager:           { color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: <Wrench className="w-3 h-3" />, label: 'Manager' },
  member:            { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Home className="w-3 h-3" />, label: 'Member' },
  restricted_member: { color: 'bg-pink-50 text-pink-700 border-pink-200', icon: <Baby className="w-3 h-3" />, label: 'Restricted' },
  guest:             { color: 'bg-app-surface-raised text-app-text-secondary border-app-border', icon: <Ticket className="w-3 h-3" />, label: 'Guest' },
};

// Fallback for legacy roles not yet migrated to role_base
const LEGACY_ROLE_MAP: Record<string, string> = {
  tenant: 'member',
  roommate: 'member',
  renter: 'member',
  family: 'member',
  property_manager: 'manager',
  caregiver: 'restricted_member',
};

function resolveRole(m: Record<string, any>): { base: string; display: string; config: (typeof ROLE_CONFIG)[string] } {
  const base = (m.role_base as string) || LEGACY_ROLE_MAP[m.role as string] || (m.role as string) || 'member';
  const config = ROLE_CONFIG[base] || ROLE_CONFIG.member;
  return { base, display: config.label, config };
}

// ============================================================
// Component
// ============================================================

export default function MembersPanel({
  members,
  homeOwnerId,
  onInvite,
  onManageMember,
  canManageMembers = false,
}: {
  members: Record<string, any>[];
  homeOwnerId?: string;
  onInvite?: () => void;
  onManageMember?: (member: Record<string, any>) => void;
  canManageMembers?: boolean;
}) {
  const active = members.filter((m) => m.is_active !== false);
  const pending = members.filter((m) => m.is_active === false);

  const avatarColors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
  ];

  const getColor = (m: Record<string, any>) => {
    const str = (m.user_id as string) || (m.id as string) || '';
    const idx = str.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
    return avatarColors[idx % avatarColors.length];
  };

  const formatExpiry = (endAt: string | null) => {
    if (!endAt) return null;
    const d = new Date(endAt);
    const now = new Date();
    if (d <= now) return 'Expired';
    const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 7) return `${days}d left`;
    if (days <= 30) return `${Math.ceil(days / 7)}w left`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-app-surface rounded-xl border border-app-border">
      <div className="px-5 py-4 border-b border-app-border-subtle flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-app-text">Members</h3>
          <p className="text-xs text-app-text-secondary mt-0.5">{active.length} active</p>
        </div>
        {onInvite && canManageMembers && (
          <button
            onClick={onInvite}
            className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition"
          >
            + Invite
          </button>
        )}
      </div>

      <div className="divide-y divide-app-border-subtle">
        {active.map((m) => {
          const name = m.user?.name || m.user?.username || m.name || m.username || 'Unknown';
          const isOwner = m.user_id === homeOwnerId || m.role === 'owner' || m.role_base === 'owner';
          const role = resolveRole(m);
          const profilePic = m.user?.profile_picture_url || m.user?.avatar_url;
          const expiry = formatExpiry(m.end_at);

          return (
            <button
              key={m.id || m.user_id}
              onClick={() => onManageMember?.(m)}
              className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-app-hover/50 transition"
            >
              {profilePic ? (
                <Image src={profilePic} alt={name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" width={40} height={40} sizes="40px" quality={75} />
              ) : (
                <div className={`w-10 h-10 rounded-full ${getColor(m)} text-white flex items-center justify-center text-sm font-bold flex-shrink-0`}>
                  {getInitials(name)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <UserIdentityLink
                    userId={m.user_id || m.user?.id}
                    username={m.user?.username}
                    displayName={name}
                    avatarUrl={profilePic}
                    textClassName="text-sm font-medium text-app-text truncate hover:text-primary-600"
                    stopPropagation
                  />
                  {isOwner && <span className="flex-shrink-0">{role.config.icon}</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {m.age_band && m.age_band !== 'adult' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-50 text-pink-600 border border-pink-100">
                      {m.age_band}
                    </span>
                  )}
                  {expiry && (
                    <span className="text-[10px] text-orange-600 flex items-center gap-0.5"><Timer className="w-3 h-3" /> {expiry}</span>
                  )}
                </div>
              </div>

              <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border flex-shrink-0 ${role.config.color}`}>
                {role.config.icon} {role.display}
              </span>
            </button>
          );
        })}

        {pending.length > 0 && (
          <div className="px-5 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted mb-2">Pending</p>
            {pending.map((m) => {
              const name = m.user?.name || m.user?.username || m.email || 'Invited';
              return (
                <div key={m.id || m.user_id} className="flex items-center gap-3 py-1.5 opacity-60">
                  <div className="w-8 h-8 rounded-full bg-app-surface-sunken flex items-center justify-center text-xs text-app-text-secondary">?</div>
                  <span className="text-sm text-app-text-secondary">{name}</span>
                  <span className="text-[10px] text-app-text-muted ml-auto">Pending</span>
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
  );
}
