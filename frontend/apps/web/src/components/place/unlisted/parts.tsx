// ============================================================
// UNLISTED — the shared presentation, used by BOTH the anonymous page
// (/unlisted) and the claimed-home surface (Identity detail).
//
// WHO IS READING THIS. Someone typing their home address into a page
// called "get my address off the internet" is disproportionately likely
// to be doing it because of a specific person they are afraid of. Every
// rule below follows from that, and none of them is stylistic:
//
//   1. THE STATE PROGRAM LEADS, always above the broker list. An Address
//      Confidentiality Program is a legal substitute address that fixes
//      this at the SOURCE. For this reader it is worth more than every
//      opt-out link combined.
//   2. THE THREE STATE ANSWERS READ DIFFERENTLY. A program / we checked
//      and there is none / we did not check. Collapsing the third into
//      the second tells someone in danger that no help exists when we
//      simply did not look.
//   3. WE NEVER SAY OR IMPLY THE PERSON IS LISTED ANYWHERE. We do not
//      query these sites — that would hand them the address. The
//      server's `method_note` says so and is rendered verbatim, next to
//      the list it is about.
//   4. THE CAVEATS TRAVEL. Each broker's `note` is the thing the person
//      actually needs (a dead form, a flow verified only to step one, a
//      site that relists you). It is rendered in full, never trimmed as
//      clutter.
//   5. NO DARK PATTERNS. The state program is never behind a signup,
//      there is no countdown or manufactured urgency, and nothing here
//      implies Pantopus removes anything on anyone's behalf.
// ============================================================

'use client';

import type { ReactNode } from 'react';
import type {
  UnlistedBroker,
  UnlistedProfile,
  UnlistedRemovalMethod,
  UnlistedRemovalStatus,
  UnlistedStateProgram,
} from '@pantopus/api';
import {
  ShieldCheck,
  ExternalLink,
  Landmark,
  HelpCircle,
  Info,
  IdCard,
  Mail,
  Phone,
  Send,
  UserRound,
  Clock,
  DoorOpen,
  EyeOff,
} from 'lucide-react';
import Chip from '@/components/archetypes/primitives/Chip';
import { leaveNow } from '@/lib/quickExit';

// ── Small formatting helpers ────────────────────────────────

const METHOD_LABEL: Record<UnlistedRemovalMethod, string> = {
  web_form: 'Online form',
  email: 'By email',
  phone: 'By phone',
  mail: 'By post',
  account_required: 'Account required',
};

const METHOD_ICON: Record<UnlistedRemovalMethod, typeof Mail> = {
  web_form: Send,
  email: Mail,
  phone: Phone,
  mail: Mail,
  account_required: UserRound,
};

/**
 * `typical_days === 0` means the site publishes NO processing time.
 * Saying "0 days" would read as instant, which is the opposite of true.
 */
export function processingTime(days: number): string {
  if (!days || days <= 0) return 'No processing time stated';
  return days === 1 ? 'Usually about a day' : `Usually about ${days} days`;
}

export function fmtDay(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function exposureText(tokens: string[], labels: Record<string, string>): string {
  return tokens.map((t) => labels[t] ?? t.replace(/_/g, ' ')).join(' · ');
}

// ── Quick exit — web page only ──────────────────────────────
//
// `location.replace` (see @/lib/quickExit), not `assign`: this page must
// not be left sitting in the back stack. The label says exactly what it
// does and, just as importantly, what it does not do — it cannot clear
// browsing history, and a control that implied otherwise would be
// dangerous for the person relying on it.

export function QuickExit({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-end ${className}`}>
      <button
        type="button"
        onClick={() => leaveNow()}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-app-border bg-app-surface text-app-text-strong text-[13px] font-semibold shadow-sm hover:bg-app-hover transition"
      >
        <DoorOpen size={15} strokeWidth={2.25} />
        Quick exit
      </button>
      <span className="text-[11.5px] leading-[16px] text-app-text-muted mt-1 text-right max-w-[190px]">
        Leaves now, and keeps this page out of your back button. It cannot erase your browsing history.
      </span>
    </div>
  );
}

// ── The state program — ALWAYS above the broker list ─────────

/**
 * Answer 1 of 3: the state runs a program. The most valuable thing on
 * the page, so it gets the loudest card and the direct official link.
 */
function ProgramExists({ program, state }: { program: UnlistedStateProgram; state: string | null }) {
  return (
    <div className="bg-app-surface border border-app-home-bg rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3.5 bg-app-home-bg/60">
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 rounded-xl bg-app-surface border border-app-success-light flex items-center justify-center shrink-0">
            <ShieldCheck size={22} strokeWidth={2} className="text-app-home" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-app-home">
                {state ? `${state} · ` : ''}Start here
              </span>
            </div>
            <h3 className="text-[17.5px] font-bold text-app-text leading-[23px] -tracking-[0.012em] mt-0.5">
              {program.name}
            </h3>
            <p className="text-[13.5px] text-app-text-strong leading-[20px] mt-1.5">
              A legal substitute address. Instead of chasing your address across thirty sites forever, the state
              gives you an address to use on public records, and forwards your mail.
            </p>
          </div>
        </div>
      </div>
      <div className="px-4 py-3.5">
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-app-text-muted">Who qualifies</div>
        <p className="text-[13.5px] text-app-text-secondary leading-[20px] mt-1">{program.eligibility}</p>
        {program.url ? (
          <a
            href={program.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 h-11 px-4 rounded-xl bg-primary-600 text-white text-[14.5px] font-semibold hover:bg-primary-700 transition"
          >
            Open the official {state ? `${state} ` : ''}program page
            <ExternalLink size={15} strokeWidth={2.25} />
          </a>
        ) : null}
        <VerifiedFrom sourceUrl={program.source_url} verifiedAt={program.verified_at} />
      </div>
    </div>
  );
}

/**
 * Answer 2 of 3: we checked, and this state runs no substitute-address
 * program. `eligibility` carries what it DOES offer, which is the only
 * useful thing left to say, so it is the body of the card.
 */
function ProgramNone({ program, state }: { program: UnlistedStateProgram; state: string | null }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-xl bg-app-surface-sunken flex items-center justify-center shrink-0">
          <Landmark size={22} strokeWidth={2} className="text-app-text-muted" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold text-app-text leading-[21px] -tracking-[0.01em]">
            {state ?? 'This state'} has no substitute-address program
          </h3>
          {/* Not "the state's own sources": three of the no-program
              entries rest on a national program-operator directory, not
              on a page the state publishes. The Source link below says
              exactly what was checked — the copy must not overstate it. */}
          <p className="text-[13px] text-app-text-muted leading-[19px] mt-1">
            We checked the published program sources. Here is what the state does offer instead.
          </p>
        </div>
      </div>
      <p className="text-[13.5px] text-app-text-strong leading-[20px] mt-3 pt-3 border-t border-app-border-subtle">
        {program.eligibility}
      </p>
      <VerifiedFrom sourceUrl={program.source_url} verifiedAt={program.verified_at} />
    </div>
  );
}

/**
 * Answer 3 of 3, and the one that must never be confused with answer 2:
 * we have NOT confirmed a program for this state. Saying "your state has
 * none" here would tell someone in danger that no help exists when we
 * simply did not look.
 */
function ProgramUnknown({ state }: { state: string | null }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-xl bg-app-surface-sunken flex items-center justify-center shrink-0">
          <HelpCircle size={22} strokeWidth={2} className="text-app-text-muted" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold text-app-text leading-[21px] -tracking-[0.01em]">
            We have not confirmed a program for {state ?? 'your state'}
          </h3>
          <p className="text-[13.5px] text-app-text-strong leading-[20px] mt-1.5">
            That is not the same as there being none — we simply have not verified this state yet, so we will not
            tell you either way.
          </p>
          <p className="text-[13px] text-app-text-secondary leading-[19px] mt-2">
            Most states run an Address Confidentiality Program: a legal substitute address for survivors of
            domestic violence, sexual assault, stalking or trafficking. Your Secretary of State&apos;s office, or a
            local victim-services advocate, can tell you whether yours does and help you apply.
          </p>
        </div>
      </div>
    </div>
  );
}

/** The escape hatch, in whichever of its three honest forms applies. */
export function StateProgramSection({ profile }: { profile: UnlistedProfile }) {
  const program = profile.state_program;
  // BOTH confident branches require an explicit boolean. A missing
  // `exists` is not evidence of anything — it is an unread field, and a
  // falsy check would have printed a sourced "we checked, your state
  // offers nothing" off a value nobody ever read. The two native
  // clients guard this identically.
  if (program == null) return <ProgramUnknown state={profile.state} />;
  if (program.exists === true) return <ProgramExists program={program} state={profile.state} />;
  if (program.exists === false) return <ProgramNone program={program} state={profile.state} />;
  return <ProgramUnknown state={profile.state} />;
}

// ── The honesty line, rendered verbatim ─────────────────────

/**
 * `method_note` verbatim, next to the list it describes. Without it the
 * page implies a scan it never performed. It is not paraphrased and it
 * is not collapsed behind a disclosure.
 */
export function MethodNote({ note }: { note: string }) {
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl border border-app-info-light bg-app-info-bg">
      <EyeOff size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-app-info" />
      <p className="text-[13px] leading-[19px] text-app-text-strong">{note}</p>
    </div>
  );
}

function VerifiedFrom({ sourceUrl, verifiedAt }: { sourceUrl?: string; verifiedAt?: string }) {
  if (!sourceUrl && !verifiedAt) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2.5 text-[12px] text-app-text-muted">
      {sourceUrl ? (
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-app-text-secondary">
          Source
        </a>
      ) : null}
      {sourceUrl && verifiedAt ? <span className="opacity-50">·</span> : null}
      {verifiedAt ? <span>Checked {fmtDay(verifiedAt)}</span> : null}
    </div>
  );
}

// ── One broker ──────────────────────────────────────────────

export const REMOVAL_STATUS_META: Record<
  UnlistedRemovalStatus,
  { label: string; action: string; variant: 'neutral' | 'warning' | 'success' | 'error' }
> = {
  todo: { label: 'Not started', action: 'Not started', variant: 'neutral' },
  requested: { label: 'Removal asked for', action: 'I asked', variant: 'warning' },
  confirmed: { label: 'Confirmed removed', action: 'Confirmed gone', variant: 'success' },
  relisted: { label: 'Back again', action: 'It came back', variant: 'error' },
};

const STATUS_ORDER: UnlistedRemovalStatus[] = ['todo', 'requested', 'confirmed', 'relisted'];

export interface BrokerCardProps {
  broker: UnlistedBroker;
  exposureLabels: Record<string, string>;
  /** Claimed-home only: the resident's own bookkeeping for this site. */
  status?: UnlistedRemovalStatus;
  onStatus?: (status: UnlistedRemovalStatus) => void;
  busy?: boolean;
}

export function BrokerCard({ broker, exposureLabels, status, onStatus, busy }: BrokerCardProps) {
  const MethodIcon = METHOD_ICON[broker.method] ?? Send;
  const meta = status ? REMOVAL_STATUS_META[status] : null;

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15.5px] font-semibold text-app-text -tracking-[0.01em]">{broker.name}</span>
            {meta ? <Chip label={meta.label} variant={meta.variant} /> : null}
          </div>
          {/* LexisNexis declares no exposure tokens (its suppression
              route is restricted, not a listing), so an unguarded line
              rendered a dangling "Publishes ". iOS already guards this. */}
          {broker.exposes.length > 0 ? (
            <div className="text-[12.5px] text-app-text-muted leading-[18px] mt-1">
              Publishes {exposureText(broker.exposes, exposureLabels)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
        <Chip label={METHOD_LABEL[broker.method] ?? broker.method} variant="neutral" icon={MethodIcon} />
        <Chip label={processingTime(broker.typical_days)} variant="neutral" icon={Clock} />
        {broker.requires_id ? <Chip label="Wants a photo ID" variant="warning" icon={IdCard} /> : null}
        {broker.requires_email ? <Chip label="Wants an email address" variant="neutral" icon={Mail} /> : null}
      </div>

      {/* The caveat is the point. Rendered whole — never truncated. */}
      {broker.note ? (
        <div className="flex items-start gap-2 mt-3 px-3 py-2.5 rounded-[11px] bg-app-surface-muted border border-app-border-subtle">
          <Info size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-app-text-muted" />
          <p className="text-[12.5px] leading-[18px] text-app-text-secondary">{broker.note}</p>
        </div>
      ) : null}

      <a
        href={broker.opt_out_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 mt-3 h-10 px-3.5 rounded-[10px] border-[1.5px] border-app-border bg-app-surface text-app-text text-[13.5px] font-semibold hover:bg-app-hover transition"
      >
        Open their opt-out
        <ExternalLink size={14} strokeWidth={2.25} />
      </a>

      {onStatus ? (
        <div className="mt-3 pt-3 border-t border-app-border-subtle">
          <div className="text-[12px] font-semibold text-app-text-secondary mb-1.5">Where you got to</div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Your progress with ${broker.name}`}>
            {STATUS_ORDER.map((s) => {
              const active = (status ?? 'todo') === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onStatus(s)}
                  disabled={busy}
                  aria-pressed={active}
                  className={`h-9 px-3 rounded-[10px] text-[12.5px] font-semibold border-[1.5px] transition disabled:opacity-50 ${
                    active
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-app-border bg-app-surface text-app-text-secondary hover:bg-app-hover'
                  }`}
                >
                  {REMOVAL_STATUS_META[s].action}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <VerifiedFrom sourceUrl={broker.source_url} verifiedAt={broker.verified_at} />
    </div>
  );
}

// ── The grouped list ────────────────────────────────────────

export interface BrokerGroupsProps {
  profile: UnlistedProfile;
  /** Claimed-home only. */
  statusFor?: (brokerId: string) => UnlistedRemovalStatus | undefined;
  onStatus?: (brokerId: string, status: UnlistedRemovalStatus) => void;
  busyBrokerId?: string | null;
}

export function BrokerGroups({ profile, statusFor, onStatus, busyBrokerId }: BrokerGroupsProps) {
  if (!profile.groups.length) return null;
  return (
    <>
      {profile.groups.map((group) => (
        <section key={group.category} className="mt-5">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-app-text-muted px-1 mb-2">
            {group.label}
          </h3>
          <div className="flex flex-col gap-2.5">
            {group.brokers.map((broker) => (
              <BrokerCard
                key={broker.id}
                broker={broker}
                exposureLabels={profile.exposure_labels}
                status={statusFor ? statusFor(broker.id) : undefined}
                onStatus={onStatus ? (s) => onStatus(broker.id, s) : undefined}
                busy={busyBrokerId === broker.id}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

// ── Shared footnote ─────────────────────────────────────────

/**
 * The line that keeps the product honest: every removal happens on the
 * broker's own site, by the person. We track what they tell us, and
 * nothing more.
 */
export function WeDoNotRemoveNote({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-start gap-2 mt-4 px-3.5 py-3 rounded-xl border border-app-border bg-app-surface">
      <Info size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-app-text-muted" />
      <span className="text-[12.5px] leading-[18px] text-app-text-secondary">
        {children ?? (
          <>
            Every removal happens on the site&apos;s own form — Pantopus does not submit anything on your behalf and
            cannot remove you. Sites also relist people, so it is worth re-checking the ones that matter.
          </>
        )}
      </span>
    </div>
  );
}
