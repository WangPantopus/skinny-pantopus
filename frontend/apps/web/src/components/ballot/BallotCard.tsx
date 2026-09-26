// ============================================================
// Place — "Your ballot" (Board: Place: Your ballot card, and the
// proposed P0 states board). Measured from the canvas: a white card
// with a 1px border, radius 20, padding 16 and rows 14 apart (12 in
// the compact states); a 34px home-green tile; 15/600 title over a
// 12.5 subtitle; a "N days" pill; the deadline timeline; the primary
// button (44 tall, radius 12); the sunken links well (radius 14); the
// 12px source line.
//
// Every sentence comes from the server (civic_election, ballot_p0).
// This component lays it out and draws nothing it wasn't given.
// ============================================================

'use client';

import { Calendar, ExternalLink } from 'lucide-react';
import type {
  BallotDeadline,
  BallotGovernments,
  BallotMoverPrompt,
  BallotOfficialLink,
  BallotPrimaryAction,
  BallotTeaser,
  BallotWeek,
  PlaceBallotElectionData,
} from '@pantopus/types';
import { BallotTile } from './BallotGlyph';
import DeadlineTimeline from './DeadlineTimeline';
import { asOfLabel } from './format';

export const CARD_FRAME =
  'rounded-2xl border border-app-border bg-app-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col';

// ── Tolerant reading, as the iOS and Android decoders do: a malformed
// field is dropped, never the card and never the page around it. ──
type Loose = Record<string, unknown>;
const record = (v: unknown): Loose | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Loose) : null);
const text = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const httpsUrl = (v: unknown): string | null => (typeof v === 'string' && /^https:\/\/\S+$/.test(v) ? v : null);

/** Every item, or none: one bad item drops the list, as a native decode does. */
function listOf<T>(v: unknown, read: (item: unknown) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const items = v.map(read);
  return items.every((item): item is T => item !== null) ? items : [];
}

function readDeadline(v: unknown): BallotDeadline | null {
  const o = record(v);
  if (!o || !text(o.key) || !text(o.label) || !text(o.date) || !text(o.month_day) || num(o.days_until) === null) return null;
  if (typeof o.needs_action !== 'boolean' || typeof o.timeline !== 'boolean') return null;
  return o as unknown as BallotDeadline;
}

function readLink(v: unknown): BallotOfficialLink | null {
  const o = record(v);
  const url = o && httpsUrl(o.url);
  if (!o || !url || !text(o.key) || !text(o.label) || !text(o.owner)) return null;
  return { key: o.key as string, label: o.label as string, owner: o.owner as string, url };
}

/** The governments view's data (Place card and the Civic page's row). */
export function ballotGovernments(v: unknown): BallotGovernments | null {
  const o = record(v);
  const count = o && num(o.count);
  if (!o || count === null || count < 1 || typeof o.count_is_minimum !== 'boolean') return null;
  if (!text(o.summary) || !text(o.caveat) || !text(o.source_line)) return null;
  const items = listOf(o.items, (item) => {
    const g = record(item);
    return g && text(g.level) && text(g.name) ? (g as unknown as BallotGovernments['items'][number]) : null;
  });
  return items.length ? ({ ...o, count, items } as unknown as BallotGovernments) : null;
}

function readAction(v: unknown): BallotPrimaryAction | null {
  const o = record(v);
  if (!o || !text(o.label) || (o.kind !== 'governments' && o.kind !== 'link')) return null;
  if (o.kind === 'link' && !httpsUrl(o.url)) return null;
  return o as unknown as BallotPrimaryAction;
}

function readWeek(v: unknown): BallotWeek {
  const o = record(v);
  if (!o || o.show !== true) return { show: false };
  return { show: true, overline: text(o.overline) ?? undefined, title: text(o.title) ?? undefined, body: text(o.body) ?? undefined };
}

function readMover(v: unknown): BallotMoverPrompt | null {
  const o = record(v);
  const days = o && num(o.days_left);
  if (!o || !text(o.text) || days === null) return null;
  return { text: o.text as string, days_left: days, url: httpsUrl(o.url) };
}

/** The /start teaser (`ballot_teaser`), or null when absent or unusable. */
export function ballotTeaserData(v: unknown): BallotTeaser | null {
  const o = record(v);
  if (!o || (o.coverage !== 'supported' && o.coverage !== 'links_only') || !text(o.headline) || !text(o.source_line)) return null;
  const next = record(o.next_deadline);
  const days = next && num(next.days_left);
  return {
    ...(o as unknown as BallotTeaser),
    note: text(o.note),
    next_deadline: next && text(next.lead) && days !== null
      ? { key: text(next.key) ?? '', lead: next.lead as string, days_left: days, detail: text(next.detail) }
      : null,
    governments: ballotGovernments(o.governments),
    primary_action: readAction(o.primary_action),
  };
}

/**
 * The Ballot P0 card from a civic_election payload, or null when the
 * server sent none. Each field is checked on its own.
 */
export function ballotCardData(data: unknown): PlaceBallotElectionData | null {
  const d = record(data);
  if (!d || (d.coverage !== 'supported' && d.coverage !== 'links_only')) return null;
  if (d.phase !== 'far' && d.phase !== 'in_season' && d.phase !== 'election_day' && d.phase !== 'after') return null;
  const notice = record(d.election_day_notice);
  return {
    ...(d as unknown as PlaceBallotElectionData),
    today: text(d.today) ?? undefined,
    title: text(d.title) ?? undefined,
    subtitle: text(d.subtitle) ?? undefined,
    chip: text(d.chip),
    line: text(d.line),
    note: text(d.note),
    how_it_works: text(d.how_it_works),
    deadlines: listOf(d.deadlines, readDeadline),
    election_day_notice: notice && text(notice.lead) ? { lead: notice.lead as string, detail: text(notice.detail) ?? '' } : null,
    primary_action: readAction(d.primary_action),
    official_links: listOf(d.official_links, readLink),
    governments: ballotGovernments(d.governments),
    ballot_week: readWeek(d.ballot_week),
    mover_prompt: readMover(d.mover_prompt),
    source_line: text(d.source_line) ?? undefined,
  };
}

export function BallotHeader({ title, subtitle, chip }: { title: string; subtitle?: string; chip?: string | null }) {
  return (
    <div className="flex items-center gap-[10px]">
      <BallotTile />
      <div className="flex min-w-0 flex-grow flex-col">
        <span className="text-[15px] font-semibold leading-[normal] text-app-text">{title}</span>
        {subtitle ? <span className="text-[12.5px] leading-[normal] text-app-text-secondary">{subtitle}</span> : null}
      </div>
      {chip ? (
        <span className="shrink-0 rounded-full bg-app-surface-sunken px-[9px] py-[3px] text-[12px] font-semibold leading-[normal] text-app-text-strong">
          {chip}
        </span>
      ) : null}
    </div>
  );
}

export function LinksWell({ links }: { links: BallotOfficialLink[] }) {
  if (!links.length) return null;
  return (
    <div className="flex flex-col rounded-[14px] bg-app-surface-sunken">
      {links.map((link, i) => (
        <a
          key={`${link.key}-${link.url}`}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-between gap-2 p-3 text-app-text no-underline hover:text-app-text ${
            i < links.length - 1 ? 'border-b border-app-border' : ''
          }`}
        >
          <span className="flex flex-col">
            <span className="text-[14px] font-medium leading-[normal]">{link.label}</span>
            <span className="text-[12px] leading-[normal] text-app-text-secondary">{link.owner}</span>
          </span>
          <ExternalLink size={16} strokeWidth={2} className="shrink-0 text-app-text-secondary" aria-hidden="true" />
          <span className="sr-only">(opens the official site)</span>
        </a>
      ))}
    </div>
  );
}

export function NoticeWell({ lead, detail }: { lead: string; detail?: string | null }) {
  return (
    <div className="flex items-center gap-[10px] rounded-[14px] bg-app-warning-bg px-3 py-[10px] text-app-warning">
      <Calendar size={18} strokeWidth={2} className="shrink-0" aria-hidden="true" />
      <span className="text-[13.5px] leading-[19px]">
        <strong className="font-semibold">{lead}</strong>
        {detail ? ` ${detail}` : null}
      </span>
    </div>
  );
}

export interface BallotCardProps {
  data: PlaceBallotElectionData;
  /** The section envelope's as_of. */
  asOf?: string | null;
  onOpenGovernments?: () => void;
  className?: string;
}

export default function BallotCard({ data, asOf = null, onOpenGovernments, className = '' }: BallotCardProps) {
  const phase = data.phase;
  const inSeason = phase === 'in_season' && data.coverage === 'supported';
  const when = asOfLabel(asOf);
  const source = data.source_line ? `${data.source_line}${when ? ` · as of ${when}` : ''}` : null;
  const timeline = inSeason && data.deadlines && data.today ? data.deadlines : null;

  return (
    <section
      aria-label={data.title || 'Your ballot'}
      className={`${CARD_FRAME} ${inSeason || phase === 'election_day' ? 'gap-[14px]' : 'gap-3'} ${className}`}
    >
      <BallotHeader title={data.title || 'Your ballot'} subtitle={data.subtitle || data.name} chip={data.chip} />

      {data.line ? <div className="text-[15px] font-medium leading-[21px] text-app-text">{data.line}</div> : null}

      {timeline && data.today ? <DeadlineTimeline deadlines={timeline} today={data.today} /> : null}

      {data.election_day_notice ? <NoticeWell lead={data.election_day_notice.lead} detail={data.election_day_notice.detail} /> : null}

      {data.how_it_works ? (
        <div className="text-[13.5px] leading-[19px] text-app-text-strong">{data.how_it_works}</div>
      ) : null}

      {data.note ? <div className="text-[13.5px] leading-[19px] text-app-text-strong">{data.note}</div> : null}

      {data.primary_action && data.primary_action.kind === 'governments' && onOpenGovernments ? (
        <button
          type="button"
          onClick={onOpenGovernments}
          className="flex h-11 items-center justify-center rounded-lg bg-primary-700 text-[15px] font-semibold leading-[normal] text-white hover:bg-primary-800"
        >
          {data.primary_action.label}
        </button>
      ) : null}

      <LinksWell links={data.official_links ?? []} />

      {source ? <div className="text-[12px] leading-4 text-app-text-muted">{source}</div> : null}
    </section>
  );
}
