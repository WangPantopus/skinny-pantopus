'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CalendarDays, MapPin, ShieldCheck } from 'lucide-react';
import BottomSheet from '@/components/ui/BottomSheet';
import ProfileAvatar from './atoms/ProfileAvatar';

const DAY_MS = 24 * 60 * 60 * 1000;

function joinedDate(joinedAt: string | null | undefined): Date | null {
  if (!joinedAt) return null;
  const date = new Date(joinedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Joined Oct 2026", or "Joined this week" in someone's first seven days. */
export function joinedText(joinedAt: string | null | undefined): string | null {
  const date = joinedDate(joinedAt);
  if (!date) return null;
  if (Date.now() - date.getTime() < 7 * DAY_MS) return 'Joined this week';
  return `Joined ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
}

/** Joined in the last `days` days: an empty profile then reads "<name> just joined". */
export function joinedRecently(joinedAt: string | null | undefined, days = 14): boolean {
  const date = joinedDate(joinedAt);
  return Boolean(date && Date.now() - date.getTime() < days * DAY_MS);
}

/** The first word of the name, for "Connect with Rowan?" and the like. */
export function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

interface ProfileHeaderProps {
  /** The name this viewer sees: other people see the name neighbors see. */
  name: string;
  /** False when `name` is the stand-in for a person with no name: the avatar then shows no initials. */
  hasName?: boolean;
  /** The username the person chose, without "@"; null when the server made it up. */
  handle?: string | null;
  photoUrl?: string | null;
  /** The account id: it picks the color behind the initials. */
  colorSeed: string;
  /** A verified home. The read says so only to viewers who may know it. */
  verifiedNeighbor?: boolean;
  /** The city, only when the read returns one. */
  city?: string | null;
  joinedAt?: string | null;
  tagline?: string | null;
  bio?: string | null;
  /** A line only the owner sees, under the trust line (the private account name). */
  ownerNote?: ReactNode;
  /** The buttons and banners under the bio. */
  children?: ReactNode;
}

/** Up to four lines of the bio, with "more" when it runs longer. */
function Bio({ text }: { text: string }) {
  const id = useId();
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div className="mt-1.5">
      <p
        id={id}
        ref={ref}
        className={`text-base leading-[1.375rem] text-app-strong whitespace-pre-line [overflow-wrap:anywhere] ${expanded ? '' : 'line-clamp-4'}`}
      >
        {text}
      </p>
      {clamped && !expanded && (
        <button
          type="button"
          aria-expanded={false}
          aria-controls={id}
          onClick={() => setExpanded(true)}
          className="min-h-[44px] min-w-[44px] -my-2.5 text-left text-base font-semibold text-app-link hover:underline"
        >
          more
        </button>
      )}
    </div>
  );
}

/**
 * The top of a person's profile: photo or initials, the name (it wraps, never cut off), @username, one line of what
 * is true about them (a verified home, the city, when they joined), the tagline and the bio. No banner and no counts:
 * a neighbor should see who this is and how to say hi.
 */
export default function ProfileHeader({
  name,
  hasName = true,
  handle = null,
  photoUrl = null,
  colorSeed,
  verifiedNeighbor = false,
  city = null,
  joinedAt = null,
  tagline = null,
  bio = null,
  ownerNote = null,
  children,
}: ProfileHeaderProps) {
  const [explainerOpen, setExplainerOpen] = useState(false);
  const joined = joinedText(joinedAt);
  const facts = [city, joined].filter(Boolean) as string[];
  const first = hasName ? firstWord(name) : 'This neighbor';
  const joinedMonth = joinedDate(joinedAt)?.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const TrustIcon = verifiedNeighbor ? ShieldCheck : city ? MapPin : CalendarDays;
  const trustText = (
    <>
      <TrustIcon
        aria-hidden="true"
        className={`mt-[1.5px] w-[1.0625rem] h-[1.0625rem] shrink-0 ${verifiedNeighbor ? 'text-app-home' : 'text-app-muted'}`}
        strokeWidth={2}
      />
      <span>
        {verifiedNeighbor && <span className="font-semibold text-app-home">Verified neighbor</span>}
        {verifiedNeighbor && facts.length > 0 ? ' · ' : ''}
        {facts.join(' · ')}
      </span>
    </>
  );

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <ProfileAvatar name={hasName ? name : null} seed={colorSeed} photoUrl={photoUrl} size={84} />
        <div className="min-w-0 flex-1 basis-[11rem] flex flex-col gap-0.5">
          <h1 className="text-[1.75rem] leading-[2.125rem] font-bold text-app [overflow-wrap:anywhere]">{name}</h1>
          {handle ? <p className="text-[0.9375rem] leading-5 text-app-muted [overflow-wrap:anywhere]">@{handle}</p> : null}
        </div>
      </div>

      {(verifiedNeighbor || facts.length > 0) && (
        verifiedNeighbor ? (
          // What "Verified neighbor" means, one tap away.
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setExplainerOpen(true)}
            className="mt-1 self-start min-h-[44px] py-3 -mb-2 flex items-start gap-1.5 text-left text-[0.9375rem] leading-5 text-app-muted hover:underline decoration-app-border-strong underline-offset-2"
          >
            {trustText}
            <span className="sr-only">. What this means</span>
          </button>
        ) : (
          <p className="mt-3.5 flex items-start gap-1.5 text-[0.9375rem] leading-5 text-app-muted">{trustText}</p>
        )
      )}

      {ownerNote}

      {tagline ? (
        <p className="mt-3.5 text-[1.0625rem] leading-[1.375rem] font-semibold text-app [overflow-wrap:anywhere]">{tagline}</p>
      ) : null}
      {bio ? <Bio text={bio} /> : null}

      {children}

      <BottomSheet open={explainerOpen} onClose={() => setExplainerOpen(false)} title="Verified neighbor">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="w-9 h-9 shrink-0 rounded-full bg-app-home-bg text-app-home flex items-center justify-center">
            <ShieldCheck className="w-[1.125rem] h-[1.125rem]" />
          </span>
          <div className="text-[0.9375rem] leading-5 text-app">
            <p>
              {city
                ? `Pantopus confirmed ${first} lives in ${city}. Their address is never shown.`
                : `Pantopus confirmed where ${first} lives. Their address is never shown.`}
            </p>
            {joinedMonth ? <p className="mt-2 text-app-muted">{first} joined Pantopus in {joinedMonth}.</p> : null}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
