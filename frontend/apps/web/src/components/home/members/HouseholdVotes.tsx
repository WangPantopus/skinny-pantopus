'use client';

// Household removal votes on the Members page (home claims plan, PR 5): the open votes this person was asked to
// decide, or that are about them. A voter sees only their own vote; nobody sees who started a vote or how anyone
// else voted. The member a vote is about keeps their access while it's open; a vote to remove takes effect only when
// it closes after 7 days, and they can contest it until then once they've proved the address.
import Link from 'next/link';
import { useState } from 'react';
import * as api from '@pantopus/api';
import type { HouseholdRemovalVote } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import { failureMessage } from '@/components/home/share/shareFailure';

// Day and time: a vote to remove takes effect when it closes, and contesting has to come before that.
const closesOn = (iso: string) => new Date(iso).toLocaleString(undefined,
  { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// A vote can end early only for keeping them (or because they left); a removal waits for it to close.
const OUTCOME_COPY: Record<string, string> = {
  kept: 'The household decided. They stay.',
  withdrawn: 'This vote ended: they’re no longer a member here.',
};

export default function HouseholdVotes({ homeId, votes, onChanged }: {
  homeId: string;
  votes: HouseholdRemovalVote[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  if (votes.length === 0) return null;

  const cast = async (vote: HouseholdRemovalVote, choice: 'remove' | 'keep') => {
    if (busy) return;
    if (choice === 'remove') {
      const yes = await confirmStore.open({
        title: 'Vote to remove them?',
        description: `If most of the household votes the same way, ${vote.member?.name || 'this member'} is removed when the vote closes on ${closesOn(vote.closes_at)}, not before, so they have time to contest it. Your vote is private, and you can change it until then.`,
        confirmLabel: 'Vote to remove',
        variant: 'destructive',
      });
      if (!yes) return;
    }
    setBusy(vote.id);
    try {
      const result = await api.homeOwnership.castRemovalVote(homeId, vote.id, choice);
      toast.success((result.outcome && OUTCOME_COPY[result.outcome]) || 'Your vote is saved.');
      onChanged();
    } catch (err: unknown) {
      toast.error(failureMessage(err, 'Your vote wasn’t saved. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  const contest = async (vote: HouseholdRemovalVote) => {
    if (busy) return;
    setBusy(vote.id);
    try {
      await api.homeOwnership.contestRemovalVote(homeId, vote.id);
      toast.success('You contested the vote. If it passes, Pantopus reviews it before anything changes.');
      onChanged();
    } catch (err: unknown) {
      toast.error(failureMessage(err, 'Your contest wasn’t saved. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="household-votes-heading" className="mb-4 space-y-2">
      <h2 id="household-votes-heading" className="text-xs font-bold uppercase tracking-wide text-app-text-secondary">Household votes</h2>
      {votes.map((vote) => vote.about_you ? (
        <div key={vote.id} className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">A household vote is open about you</p>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
            Residents started a vote on whether you live here. It closes on {closesOn(vote.closes_at)}, and you keep your access until then; if it passes, you’re removed then. Who voted is never shown.
          </p>
          {vote.contested ? (
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">You contested this vote. If it passes, Pantopus reviews it before anything changes.</p>
          ) : vote.can_contest ? (
            <>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">
                If you live here, contest it before it closes, and Pantopus reviews it instead of removing you.
              </p>
              <button type="button" disabled={busy === vote.id} onClick={() => void contest(vote)}
                className="mt-3 px-3 py-1.5 text-sm font-semibold rounded-lg bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-50">
                {busy === vote.id ? '…' : 'Contest this vote'}
              </button>
            </>
          ) : (
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">
              If you live here, <Link href={`/app/homes/${homeId}/verify-postcard`} className="underline font-medium">verify your address by mail</Link> and contest it before it closes.
            </p>
          )}
        </div>
      ) : (
        <div key={vote.id} className="bg-app-surface border border-app-border rounded-xl p-4">
          <p className="text-sm font-semibold text-app-text">Should {vote.member?.name || 'this member'} stay in this home?</p>
          <p className="text-xs text-app-text-secondary mt-1">
            Your vote is private. The vote closes on {closesOn(vote.closes_at)}; if most of the household votes to remove them, they’re removed then, not before, so they have time to contest it.
            {vote.contested && ' They contested it with proof of the address, so if it passes, Pantopus reviews it.'}
          </p>
          {vote.my_vote && (
            <p className="text-xs text-app-text-muted mt-1">
              You voted to {vote.my_vote === 'remove' ? 'remove them' : 'keep them'}. You can change your vote until it closes.
            </p>
          )}
          {vote.can_vote && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button type="button" disabled={busy === vote.id || vote.my_vote === 'keep'} onClick={() => void cast(vote, 'keep')}
                className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                Yes, they live here
              </button>
              <button type="button" disabled={busy === vote.id || vote.my_vote === 'remove'} onClick={() => void cast(vote, 'remove')}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-app-border text-red-700 dark:text-red-400 hover:bg-app-hover disabled:opacity-50">
                No, remove them
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
