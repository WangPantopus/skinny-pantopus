import type { HomePoll } from '@pantopus/types';

// Match the option keys used by the native clients and backend vote summaries.
// Older polls can store plain labels; newer options can also have explicit IDs.
export function homePollOptions(poll: HomePoll) {
  return poll.options.map((option) => {
    const label = typeof option === 'string' ? option : option.label;
    const key = typeof option === 'string' ? option : String(option.id ?? label);
    return {
      key,
      label,
      count: poll.option_counts?.[key] ?? 0,
      selected: poll.my_vote?.some((vote) => String(vote) === key) ?? false,
    };
  });
}

export function isHomePollOpen(poll: Pick<HomePoll, 'status' | 'closes_at'>) {
  return poll.status === 'open' && (!poll.closes_at || new Date(poll.closes_at).getTime() > Date.now());
}
