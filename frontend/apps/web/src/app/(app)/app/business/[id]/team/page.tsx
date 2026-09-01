'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as api from '@pantopus/api';
import { confirmStore } from '@/components/ui/confirm-store';

export default function BusinessTeamPage() {
  const params = useParams();
  const businessId = String(params.id || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [members, setMembers] = useState<api.businessIam.BusinessTeamMember[]>([]);
  const [invite, setInvite] = useState({ username: '', role_base: 'viewer', title: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.businessIam.getTeamMembers(businessId);
      setMembers(res.members || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addMember = async () => {
    if (!invite.username.trim()) {
      setError('Username is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.businessIam.addTeamMember(businessId, {
        username: invite.username.trim().replace(/^@/, ''),
        role_base: invite.role_base,
        title: invite.title.trim() || undefined,
      });
      setInvite({ username: '', role_base: 'viewer', title: '' });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add member');
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (userId: string) => {
    const yes = await confirmStore.open({ title: 'Remove this member?', confirmLabel: 'Remove', variant: 'destructive' });
    if (!yes) return;
    try {
      await api.businessIam.removeMember(businessId, userId);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove member');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-app-text">Team</h1>
          <p className="text-sm text-app-text-secondary mt-1">Invite and manage business collaborators</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/app/business/${businessId}/team/invite`} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700">
            Invite Page
          </Link>
          <Link href={`/app/business/${businessId}/dashboard`} className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="bg-app-surface border border-app-border rounded-xl p-5 mb-5">
        <h2 className="text-sm font-semibold text-app-text mb-3">Quick Invite</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input value={invite.username} onChange={(e) => setInvite((v) => ({ ...v, username: e.target.value }))} placeholder="@username" className="rounded border border-app-border px-3 py-2 text-sm" />
          <select value={invite.role_base} onChange={(e) => setInvite((v) => ({ ...v, role_base: e.target.value }))} className="rounded border border-app-border px-3 py-2 text-sm">
            {['viewer', 'staff', 'editor', 'admin'].map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <input value={invite.title} onChange={(e) => setInvite((v) => ({ ...v, title: e.target.value }))} placeholder="Title" className="rounded border border-app-border px-3 py-2 text-sm" />
          <button onClick={addMember} disabled={saving} className="rounded bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
            Invite
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
      {loading && <div className="text-app-text-secondary">Loading...</div>}

      {!loading && (
        <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden">
          {members.length === 0 ? (
            <div className="p-6 text-center text-app-text-secondary text-sm">No team members yet.</div>
          ) : (
            <div className="divide-y divide-app-border-subtle">
              {members.map((m) => (
                <div key={m.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-app-text">{m.user?.name || m.user?.username}</div>
                    <div className="text-xs text-app-text-secondary">@{m.user?.username} · {m.role_base}{m.title ? ` · ${m.title}` : ''}</div>
                  </div>
                  {m.role_base !== 'owner' && (
                    <button onClick={() => void removeMember(m.user?.id)} className="text-xs text-red-600 hover:underline">
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
