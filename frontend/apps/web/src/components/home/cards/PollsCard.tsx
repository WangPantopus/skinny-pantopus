'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, ChevronLeft, Check } from 'lucide-react';
import * as api from '@pantopus/api';
import type { HomePoll } from '@pantopus/types';
import DashboardCard from '../DashboardCard';
import VisibilityChip from '../VisibilityChip';
import { toast } from '@/components/ui/toast-store';

// ---- Preview ----

export function PollsCardPreview({
  polls,
  onExpand,
}: {
  polls: Record<string, any>[];
  onExpand: () => void;
}) {
  const openPolls = polls.filter((p) => p.status === 'open');

  return (
    <DashboardCard
      title="Polls"
      icon={<BarChart3 className="w-5 h-5" />}
      visibility="members"
      count={openPolls.length}
      badge={openPolls.length > 0 ? `${openPolls.length} open` : undefined}
      onClick={onExpand}
    >
      {openPolls.length > 0 ? (
        <div className="space-y-1.5">
          {openPolls.slice(0, 2).map((p) => (
            <div key={p.id} className="text-sm text-app-text-strong truncate">{p.question}</div>
          ))}
          {openPolls.length > 2 && <p className="text-xs text-app-text-muted">+{openPolls.length - 2} more</p>}
        </div>
      ) : (
        <div className="text-center py-2">
          <div className="mb-1"><BarChart3 className="w-5 h-5 mx-auto text-app-text-muted" /></div>
          <p className="text-xs text-app-text-muted">No active polls</p>
        </div>
      )}
    </DashboardCard>
  );
}

// ---- Expanded ----

export default function PollsCard({
  homeId,
  onBack,
}: {
  homeId: string;
  onBack: () => void;
}) {
  const [polls, setPolls] = useState<HomePoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);

  const loadPolls = useCallback(async () => {
    try {
      const res = await api.homeProfile.getHomePolls(homeId);
      setPolls(res.polls || []);
    } catch {
      setPolls([]);
    }
    setLoading(false);
  }, [homeId]);

  useEffect(() => { loadPolls(); }, [loadPolls]);

  const handleVote = async (pollId: string, optionIndex: number) => {
    setVotingId(pollId);
    try {
      await api.homeProfile.voteOnPoll(homeId, pollId, { option_index: optionIndex });
      await loadPolls();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to vote');
    }
    setVotingId(null);
  };

  const handleClosePoll = async (pollId: string) => {
    try {
      await api.homeProfile.updateHomePoll(homeId, pollId, { status: 'closed' });
      await loadPolls();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to close poll');
    }
  };

  const openPolls = polls.filter((p) => p.status === 'open');
  const closedPolls = polls.filter((p) => p.status !== 'open');

  if (loading) {
    return <div className="text-center py-12 text-app-text-muted text-sm">Loading polls…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-app-text-secondary hover:text-app-text-strong transition flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          <h2 className="text-lg font-semibold text-app-text flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Polls</h2>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition"
        >
          + Create Poll
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreatePollForm
          homeId={homeId}
          onCreated={() => { setShowCreate(false); loadPolls(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Open polls */}
      {openPolls.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Active Polls</h3>
          <div className="space-y-3">
            {openPolls.map((poll) => (
              <PollItem
                key={poll.id}
                poll={poll}
                onVote={(idx) => handleVote(poll.id, idx)}
                onClose={() => handleClosePoll(poll.id)}
                voting={votingId === poll.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Closed polls */}
      {closedPolls.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Past Polls</h3>
          <div className="space-y-3">
            {closedPolls.map((poll) => (
              <PollItem key={poll.id} poll={poll} showResults />
            ))}
          </div>
        </div>
      )}

      {polls.length === 0 && !showCreate && (
        <div className="bg-app-surface rounded-xl border border-app-border p-8 text-center">
          <div className="mb-2"><BarChart3 className="w-8 h-8 mx-auto text-app-text-muted" /></div>
          <p className="text-sm text-app-text-secondary">No polls yet</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700"
          >
            + Create your first poll
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Poll Item ----

function PollItem({
  poll,
  onVote,
  onClose,
  voting,
  showResults,
}: {
  poll: Record<string, any>;
  onVote?: (idx: number) => void;
  onClose?: () => void;
  voting?: boolean;
  showResults?: boolean;
}) {
  const options = poll.options || [];
  const votes = poll.votes || [];
  const totalVotes = votes.length;
  const isClosed = poll.status !== 'open';
  const shouldShowResults = showResults || isClosed;

  // Count votes per option
  const voteCounts = options.map((_: unknown, i: number) =>
    votes.filter((v: Record<string, any>) => v.option_index === i).length
  );

  return (
    <div className="bg-app-surface rounded-xl border border-app-border shadow-sm p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-app-text">{poll.question}</div>
          <div className="flex items-center gap-2 mt-0.5">
            {poll.closes_at && (
              <span className="text-[10px] text-app-text-muted">
                {isClosed ? 'Closed' : `Closes ${new Date(poll.closes_at).toLocaleDateString()}`}
              </span>
            )}
            <span className="text-[10px] text-app-text-muted">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
            {poll.visibility && <VisibilityChip visibility={poll.visibility} />}
          </div>
        </div>
        {!isClosed && onClose && (
          <button
            onClick={onClose}
            className="text-[10px] text-app-text-muted hover:text-red-500 transition"
          >
            Close
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {options.map((option: string, i: number) => {
          const count = voteCounts[i] || 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const myVote = poll.my_vote_index === i;

          return (
            <div key={i} className="relative">
              {shouldShowResults ? (
                <div className="relative rounded-lg overflow-hidden">
                  <div
                    className={`absolute inset-0 ${myVote ? 'bg-blue-100' : 'bg-app-surface-sunken'}`}
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex items-center justify-between px-3 py-2">
                    <span className={`text-sm ${myVote ? 'font-semibold text-blue-700' : 'text-app-text-strong'}`}>
                      {option}
                      {myVote && <Check className="ml-1 w-3 h-3 inline" />}
                    </span>
                    <span className="text-xs text-app-text-secondary">{pct}%</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => onVote?.(i)}
                  disabled={voting}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${
                    myVote
                      ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                      : 'border-app-border text-app-text-strong hover:bg-app-hover'
                  } ${voting ? 'opacity-50' : ''}`}
                >
                  {option}
                  {myVote && <Check className="ml-1 w-3 h-3 inline" />}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Create Poll Form ----

function CreatePollForm({
  homeId,
  onCreated,
  onCancel,
}: {
  homeId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [closesAt, setClosesAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addOption = () => {
    if (options.length < 10) setOptions([...options, '']);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    const validOptions = options.filter((o) => o.trim());
    if (!question.trim()) { setError('Question is required'); return; }
    if (validOptions.length < 2) { setError('At least 2 options required'); return; }

    setSaving(true);
    setError('');
    try {
      await api.homeProfile.createHomePoll(homeId, {
        question: question.trim(),
        options: validOptions,
        closes_at: closesAt || undefined,
      });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create poll');
    }
    setSaving(false);
  };

  return (
    <div className="bg-app-surface rounded-xl border border-app-border shadow-sm p-4 space-y-3">
      <h3 className="text-sm font-semibold text-app-text">Create Poll</h3>

      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

      <div>
        <label className="block text-xs font-medium text-app-text-secondary mb-1">Question *</label>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full rounded-lg border border-app-border px-3 py-2 text-sm"
          placeholder="What should we decide?"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-app-text-secondary mb-1">Options *</label>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = e.target.value;
                  setOptions(next);
                }}
                className="flex-1 rounded-lg border border-app-border px-3 py-2 text-sm"
                placeholder={`Option ${i + 1}`}
              />
              {options.length > 2 && (
                <button
                  onClick={() => removeOption(i)}
                  className="text-app-text-muted hover:text-red-500 transition p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < 10 && (
          <button onClick={addOption} className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-700">
            + Add Option
          </button>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-app-text-secondary mb-1">Close Date (optional)</label>
        <input
          type="date"
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
          className="w-full rounded-lg border border-app-border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-app-text-secondary hover:text-app-text-strong">Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-4 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-40 transition"
        >
          {saving ? 'Creating…' : 'Create Poll'}
        </button>
      </div>
    </div>
  );
}
