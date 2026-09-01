'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, BarChart3, Lock, Trash2, CheckCircle, X } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

type PollTab = 'active' | 'closed';

function PollsContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<PollTab>('active');
  const [showCreate, setShowCreate] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);

  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState(['', '']);
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchPolls = useCallback(async () => {
    if (!homeId) return;
    try {
      const res = await api.homeProfile.getHomePolls(homeId);
      setPolls((res as any)?.polls || []);
    } catch { toast.error('Failed to load polls'); }
  }, [homeId]);

  useEffect(() => { setLoading(true); fetchPolls().finally(() => setLoading(false)); }, [fetchPolls]);

  const activePolls = polls.filter((p) => p.status === 'active' || p.status === 'open');
  const closedPolls = polls.filter((p) => p.status === 'closed' || p.status === 'resolved');
  const currentList = tab === 'active' ? activePolls : closedPolls;

  const updateOption = (idx: number, val: string) => setNewOptions(newOptions.map((o, i) => i === idx ? val : o));
  const addOption = () => { if (newOptions.length < 6) setNewOptions([...newOptions, '']); };
  const removeOption = (idx: number) => { if (newOptions.length > 2) setNewOptions(newOptions.filter((_, i) => i !== idx)); };

  const handleCreate = useCallback(async () => {
    const q = newQuestion.trim();
    const opts = newOptions.map((o) => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) { toast.warning('Need a question and at least 2 options'); return; }
    setCreating(true);
    try {
      await api.homeProfile.createHomePoll(homeId!, { question: q, options: opts });
      setNewQuestion(''); setNewOptions(['', '']); setShowCreate(false);
      toast.success('Poll created');
      await fetchPolls();
    } catch (err: any) { toast.error(err?.message || 'Failed to create poll'); }
    finally { setCreating(false); }
  }, [homeId, newQuestion, newOptions, fetchPolls]);

  const handleVote = useCallback(async (pollId: string, optionIndex: number) => {
    setVotingId(pollId);
    try {
      await api.homeProfile.voteOnPoll(homeId!, pollId, { option_index: optionIndex });
      await fetchPolls();
    } catch (err: any) { toast.error(err?.message || 'Failed to vote'); }
    finally { setVotingId(null); }
  }, [homeId, fetchPolls]);

  const closePoll = useCallback(async (pollId: string) => {
    const yes = await confirmStore.open({ title: 'Close Poll', description: 'Close this poll to new votes?', confirmLabel: 'Close', variant: 'primary' });
    if (!yes) return;
    try { await api.homeProfile.updateHomePoll(homeId!, pollId, { status: 'closed' }); toast.success('Poll closed'); await fetchPolls(); }
    catch { toast.error('Failed to close poll'); }
  }, [homeId, fetchPolls]);

  const deletePoll = useCallback(async (pollId: string) => {
    const yes = await confirmStore.open({ title: 'Delete Poll', description: 'Are you sure?', confirmLabel: 'Delete', variant: 'destructive' });
    if (!yes) return;
    try { await api.homeProfile.updateHomePoll(homeId!, pollId, { status: 'closed' }); await fetchPolls(); }
    catch { toast.error('Failed to delete poll'); }
  }, [homeId, fetchPolls]);

  const TABS: { key: PollTab; label: string; count: number }[] = [
    { key: 'active', label: 'Active', count: activePolls.length },
    { key: 'closed', label: 'Closed', count: closedPolls.length },
  ];

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
          <h1 className="text-xl font-bold text-app-text">Polls</h1>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition">
          <Plus className="w-4 h-4" /> New Poll
        </button>
      </div>

      {showCreate && (
        <div className="bg-app-surface border border-app-border rounded-xl p-4 mb-4 space-y-3">
          <input type="text" value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="What should we decide?" className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          <p className="text-xs font-semibold text-app-text-strong">Options</p>
          {newOptions.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input type="text" value={opt} onChange={(e) => updateOption(idx, e.target.value)} placeholder={`Option ${idx + 1}`}
                className="flex-1 px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              {newOptions.length > 2 && (
                <button type="button" onClick={() => removeOption(idx)} className="p-1 text-app-text-muted hover:text-red-500"><X className="w-4 h-4" /></button>
              )}
            </div>
          ))}
          {newOptions.length < 6 && (
            <button type="button" onClick={addOption} className="text-sm font-medium text-emerald-600 hover:text-emerald-700">+ Add Option</button>
          )}
          <button onClick={handleCreate} disabled={creating} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition">
            {creating ? 'Creating...' : 'Create Poll'}
          </button>
        </div>
      )}

      <div className="flex border-b border-app-border mb-4">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2.5 text-sm font-medium transition ${tab === t.key ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-app-text-secondary hover:text-app-text'}`}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {currentList.length === 0 ? (
        <div className="text-center py-16"><BarChart3 className="w-10 h-10 mx-auto text-app-text-muted mb-3" /><p className="text-sm text-app-text-secondary">{tab === 'active' ? 'No active polls' : 'No closed polls'}</p></div>
      ) : (
        <div className="space-y-4">
          {currentList.map((poll) => {
            const totalVotes = (poll.options || []).reduce((sum: number, o: any) => sum + (o.votes || 0), 0);
            const isActive = poll.status === 'active' || poll.status === 'open';
            const isVoting = votingId === poll.id;
            const maxPct = Math.max(0, ...(poll.options || []).map((o: any) => totalVotes ? Math.round((o.votes / totalVotes) * 100) : 0));

            return (
              <div key={poll.id} className="bg-app-surface border border-app-border rounded-xl p-5">
                <div className="mb-3">
                  <p className="text-base font-semibold text-app-text">{poll.question}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs text-app-text-secondary">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
                    {poll.created_at && <span className="text-xs text-app-text-muted">{new Date(poll.created_at).toLocaleDateString()}</span>}
                  </div>
                </div>

                <div className="space-y-2">
                  {(poll.options || []).map((opt: any, idx: number) => {
                    const pct = totalVotes ? Math.round((opt.votes / totalVotes) * 100) : 0;
                    const isWinner = !isActive && pct === maxPct && pct > 0;
                    return (
                      <button key={idx} type="button"
                        onClick={() => isActive && !opt.user_voted && !isVoting ? handleVote(poll.id, idx) : undefined}
                        disabled={!isActive || opt.user_voted || isVoting}
                        className={`relative w-full text-left border rounded-lg px-3.5 py-2.5 overflow-hidden transition ${
                          opt.user_voted ? 'border-emerald-500 bg-emerald-50' : 'border-app-border hover:border-app-border'
                        } ${!isActive ? 'opacity-80' : ''}`}>
                        <div className="flex items-center justify-between relative z-10">
                          <span className={`text-sm ${isWinner ? 'font-bold text-green-700' : 'text-app-text-strong'}`}>{opt.label || opt.text}</span>
                          <span className="text-sm font-semibold text-app-text-secondary ml-2">{pct}%</span>
                        </div>
                        <div className="h-1 bg-app-surface-sunken rounded-full mt-1.5 relative z-10">
                          <div className={`h-1 rounded-full transition-all ${isWinner ? 'bg-green-500' : opt.user_voted ? 'bg-emerald-500' : 'bg-gray-300'}`} style={{ width: `${pct}%` }} />
                        </div>
                        {opt.user_voted && (
                          <CheckCircle className="absolute top-2.5 right-2.5 w-4 h-4 text-emerald-500" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {isActive && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-app-border-subtle">
                    <button onClick={() => closePoll(poll.id)} className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700">
                      <Lock className="w-3.5 h-3.5" /> Close
                    </button>
                    <button onClick={() => deletePoll(poll.id)} className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PollsPage() { return <Suspense><PollsContent /></Suspense>; }
