'use client';

// Reusable per-tier editor card. Used by both the management page
// (/app/audience/manage/tiers) and the setup wizard's Step 2
// (/app/audience/setup). The component is purely controlled — the
// parent owns the form state and submits.

import type { OwnerTier, TierReplyPolicy } from '@pantopus/api';

export interface TierFormValues {
  name: string;
  description: string;
  priceCents: number;
  msgThreadsPerPeriod: number | null;
  replyPolicy: TierReplyPolicy;
  creatorCanInitiateDm: boolean;
}

const REPLY_POLICY_OPTIONS: ReadonlyArray<{ value: TierReplyPolicy; label: string }> = [
  { value: 'discretion',     label: "Replies at the creator's discretion" },
  { value: 'within_3_days',  label: 'Reply within 3 days' },
  { value: 'within_7_days',  label: 'Reply within 7 days' },
  { value: 'within_14_days', label: 'Reply within 14 days' },
  { value: 'always',         label: 'Every message gets a reply' },
];

interface TierEditorProps {
  tier: OwnerTier;
  values: TierFormValues;
  onChange: (next: TierFormValues) => void;
  disabled?: boolean;
}

export function tierToFormValues(tier: OwnerTier): TierFormValues {
  return {
    name: tier.name,
    description: tier.description ?? '',
    priceCents: tier.priceCents,
    msgThreadsPerPeriod: tier.msgThreadsPerPeriod,
    replyPolicy: tier.replyPolicy,
    creatorCanInitiateDm: tier.creatorCanInitiateDm,
  };
}

export function TierEditor({ tier, values, onChange, disabled }: TierEditorProps) {
  const isFreeFollower = tier.rank === 1;
  const isInsider = tier.rank === 3;

  const update = (patch: Partial<TierFormValues>) => onChange({ ...values, ...patch });

  return (
    <article
      className="rounded-lg border border-app-strong bg-surface p-5"
      aria-labelledby={`tier-${tier.id}-heading`}
      data-tier-rank={tier.rank}
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
            Rank {tier.rank}
          </p>
          <h3 id={`tier-${tier.id}-heading`} className="text-lg font-semibold text-app">
            {values.name || tier.name}
          </h3>
        </div>
        {tier.status !== 'active' ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
            {tier.status}
          </span>
        ) : null}
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-app-strong">Tier name</span>
          <input
            type="text"
            value={values.name}
            onChange={(e) => update({ name: e.target.value })}
            disabled={disabled}
            maxLength={60}
            className="rounded-md border border-app-strong bg-surface px-3 py-2 text-app outline-none focus:ring-2 focus:ring-teal-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-app-strong">Price (USD / month)</span>
          {isFreeFollower ? (
            <input
              type="text"
              value="Free"
              disabled
              aria-label="Tier price (free, not editable)"
              className="rounded-md border border-app-strong bg-app/50 px-3 py-2 text-app-secondary"
            />
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-app-strong bg-surface focus-within:ring-2 focus-within:ring-teal-500">
              <span className="pl-3 text-app-secondary">$</span>
              <input
                type="number"
                min={1}
                max={500}
                step={1}
                value={Math.round(values.priceCents / 100)}
                onChange={(e) => {
                  const dollars = Math.max(1, Math.min(500, Number(e.target.value) || 0));
                  update({ priceCents: dollars * 100 });
                }}
                disabled={disabled}
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-app outline-none"
              />
              <span className="pr-3 text-xs text-app-secondary">/ mo</span>
            </div>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-app-strong">Description</span>
          <textarea
            rows={2}
            value={values.description}
            onChange={(e) => update({ description: e.target.value })}
            disabled={disabled}
            maxLength={500}
            className="resize-none rounded-md border border-app-strong bg-surface px-3 py-2 text-app outline-none focus:ring-2 focus:ring-teal-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-app-strong">
            {isFreeFollower ? 'Message threads (not available on Follower)' : 'Message threads / month'}
          </span>
          <input
            type="number"
            min={0}
            max={1000}
            step={1}
            value={values.msgThreadsPerPeriod ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0);
              update({ msgThreadsPerPeriod: v });
            }}
            disabled={disabled || isFreeFollower}
            className="rounded-md border border-app-strong bg-surface px-3 py-2 text-app outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-app/50 disabled:text-app-secondary"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-app-strong">Reply policy</span>
          <select
            value={values.replyPolicy}
            onChange={(e) => update({ replyPolicy: e.target.value as TierReplyPolicy })}
            disabled={disabled}
            className="rounded-md border border-app-strong bg-surface px-3 py-2 text-app outline-none focus:ring-2 focus:ring-teal-500"
          >
            {REPLY_POLICY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        {isInsider ? (
          <label className="flex items-start gap-3 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={values.creatorCanInitiateDm}
              onChange={(e) => update({ creatorCanInitiateDm: e.target.checked })}
              disabled={disabled}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-app-strong">
                Allow myself to start DM threads with these members
              </span>
              <span className="block text-app-secondary">
                Insider members can be reached by you directly without using their quota.
              </span>
            </span>
          </label>
        ) : null}
      </div>
    </article>
  );
}

export default TierEditor;
