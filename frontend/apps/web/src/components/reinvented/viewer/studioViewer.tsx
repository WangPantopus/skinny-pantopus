'use client';

// What today's Moment viewer draws while `pulse_reinvented` is on for the person (its optional `studio` prop; off, the
// viewer is exactly today's): the stamps over the picture with the postmark's wet or dried ink, and the five signals
// in place of the emoji. Values come from the server (coord/CONTRACT.md §2c, §4); nothing here is typed by anyone.

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SmilePlus } from 'lucide-react';
import { put } from '@pantopus/api/client';
import type { Moment, Viewer } from '@pantopus/api/endpoints/moments';
import { useMe } from '@/lib/me';
import StampLayer from '../stamps/StampLayer';
import type { ShownStamp, StampKind } from '../stamps/stampTypes';
import { isSwitchedOff, useRereadSwitch } from '../switchOff';
import { isSignal, SIGNALS, SIGNAL_WORDS, SignalIcon, type Signal } from './signals';
import { EditEntry, SavedNote } from '../edit/EditEntry';
import { GuessOverPicture, holdsForGuess } from '../guess/GuessSpot';
import { holdsForKeep, KeepOverPicture } from '../keep/KeepThis';
import { PlanOverPicture, StartPlanEntry } from '../plan/WantToCome';
import { MailItEntry } from '../mailit/MailIt';
import PlayLayer, { holdsForPlay } from '../play/PlayLayer';
import DotLayer, { holdsForDots } from '../dots/DotLayer';
import SoundLayer, { hasSound, holdsForSound } from '../sound/SoundLayer';
import type { PlayItem } from '../play/playTypes';
import BeforeAfter, { beforeAfterOf } from '../play/BeforeAfter';
import { DeckBar } from '../deck/StepDeck';
import { SealCover } from '../seal/Seal';
import { CrowdChip } from '../crowd/Crowd';
import { withMentions, type MentionPerson } from '../mentions/Mentions';
import { holdsForReplies, RepliesOverPicture, RepliesShownEntry } from '../replies/Replies';
import PinLayer, { hasPins, holdsForPins, PinControls } from '../pins/PinLayer';
import { loopOf } from '../loop/loop';
import { LoopDriver } from '../loop/LoopDriver';
import MotionPhoto, { motionOf } from '../motion/MotionPhoto';
import { canvasBox, WholeBackdrop, wholeOf } from '../whole/Whole';
import './studioViewer.css';

type StudioMoment = Moment & { stamps?: ShownStamp[]; my_signal?: string | null; play?: PlayItem[]; dots?: unknown[] };

/**
 * The stamps and the playable items (phase 2), laid over the picture as the viewer draws it (centred and fitted, `object-fit: contain`), so a stamp
 * sits on the same part of the picture it was placed on. A text card is its 9:16 card.
 */
function ViewerStamps({ moment }: { moment: StudioMoment }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [now, setNow] = useState(Date.now);
  const stamps = moment.stamps || [];
  const playing =
    (moment.play || []).length + (moment.dots || []).length + (hasSound(moment) ? 1 : 0) + (hasPins(moment) ? 1 : 0) + (motionOf(moment) ? 1 : 0);
  // A before and after: the picture is the two photos side by side, and the reader sees one half's frame.
  const pair = moment.kind === 'photo' && moment.media_url ? beforeAfterOf(moment.play) : null;
  const paired = !!pair;
  // A placed video (PHASE-5 A6): what the author placed sits on its 9:16 canvas, so the stamps do too.
  const placed = moment.kind === 'video' && !!wholeOf(moment)?.placement;
  const liveUntil = Date.parse(moment.live_until || '');
  const wet = moment.taken_here === true && liveUntil > now;
  // The ink dries when "Live from here" turns to "Taken here", on the same kind of timer as today's pill.
  useEffect(() => {
    if (!wet) return;
    const t = setTimeout(() => setNow(Date.now()), Math.min(Math.max(liveUntil - Date.now(), 0) + 50, 60_000));
    return () => clearTimeout(t);
  }, [wet, liveUntil, now]);
  useEffect(() => {
    const stage = ref.current?.parentElement;
    if (!stage || !(stamps.length || playing)) return;
    const media = stage.querySelector<HTMLImageElement | HTMLVideoElement>('.mo-watch-media');
    const measure = () => {
      const sw = stage.clientWidth,
        sh = stage.clientHeight;
      let left = 0,
        top = 0,
        bw = sw,
        bh = sh,
        nw = 9,
        nh = 16;
      if (media) {
        left = media.offsetLeft;
        top = media.offsetTop;
        bw = media.clientWidth;
        bh = media.clientHeight;
        nw = media instanceof HTMLImageElement ? media.naturalWidth : media.videoWidth;
        nh = media instanceof HTMLImageElement ? media.naturalHeight : media.videoHeight;
      }
      if (paired) nw /= 2;
      if (placed) return setBox(canvasBox(sw, sh));
      if (!nw || !nh || !bw || !bh) return setBox(null);
      const scale = Math.min(bw / nw, bh / nh);
      const width = nw * scale,
        height = nh * scale;
      setBox({ left: left + (bw - width) / 2, top: top + (bh - height) / 2, width, height });
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(stage);
    media?.addEventListener('load', measure);
    media?.addEventListener('loadedmetadata', measure);
    return () => {
      watch.disconnect();
      media?.removeEventListener('load', measure);
      media?.removeEventListener('loadedmetadata', measure);
    };
  }, [stamps.length, playing, moment.media_url, moment.kind, paired, placed]);
  if (!stamps.length && !playing) return null;
  const values = new Map<StampKind, unknown>(stamps.map((s) => [s.kind, s.value]));
  return (
    <div ref={ref} className="sv-stamps">
      {/* The side-by-side picture under it stays hidden; only the half's frame shows. */}
      {pair && box && <div className="sv-ba-backdrop" />}
      {box && (
        <div className="sv-picture" style={box}>
          {/* A Live Photo's motion (PHASE-5 C), under everything drawn on the picture. */}
          <MotionPhoto moment={moment} />
          {pair && <BeforeAfter src={moment.media_url!} item={pair} />}
          <StampLayer stamps={stamps} valueOf={(k) => values.get(k) ?? null} ink={wet ? 'wet' : 'dry'} />
          <PlayLayer moment={moment} />
          <DotLayer moment={moment} />
          <SoundLayer moment={moment} />
          <PinLayer moment={moment} />
        </div>
      )}
    </div>
  );
}

/** The react button: the person's signal, or the same "add" mark as today. */
function SignalMark({ moment }: { moment: StudioMoment }) {
  const mine = isSignal(moment.my_signal) ? moment.my_signal : null;
  return mine ? (
    <span className="sv-mine" title={SIGNAL_WORDS[mine]}>
      <SignalIcon signal={mine} size={20} />
    </span>
  ) : (
    <SmilePlus />
  );
}

/** The five signals in today's reaction sheet; one per person, chosen again to take it back. */
function SignalChoices({ moment, close }: { moment: StudioMoment; close(): void }) {
  const client = useQueryClient();
  const reread = useRereadSwitch();
  const account = useMe().data?.id;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const mine = isSignal(moment.my_signal) ? moment.my_signal : null;
  async function choose(s: Signal) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const answer = await put<{ my_reaction: string | null; my_signal: string | null }>(
        `/api/moments/${encodeURIComponent(moment.id)}/reaction`,
        { signal: mine === s ? null : s },
      );
      client.setQueryData<{ moment: StudioMoment }>(['moments', 'watch', account, moment.id], (old) =>
        old ? { ...old, moment: { ...old.moment, my_signal: answer.my_signal, my_reaction: answer.my_reaction } } : old,
      );
      close();
    } catch (e) {
      // The switch went off: read it again and the viewer goes back to today's reactions.
      if (isSwitchedOff(e)) {
        close();
        void reread();
      } else setError(e instanceof Error && e.message ? e.message : 'Couldn’t send that. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="sv-signals" role="group" aria-label="Signals">
        {SIGNALS.map((s) => (
          <button key={s} type="button" disabled={busy} aria-pressed={mine === s} onClick={() => void choose(s)}>
            <SignalIcon signal={s} size={18} />
            {SIGNAL_WORDS[s]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="sv-error">
          {error}
        </p>
      )}
    </>
  );
}

/** Beside a viewer in "Seen by": their signal, or today's emoji when they used an older app. */
function SeenMark({ viewer }: { viewer: Viewer & { signal?: string | null } }) {
  return isSignal(viewer.signal) ? (
    <span className="sv-seen">
      <SignalIcon signal={viewer.signal} size={15} />
      {SIGNAL_WORDS[viewer.signal]}
    </span>
  ) : (
    <>{viewer.reaction}</>
  );
}

export const studioViewer = {
  overPicture: (m: Moment) => (
    <>
      <WholeBackdrop moment={m} />
      <LoopDriver moment={m} />
      <ViewerStamps moment={m as StudioMoment} />
      <DeckBar moment={m} />
      <SealCover moment={m} />
      <CrowdChip moment={m} />
      <RepliesOverPicture moment={m} />
      <PinControls moment={m} />
      <SavedNote id={m.id} />
      <GuessOverPicture moment={m} />
      <KeepOverPicture moment={m} />
      <PlanOverPicture moment={m} />
    </>
  ),
  menu: (m: Moment, close: () => void) => (
    <>
      <EditEntry moment={m} close={close} />
      <StartPlanEntry moment={m} close={close} />
      <MailItEntry moment={m} close={close} />
      <RepliesShownEntry moment={m} close={close} />
    </>
  ),
  holds: (m: Moment, account: string) => holdsForGuess(m, account) || holdsForKeep(m, account) || holdsForPlay(m) || holdsForDots(m) || holdsForSound(m) || holdsForReplies(m) || holdsForPins(m),
  reactButton: (m: Moment) => <SignalMark moment={m as StudioMoment} />,
  reactions: (m: Moment, close: () => void) => <SignalChoices moment={m as StudioMoment} close={close} />,
  seenMark: (v: Viewer) => <SeenMark viewer={v} />,
  caption: (m: Moment) => withMentions(m.caption || '', (m as Moment & { mentions?: MentionPerson[] }).mentions),
  loops: (m: Moment) => !!loopOf(m),
};
