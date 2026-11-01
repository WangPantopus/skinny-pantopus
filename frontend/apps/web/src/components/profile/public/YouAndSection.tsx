'use client';

import Link from 'next/link';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HandHeart, Wrench } from 'lucide-react';
import * as api from '@pantopus/api';
import { buildPlanPath } from '@pantopus/utils';
import { KindGlyph, kindColors } from '@/components/plans/planKind';
import { queryKeys } from '@/lib/query-keys';
import ProfileAvatar from './atoms/ProfileAvatar';
import { firstWord } from './ProfileHeader';

type InCommon = api.users.UserInCommon;

interface YouAndSectionProps {
  /** The person's account id. */
  personId: string;
  /** The signed-in viewer's account id: it says who hosts a plan you share. */
  viewerId: string;
  /** Their first name as neighbors see it: "You and Rowan". */
  firstName: string;
  /** A signed-in visitor only: never your own profile, signed out, a preview or a block. */
  enabled: boolean;
}

interface Line {
  key: string;
  icon: ReactNode;
  /** The icon's width in px when it is wider than one circle (overlapping photos). */
  iconWidth?: number;
  text: ReactNode;
  detail?: string | null;
  href?: string;
}

const MAX_LINES = 2;
/** A photo in the people line (px, as photos are drawn), and how much each overlapping one after the first adds. */
const PHOTO = 30;
const OVERLAP_STEP = 20;

function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold">{children}</strong>;
}

/** "A", "A and B", "A, B and C". */
function listOf(items: ReactNode[]): ReactNode {
  return items.map((item, index) => (
    <Fragment key={index}>
      {index === 0 ? null : index === items.length - 1 ? ' and ' : ', '}
      {item}
    </Fragment>
  ));
}

function IconCircle({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <span className={`w-[1.875rem] h-[1.875rem] shrink-0 rounded-full flex items-center justify-center ${className ?? ''}`} style={style}>
      {children}
    </span>
  );
}

/** When the plan starts, in the viewer's time: "Thu, Nov 5, 10:00 AM". */
function planWhen(startsAt: string | null): string | null {
  if (!startsAt) return null;
  const at = new Date(startsAt);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * One line for each kind of common ground there is, in this order: the soonest plan you're both in, a Support Train you
 * both help on, people you both know, skills you share.
 */
function linesFor(data: InCommon, viewerId: string, personId: string, firstName: string): Line[] {
  const lines: Line[] = [];
  const plan = data.plans?.[0];
  if (plan) {
    const title = <Strong>{plan.title || 'a plan'}</Strong>;
    lines.push({
      key: `plan:${plan.id}`,
      icon: (
        <IconCircle className="bg-[var(--plan-cs)] text-[var(--plan-c)]" style={kindColors(plan.kind)}>
          <KindGlyph kind={plan.kind} className="w-4 h-4" />
        </IconCircle>
      ),
      text: plan.host_id === viewerId
        ? <>{firstName}&rsquo;s going to your {title}</>
        : plan.host_id === personId
          ? <>You&rsquo;re going to {firstName}&rsquo;s {title}</>
          : <>You&rsquo;re both going to {title}</>,
      detail: planWhen(plan.starts_at),
      href: buildPlanPath(plan.id),
    });
  }
  const train = data.support_trains?.[0];
  if (train) {
    lines.push({
      key: `train:${train.id}`,
      icon: (
        <IconCircle className="bg-app-home-bg text-app-home">
          <HandHeart aria-hidden="true" className="w-4 h-4" strokeWidth={2} />
        </IconCircle>
      ),
      text: <>You both signed up to help with <Strong>{train.title || 'a Support Train'}</Strong></>,
      href: `/app/support-trains/${encodeURIComponent(train.id)}`,
    });
  }
  const count = data.connections?.count ?? 0;
  if (count > 0) {
    const people = (data.connections?.people ?? []).slice(0, 2);
    const others = Math.max(0, count - people.length);
    const names: ReactNode[] = people.map((person) => <Strong key={person.id}>{firstWord(person.name || 'A neighbor')}</Strong>);
    if (others > 0 && names.length) names.push(`${others} ${others === 1 ? 'other' : 'others'}`);
    lines.push({
      key: 'connections',
      iconWidth: PHOTO + OVERLAP_STEP * (people.length + (others > 0 ? 1 : 0) - 1),
      icon: (
        <span className="flex">
          {people.map((person, index) => (
            <ProfileAvatar
              key={person.id}
              name={person.name}
              seed={person.id}
              photoUrl={person.avatar_url}
              size={30}
              className={`ring-2 ring-app-surface ${index > 0 ? '-ml-[10px]' : ''}`}
            />
          ))}
          {others > 0 ? (
            <span className={`h-[30px] min-w-[30px] px-[3px] shrink-0 rounded-full ring-2 ring-app-surface bg-app-surface-sunken text-app-secondary text-[0.6875rem] font-semibold flex items-center justify-center ${people.length ? '-ml-[10px]' : ''}`}>
              +{others}
            </span>
          ) : null}
        </span>
      ),
      text: names.length
        ? <>You both know {listOf(names)}</>
        : <>You have {count} {count === 1 ? 'connection' : 'connections'} in common</>,
    });
  }
  const skills = (data.skills ?? []).filter(Boolean).slice(0, 3);
  if (skills.length) {
    lines.push({
      key: 'skills',
      icon: (
        <IconCircle className="bg-sky-50 text-sky-700">
          <Wrench aria-hidden="true" className="w-4 h-4" strokeWidth={2} />
        </IconCircle>
      ),
      text: <>You both help with {listOf(skills.map((skill) => <Strong key={skill}>{skill}</Strong>))}</>,
    });
  }
  return lines;
}

/**
 * "You and Rowan": real common ground with someone, at most two lines (a plan you're both going to, a Support Train you
 * both help on, people you both know, skills you share, in that order). Hidden until the server answers, and when there's nothing
 * in common or the read fails.
 */
export default function YouAndSection({ personId, viewerId, firstName, enabled }: YouAndSectionProps) {
  const query = useQuery({
    queryKey: queryKeys.personInCommon(personId),
    queryFn: () => api.users.getInCommon(personId),
    enabled,
    staleTime: 60 * 1000,
  });
  if (!enabled || query.status !== 'success' || !query.data) return null;
  const lines = linesFor(query.data, viewerId, personId, firstName).slice(0, MAX_LINES);
  if (lines.length === 0) return null;
  // Every line's text starts after the widest icon: an icon circle grows with the text size (rem), overlapping photos
  // don't (px).
  const photosWidth = Math.max(0, ...lines.map((line) => line.iconWidth ?? 0));

  return (
    <section className="mt-7" aria-labelledby={`you-and-${personId}`}>
      <h2 id={`you-and-${personId}`} className="mb-2.5 text-[1.25rem] leading-[1.5625rem] font-bold text-app">
        You and {firstName}
      </h2>
      <ul className="rounded-2xl border border-app bg-surface overflow-hidden divide-y divide-app">
        {lines.map((line) => {
          const body = (
            <>
              <span aria-hidden="true" className="shrink-0 flex" style={{ width: `max(1.875rem, ${photosWidth}px)` }}>{line.icon}</span>
              <span className="min-w-0 flex flex-col gap-0.5">
                <span className="text-[0.9375rem] leading-5 text-app [overflow-wrap:anywhere]">{line.text}</span>
                {line.detail ? (
                  <span className="text-[0.8125rem] leading-[1.125rem] text-app-muted">
                    <span className="sr-only">, </span>
                    {line.detail}
                  </span>
                ) : null}
              </span>
            </>
          );
          const row = 'min-h-[3.75rem] px-4 py-3 flex items-center gap-3';
          return (
            <li key={line.key}>
              {line.href ? <Link href={line.href} className={`${row} hover-bg-app`}>{body}</Link> : <div className={row}>{body}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
