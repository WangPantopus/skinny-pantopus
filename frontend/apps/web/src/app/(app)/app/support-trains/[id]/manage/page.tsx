'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { buildSupportTrainShareUrl } from '@pantopus/utils';
import {
  ArrowLeft,
  Copy,
  Link,
  Mail,
  Users,
  Heart,
  DollarSign,
  ArrowUpDown,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
  Plus,
  Trash2,
} from 'lucide-react';

// ============================================================
// SUPPORT TRAIN MANAGE PAGE (Web)
// Invite tools, donation summary, reservation table
// ============================================================

export default function ManageSupportTrainPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [fund, setFund] = useState<any>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sort
  const [sortField, setSortField] = useState<'created_at' | 'status'>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!getAuthToken()) {
      router.push('/login');
      return;
    }
    try {
      const [trainData, resData, invData, fundData, contribData] = await Promise.all([
        api.supportTrains.getSupportTrain(id),
        api.supportTrains.listReservations(id).catch(() => ({ reservations: [] })),
        api.supportTrains.listInvites(id).catch(() => ({ invites: [] })),
        api.supportTrains.getFund(id).catch(() => null),
        api.supportTrains.listContributions(id, { limit: 50 }).catch(() => ({ contributions: [] })),
      ]);
      setData(trainData);
      setReservations(resData.reservations || []);
      setInvites(invData.invites || []);
      setFund(fundData);
      setContributions(contribData.contributions || []);

      if (trainData && (trainData as any).viewer_level !== 'organizer') {
        router.replace(`/app/support-trains/${id}`);
      }
    } catch {
      /* empty */
    }
  }, [id, router]);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const handleCopyLink = useCallback(() => {
    const url = buildSupportTrainShareUrl(id);
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [id]);

  const handleInvite = useCallback(async () => {
    if (!inviteEmail && !inviteUserId) return;
    setInviting(true);
    try {
      await api.supportTrains.createInvite(id, {
        invitee_email: inviteEmail || undefined,
        invitee_user_id: inviteUserId || undefined,
      });
      setInviteEmail('');
      setInviteUserId('');
      await fetchAll();
    } catch (err: any) {
      alert(err?.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  }, [id, inviteEmail, inviteUserId, fetchAll]);

  const handleDeleteSupportTrain = useCallback(async () => {
    if (deleting) return;

    const confirmed = window.confirm(
      'Delete this Support Train permanently? This removes its schedule, updates, and invites. Trains with active helpers or gift fund contributions cannot be deleted.'
    );

    if (!confirmed) return;

    setDeleting(true);
    try {
      await api.supportTrains.deleteSupportTrain(id);
      router.replace('/app/support-trains');
    } catch (err: any) {
      alert(err?.message || 'Failed to delete Support Train');
    } finally {
      setDeleting(false);
    }
  }, [deleting, id, router]);

  const sortedReservations = [...reservations].sort((a, b) => {
    const va = a[sortField] || '';
    const vb = b[sortField] || '';
    return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!data) return null;

  const goalAmount = fund?.goal_amount;
  const totalRaised = fund?.total_amount || 0;
  const goalPct = goalAmount ? Math.min(100, Math.round((totalRaised / goalAmount) * 100)) : null;
  const activeHelperCount = reservations.filter((reservation: any) =>
    ['reserved', 'delivered', 'confirmed'].includes(String(reservation?.status || ''))
  ).length;
  const canDeleteSupportTrain = data.viewer_support_train_role === 'primary';
  const deleteDisabledReason = activeHelperCount > 0
    ? 'Delete is unavailable because helpers have already committed to this train.'
    : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button
        onClick={() => router.push(`/app/support-trains/${id}`)}
        className="text-sm text-app-text-secondary hover:text-app-text mb-6 flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to campaign
      </button>

      <h1 className="text-2xl font-bold text-app-text mb-8">Manage: {data.title}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Invite Tools ── */}
        <section className="bg-app-surface border border-app-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-app-text mb-4 flex items-center gap-2">
            <Link className="w-5 h-5 text-app-text-muted" />
            Invite & Share
          </h2>

          {/* Copy link */}
          <div className="flex gap-2 mb-4">
            <input
              readOnly
              value={buildSupportTrainShareUrl(id)}
              className="flex-1 p-2.5 bg-app-surface-sunken border border-app-border rounded-lg text-sm text-app-text truncate"
            />
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          </div>

          {/* Invite by email or user ID */}
          <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
            Send invite
          </p>
          <div className="flex gap-2 mb-2">
            <input
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                setInviteUserId('');
              }}
              placeholder="Email address"
              className="flex-1 p-2.5 bg-app-surface-sunken border border-app-border rounded-lg text-sm text-app-text placeholder:text-app-text-muted"
            />
            <button
              onClick={handleInvite}
              disabled={inviting || (!inviteEmail && !inviteUserId)}
              className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {inviting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Invite
                </>
              )}
            </button>
          </div>
          <div className="flex gap-2 mb-4">
            <input
              value={inviteUserId}
              onChange={(e) => {
                setInviteUserId(e.target.value);
                setInviteEmail('');
              }}
              placeholder="Or enter Pantopus user ID"
              className="flex-1 p-2.5 bg-app-surface-sunken border border-app-border rounded-lg text-sm text-app-text placeholder:text-app-text-muted"
            />
          </div>

          {/* Invite list */}
          {invites.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-app-text-muted mb-2">
                Sent invites ({invites.length})
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {invites.map((inv: any) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-app-surface-sunken text-sm"
                  >
                    <span className="text-app-text truncate">
                      {inv.User?.name || inv.invitee_email || inv.invitee_user_id}
                    </span>
                    <span
                      className={`text-xs capitalize px-2 py-0.5 rounded-full ${inv.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
                    >
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Donation Summary ── */}
        <section className="bg-app-surface border border-app-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-app-text mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-app-text-muted" />
            Gift Fund
          </h2>

          {!fund?.enabled ? (
            <p className="text-sm text-app-text-muted italic">
              Gift funds are not enabled for this train.
            </p>
          ) : (
            <>
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-3xl font-bold text-app-text">
                  ${(totalRaised / 100).toFixed(2)}
                </span>
                {goalAmount && (
                  <span className="text-sm text-app-text-secondary">
                    of ${(goalAmount / 100).toFixed(2)} goal
                  </span>
                )}
              </div>

              {goalPct !== null && (
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-4">
                  <div
                    className="bg-primary-600 h-2.5 rounded-full transition-all"
                    style={{ width: `${goalPct}%` }}
                  />
                </div>
              )}

              <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">
                Contributions ({contributions.length})
              </p>
              {contributions.length === 0 ? (
                <p className="text-sm text-app-text-muted italic">No contributions yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {contributions.map((c: any) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-2 px-2 rounded-lg bg-app-surface-sunken"
                    >
                      <div>
                        <span className="text-sm text-app-text">
                          {c.contributor?.name || 'Anonymous'}
                        </span>
                        {c.note && (
                          <p className="text-xs text-app-text-muted mt-0.5 truncate max-w-[200px]">
                            {c.note}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-app-text">
                        ${(c.amount / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* ── Reservation Table ── */}
      <section className="mt-8 bg-app-surface border border-app-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-app-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-app-text flex items-center gap-2">
            <Users className="w-5 h-5 text-app-text-muted" />
            Reservations ({reservations.length})
          </h2>
        </div>

        {reservations.length === 0 ? (
          <div className="p-8 text-center text-app-text-muted">No reservations yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-app-surface-sunken text-app-text-muted text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Helper</th>
                  <th className="text-left px-4 py-3">Contribution</th>
                  <th className="text-left px-4 py-3">Dish / Restaurant</th>
                  <th
                    className="text-left px-4 py-3 cursor-pointer select-none"
                    onClick={() => toggleSort('status')}
                  >
                    <span className="flex items-center gap-1">
                      Status <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                  <th
                    className="text-left px-4 py-3 cursor-pointer select-none"
                    onClick={() => toggleSort('created_at')}
                  >
                    <span className="flex items-center gap-1">
                      Date <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedReservations.map((r: any) => (
                  <tr
                    key={r.id}
                    className="border-t border-app-border hover:bg-app-surface-sunken/50 transition"
                  >
                    <td className="px-4 py-3 text-app-text font-medium">
                      {r.user?.name || r.guest_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-app-text-secondary capitalize">
                      {r.contribution_mode}
                    </td>
                    <td className="px-4 py-3 text-app-text-secondary">
                      {r.dish_title || r.restaurant_name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadgeClasses(r.status)}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-app-text-muted text-xs">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canDeleteSupportTrain && (
        <section className="mt-8 border border-red-200 dark:border-red-900/60 rounded-xl bg-red-50/60 dark:bg-red-950/20">
          <div className="p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-100 dark:bg-red-950/60 p-2">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-300" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-red-700 dark:text-red-200">
                  Danger zone
                </h2>
                <p className="mt-1 text-sm text-red-700/90 dark:text-red-200/90">
                  Delete is for trains created by mistake. Once helpers commit or gift funds arrive,
                  the backend blocks deletion so the campaign history stays intact.
                </p>
              </div>
            </div>

            <button
              onClick={handleDeleteSupportTrain}
              disabled={deleting || !!deleteDisabledReason}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-red-300 dark:border-red-800 px-4 py-2.5 text-sm font-medium text-red-700 dark:text-red-200 hover:bg-red-100/70 dark:hover:bg-red-950/40 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {deleting ? 'Deleting…' : 'Delete Support Train'}
            </button>
            <p className="mt-3 text-sm text-red-700/90 dark:text-red-200/90">
              {deleteDisabledReason ||
                'Permanent. This stays available only until the train has active helpers or gift fund contributions.'}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function statusBadgeClasses(status: string): string {
  switch (status) {
    case 'reserved':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200';
    case 'delivered':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200';
    case 'confirmed':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200';
    case 'canceled':
      return 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}
