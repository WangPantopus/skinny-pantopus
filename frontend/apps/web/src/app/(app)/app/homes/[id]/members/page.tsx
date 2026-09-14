'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { removalLink } from '@/components/home/member-removals/removalModel';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, UserPlus, ShieldCheck, Shield, Key, User, Lock, Clock, ArrowLeftRight, UserMinus, Users, Mail } from 'lucide-react';
import * as api from '@pantopus/api';
import type { HouseholdAccessRequestRow } from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

const ROLE_ORDER = ['owner', 'admin', 'manager', 'member', 'restricted_member', 'guest'];
const DISPLAY_ROLE_ORDER = ['owner', 'admin', 'manager', 'lease_resident', 'member', 'restricted_member', 'guest', 'service_provider'];
const ROLE_META: Record<string, { icon: typeof ShieldCheck; color: string; label: string }> = {
  owner:             { icon: ShieldCheck, color: '#7c3aed', label: 'Owner' },
  admin:             { icon: Shield,      color: '#0284c7', label: 'Admin' },
  manager:           { icon: Key,         color: '#0891b2', label: 'Manager' },
  lease_resident:    { icon: User,        color: '#059669', label: 'Lease member' },
  member:            { icon: User,        color: '#059669', label: 'Member' },
  restricted_member: { icon: Lock,        color: '#d97706', label: 'Restricted' },
  guest:             { icon: Clock,       color: '#6b7280', label: 'Guest' },
  service_provider:  { icon: Key,         color: '#6b7280', label: 'Service provider' },
};

type MemberTab = 'members' | 'requests' | 'audit';

function formatRequestedIdentity(identity: string): string {
  const map: Record<string, string> = {
    owner: 'Owner',
    resident: 'Resident',
    household_member: 'Household member',
    guest: 'Guest',
  };
  return map[identity] || identity;
}

function requesterDisplayName(r: HouseholdAccessRequestRow): string {
  const u = r.requester;
  if (!u) return 'Unknown user';
  if (u.name) return u.name;
  const parts = [u.first_name, u.last_name].filter(Boolean);
  if (parts.length) return parts.join(' ');
  if (u.username) return `@${u.username}`;
  return 'Unknown user';
}

function MembersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id: homeId } = useParams<{ id: string }>();

  const [members, setMembers] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [myAccess, setMyAccess] = useState<any>(null);
  const [accessRequests, setAccessRequests] = useState<HouseholdAccessRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<MemberTab>('members');
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [membersError, setMembersError] = useState('');
  const generation = useRef(0);

  const tabFromUrl = searchParams.get('tab');
  const accessRequesterParam = searchParams.get('access_requester');

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const retire = useCallback(() => {
    generation.current++;
    setMembers([]); setMyAccess(null); setAuditLog([]); setAccessRequests([]); setMembersError('');
  }, []);
  const fetchData = useCallback(async () => {
    if (!homeId) return;
    retire();
    const revision = generation.current, token = api.getAuthToken(), origin = api.getApiBaseUrl();
    const marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
    const current = () => generation.current === revision && api.getAuthToken() === token && api.getApiBaseUrl() === origin
      && localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) === marker && document.visibilityState !== 'hidden';
    setLoading(true);
    const [membersRes, accessRes, auditRes, reqRes] = await Promise.allSettled([
      api.homeIam.getHomeMembers(homeId), api.homeIam.getMyHomeAccess(homeId),
      api.homeIam.getAuditLog(homeId), api.getHouseholdAccessRequests(homeId, { status: 'pending' }),
    ]);
    if (!current()) return;
    if (membersRes.status === 'fulfilled') {
      const val = membersRes.value as any;
      const rows = val?.occupants || val?.members;
      if (Array.isArray(rows) && rows.every(m => m && m.home_id === homeId && typeof m.user_id === 'string' && m.is_active === true)) setMembers(rows);
      else setMembersError('The current member list could not be verified. Refresh to try again.');
    } else setMembersError('The current member list could not be loaded. Refresh to check current household access.');
    if (accessRes.status === 'fulfilled') {
      const access = accessRes.value;
      if (access?.hasAccess === true && Array.isArray(access.permissions) && access.permissions.every(p => typeof p === 'string')) setMyAccess(access);
    }
    if (auditRes.status === 'fulfilled') setAuditLog((auditRes.value as any)?.entries || (auditRes.value as any)?.log || []);
    if (reqRes.status === 'fulfilled') setAccessRequests(reqRes.value.requests || []);
    setLoading(false);
  }, [homeId, retire]);

  useEffect(() => {
    let disposed = false;
    const refresh = () => { retire(); if (!disposed && document.visibilityState !== 'hidden') void fetchData(); };
    const visibility = () => { if (document.visibilityState === 'hidden') retire(); else refresh(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) refresh(); };
    const unsubscribe = api.onTokenChange(refresh);
    window.addEventListener('focus', refresh); window.addEventListener('pageshow', visibility); window.addEventListener('pagehide', retire);
    window.addEventListener('storage', storage); document.addEventListener('visibilitychange', visibility); void fetchData();
    return () => { disposed = true; retire(); unsubscribe(); window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', visibility); window.removeEventListener('pagehide', retire);
      window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', visibility); };
  }, [fetchData, retire]);

  useEffect(() => {
    if (tabFromUrl === 'requests') setTab('requests');
  }, [tabFromUrl]);

  const canManage = !membersError && myAccess?.hasAccess === true && myAccess.permissions.includes('members.manage');

  const grouped = DISPLAY_ROLE_ORDER.reduce<Record<string, any[]>>((acc, role) => {
    const roleMembers = members.filter((m: any) => m.role === role || m.role_base === role);
    if (roleMembers.length > 0) acc[role] = roleMembers;
    return acc;
  }, {});

  const handleRoleChange = useCallback(async (member: any) => {
    if (!canManage) return;
    const assignable = ROLE_ORDER.filter((r) => r !== 'owner' && r !== member.role);
    if (assignable.length === 0) return;
    // Cycle to the next assignable role
    const currentIdx = assignable.indexOf(member.role);
    const nextRole = assignable[(currentIdx + 1) % assignable.length];
    const roleLabel = ROLE_META[nextRole]?.label || nextRole;
    const yes = await confirmStore.open({
      title: 'Change Role',
      description: `Change ${member.display_name || member.email} to ${roleLabel}?`,
      confirmLabel: `Set as ${roleLabel}`,
      variant: 'primary',
    });
    if (!yes) return;
    try {
      await api.homeIam.updateMemberRole(homeId!, member.user_id || member.id, { role_base: nextRole });
      toast.success(`Role changed to ${roleLabel}`);
      await fetchData();
    } catch (err: any) { toast.error(err?.message || 'Failed to update role'); }
  }, [homeId, canManage, fetchData]);

  const handleRemove = useCallback((member: any) => {
    if (!canManage || typeof member.user_id !== 'string') return;
    router.push(removalLink(homeId, member.user_id));
  }, [homeId, canManage, router]);

  const handleApproveAccessRequest = useCallback(async (requestId: string) => {
    if (!canManage || !homeId) return;
    const yes = await confirmStore.open({
      title: 'Send invitation',
      description: 'This creates a personal invitation for them to accept in the app.',
      confirmLabel: 'Send invite',
      variant: 'primary',
    });
    if (!yes) return;
    setBusyRequestId(requestId);
    try {
      await api.approveHouseholdAccessRequest(homeId, requestId);
      toast.success('Invitation sent');
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve request');
    } finally {
      setBusyRequestId(null);
    }
  }, [homeId, canManage, fetchData]);

  const handleRejectAccessRequest = useCallback(async (row: HouseholdAccessRequestRow) => {
    if (!canManage || !homeId) return;
    const yes = await confirmStore.open({
      title: 'Decline request',
      description: `Decline ${requesterDisplayName(row)}'s request to join as ${formatRequestedIdentity(row.requested_identity)}?`,
      confirmLabel: 'Decline',
      variant: 'destructive',
    });
    if (!yes) return;
    setBusyRequestId(row.id);
    try {
      await api.rejectHouseholdAccessRequest(homeId, row.id);
      toast.success('Request declined');
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to decline request');
    } finally {
      setBusyRequestId(null);
    }
  }, [homeId, canManage, fetchData]);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
          <h1 className="text-xl font-bold text-app-text">Members</h1>
        </div>
        {canManage && (
          <button onClick={() => router.push(`/app/homes/${homeId}/members/add-guest`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition">
            <UserPlus className="w-4 h-4" /> Invite
          </button>
        )}
      </div>

      <div className="mb-4"><Link href="/app/homes/member-removals" className="text-sm text-blue-700 underline">Recover a member removal</Link></div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void fetchData()} className="rounded-lg border border-app-border px-3 py-2 text-sm">Refresh members</button>
        {membersError && <p role="alert" className="text-sm text-amber-800">{membersError}</p>}
      </div>
      {/* Tabs */}
      <div className="flex border-b border-app-border mb-4 overflow-x-auto">
        <button type="button" onClick={() => setTab('members')} className={`px-4 py-2.5 text-sm font-medium transition whitespace-nowrap ${tab === 'members' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-app-text-secondary hover:text-app-text'}`}>
          Members {membersError ? '(unavailable)' : `(${members.length})`}
        </button>
        {canManage && (
          <button type="button" onClick={() => setTab('requests')} className={`px-4 py-2.5 text-sm font-medium transition whitespace-nowrap ${tab === 'requests' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-app-text-secondary hover:text-app-text'}`}>
            Requests ({accessRequests.length})
          </button>
        )}
        {canManage && (
          <button type="button" onClick={() => setTab('audit')} className={`px-4 py-2.5 text-sm font-medium transition whitespace-nowrap ${tab === 'audit' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-app-text-secondary hover:text-app-text'}`}>
            Audit Log
          </button>
        )}
      </div>

      {tab === 'members' ? (
        <div className="space-y-6">
          {Object.entries(grouped).map(([role, roleMembers]) => {
            const meta = ROLE_META[role] || ROLE_META.guest;
            const RoleIcon = meta.icon;
            return (
              <div key={role}>
                <div className="flex items-center gap-2 mb-3">
                  <RoleIcon className="w-4 h-4" style={{ color: meta.color }} />
                  <h2 className="text-xs font-bold uppercase tracking-wide flex-1" style={{ color: meta.color }}>{meta.label}s</h2>
                  <span className="text-xs text-app-text-muted bg-app-surface-sunken px-2 py-0.5 rounded-full">{roleMembers.length}</span>
                </div>
                <div className="space-y-1.5">
                  {roleMembers.map((member: any) => (
                    <div key={member.id || member.user_id} className="flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: meta.color + '15' }}>
                        <span className="text-sm font-bold" style={{ color: meta.color }}>
                          {(member.display_name || member.user?.name || member.user?.username || member.username || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-app-text truncate">{member.display_name || member.user?.name || member.user?.username || member.username || 'Unknown'}</p>
                        {(member.username || member.user?.username) && <p className="text-xs text-app-text-muted">@{member.username || member.user?.username}</p>}
                        {member.joined_at && <p className="text-[11px] text-app-text-muted mt-0.5">Joined {new Date(member.joined_at).toLocaleDateString()}</p>}
                      </div>
                      {canManage && role !== 'owner' && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => handleRoleChange(member)} title="Change role" className="p-1.5 text-app-text-secondary hover:bg-app-hover rounded-lg transition">
                            <ArrowLeftRight className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleRemove(member)} title="Remove" aria-label={`Review removal of ${member.user?.username || member.username || 'this member'}`} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition">
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {!membersError && members.length === 0 && (
            <div className="text-center py-16"><Users className="w-10 h-10 mx-auto text-app-text-muted mb-3" /><p className="text-sm text-app-text-secondary">No members yet</p></div>
          )}

          {canManage && (
            <button onClick={() => router.push(`/app/homes/${homeId}/members/add-guest`)}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition mt-4">
              <UserPlus className="w-5 h-5" /> Invite New Member
            </button>
          )}
        </div>
      ) : tab === 'requests' ? (
        canManage ? (
          accessRequests.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Mail className="w-10 h-10 mx-auto text-app-text-muted mb-3" />
              <p className="text-sm text-app-text-secondary">No pending requests</p>
              <p className="text-xs text-app-text-muted mt-2 max-w-sm mx-auto">
                When someone asks to join from the claim flow, their request appears here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {accessRequests.map((req) => {
                const highlight =
                  accessRequesterParam && accessRequesterParam === req.requester_user_id;
                return (
                  <div
                    key={req.id}
                    className={`flex flex-col sm:flex-row sm:items-start gap-3 bg-app-surface border rounded-xl p-4 ${
                      highlight ? 'border-emerald-500 ring-1 ring-emerald-500/30' : 'border-app-border'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-app-text">{requesterDisplayName(req)}</p>
                      <p className="text-xs text-app-text-secondary mt-0.5">
                        Wants to join as {formatRequestedIdentity(req.requested_identity)}
                      </p>
                      {req.created_at && (
                        <p className="text-[11px] text-app-text-muted mt-1">
                          Requested {new Date(req.created_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        disabled={busyRequestId === req.id}
                        onClick={() => handleRejectAccessRequest(req)}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-app-border text-app-text-secondary hover:bg-app-hover disabled:opacity-50"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        disabled={busyRequestId === req.id}
                        onClick={() => handleApproveAccessRequest(req.id)}
                        className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 min-w-[88px]"
                      >
                        {busyRequestId === req.id ? '…' : 'Invite'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="text-center py-16 text-sm text-app-text-secondary">
            You don&apos;t have access to review requests.
          </div>
        )
      ) : (
        <div className="space-y-2">
          {auditLog.length === 0 ? (
            <div className="text-center py-16"><p className="text-sm text-app-text-secondary">No audit log entries</p></div>
          ) : auditLog.map((entry: any, idx: number) => (
            <div key={entry.id || idx} className="flex items-start gap-3 bg-app-surface border border-app-border rounded-lg p-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-app-text">{entry.action}</p>
                <p className="text-xs text-app-text-secondary mt-0.5">
                  {entry.actor?.username || entry.actor_name || 'System'}
                  {entry.target_name ? ` \u2192 ${entry.target_name}` : ''}
                </p>
                {entry.created_at && <p className="text-[11px] text-app-text-muted mt-0.5">{new Date(entry.created_at).toLocaleString()}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>}>
      <MembersContent />
    </Suspense>
  );
}
