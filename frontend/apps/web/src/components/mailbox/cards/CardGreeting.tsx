'use client';

/**
 * A card's own voice greeting (memories plan step 7, launch key holiday_card_memories; wave 4 drawings 2, 3, 4): a
 * cassette labelled "For {first}" in the sender's pen (a cream gift tag on a string for Christmas with Jesus Christ,
 * pictures 59-67) that plays only when it's pressed, its reels turning while it plays. Its bytes load on the first press,
 * through the card's reader-checked routes (never a storage link), into an object URL dropped when it goes. The length
 * shown is the server's (`duration_ms`), never the player's guess.
 *
 * Recording (web): only where the browser makes AAC in MP4 (`audio/mp4;codecs=mp4a.40.2`: Chrome, Edge, Safari; Firefox
 * plays only), one `start()` with no timeslice, stopped at 60 seconds, the microphone asked for only on the tap.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { mailbox } from '@pantopus/api';
import { cardPen } from './cardFont';
import type { PrintSource } from './CardPrint';

const PEN = `${cardPen.style.fontFamily}, ui-serif, Georgia, serif`;
/** The one recording format the server takes from a browser (memories contract: no converter). */
export const GREETING_MIME = 'audio/mp4;codecs=mp4a.40.2';
/** The longest greeting: the server allows a frame or two over 60 s, so it stops a little before. */
const LONGEST_MS = 59_700;

/** "0:18": a greeting's length, from the server's milliseconds. */
export function greetingLength(ms: number | null | undefined): string {
  const seconds = Math.max(1, Math.round((ms ?? 0) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** "0:07": how long it has been recording, in whole seconds. */
export function recordingClock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** "18 seconds", for screen readers. */
export function spokenLength(ms: number | null | undefined): string {
  const seconds = Math.max(1, Math.round((ms ?? 0) / 1000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const rest = seconds % 60;
  return `1 minute${rest ? ` ${rest} second${rest === 1 ? '' : 's'}` : ''}`;
}

/** This browser can record a greeting the server takes. */
export function canRecordGreeting(): boolean {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
  try { return MediaRecorder.isTypeSupported(GREETING_MIME); } catch { return false; }
}

/**
 * Plays a greeting: nothing loads until the first press (never autoplay). `localUrl` plays the sender's own recording
 * straight away; otherwise the bytes come from `source`.
 */
export function useGreetingPlayer(source: PrintSource | null, localUrl: string | null = null) {
  const key = localUrl || (source ? JSON.stringify(source) : '');
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const loading = useRef<AbortController | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'failed'>('idle');

  const drop = useCallback(() => {
    loading.current?.abort();
    loading.current = null;
    if (audio.current) { audio.current.pause(); audio.current.src = ''; audio.current = null; }
    if (url.current) { URL.revokeObjectURL(url.current); url.current = null; }
  }, []);
  // A new greeting (or none): start again from nothing.
  useEffect(() => { setState('idle'); return drop; }, [key, drop]);

  const play = (src: string) => {
    if (!audio.current) {
      const element = new Audio(src);
      element.addEventListener('ended', () => setState('idle'));
      element.addEventListener('pause', () => setState((now) => (now === 'playing' ? 'paused' : now)));
      element.addEventListener('playing', () => setState('playing'));
      element.addEventListener('error', () => setState('failed'));
      audio.current = element;
    }
    audio.current.play().catch(() => setState('failed'));
  };

  const toggle = () => {
    if (state === 'playing') { audio.current?.pause(); return; }
    if (state === 'loading') return;
    if (audio.current) { play(audio.current.src); return; }
    if (localUrl) { setState('loading'); play(localUrl); return; }
    if (!source) return;
    const controller = new AbortController();
    loading.current = controller;
    setState('loading');
    mailbox.getHolidayCardMediaBlob(source, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        url.current = URL.createObjectURL(blob);
        play(url.current);
      })
      .catch(() => { if (!controller.signal.aborted) setState('failed'); });
  };

  return { state, playing: state === 'playing', toggle, stop: () => audio.current?.pause() };
}

/** Records one greeting: the microphone is asked for on `start`, and let go the moment it stops. */
export function useGreetingRecorder(onRecorded: (blob: Blob) => void) {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef(0);
  const ticker = useRef(0);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [refused, setRefused] = useState<string | null>(null);
  const done = useRef(onRecorded);
  done.current = onRecorded;

  const release = useCallback(() => {
    window.clearTimeout(timer.current);
    window.clearInterval(ticker.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);
  useEffect(() => () => {
    if (recorder.current && recorder.current.state !== 'inactive') { recorder.current.ondataavailable = null; recorder.current.onstop = null; recorder.current.stop(); }
    release();
  }, [release]);

  const stop = () => { if (recorder.current?.state === 'recording') recorder.current.stop(); };

  const start = async () => {
    setRefused(null);
    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (error) {
      const name = (error as { name?: string })?.name;
      setRefused(name === 'NotFoundError' || name === 'OverconstrainedError'
        ? 'No microphone was found. You can still send the card with your note.'
        : 'Your browser didn’t let Pantopus use the microphone. You can still send the card with your note, or allow the microphone and try again.');
      return;
    }
    stream.current = mic;
    const chunks: Blob[] = [];
    let made: MediaRecorder;
    try {
      made = new MediaRecorder(mic, { mimeType: GREETING_MIME, audioBitsPerSecond: 64_000 });
    } catch {
      release();
      setRefused('This browser can’t record a greeting the card can carry. You can still send the card with your note.');
      return;
    }
    recorder.current = made;
    made.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    made.onstop = () => {
      release();
      setRecording(false);
      recorder.current = null;
      if (chunks.length) done.current(new Blob(chunks, { type: 'audio/mp4' }));
    };
    const began = Date.now();
    // One piece, no timeslice: the server reads the file whole.
    made.start();
    setElapsed(0);
    setRecording(true);
    ticker.current = window.setInterval(() => setElapsed(Date.now() - began), 250);
    timer.current = window.setTimeout(() => { if (made.state === 'recording') made.stop(); }, LONGEST_MS);
  };

  return { recording, elapsed, refused, start, stop, clearRefused: () => setRefused(null) };
}

/** Two reels behind the cassette's window; they turn while it plays (or records), unless motion is reduced. */
function Reel({ turning }: { turning: boolean }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={`h-full w-auto ${turning ? 'animate-[spin_2.4s_linear_infinite] motion-reduce:animate-none' : ''}`}>
      <circle cx="20" cy="20" r="15" fill="none" stroke="#e9e1d1" strokeWidth="3.2" strokeDasharray="6.2 3.6" />
      <circle cx="20" cy="20" r="4.5" fill="#e9e1d1" opacity="0.85" />
    </svg>
  );
}

/**
 * The greeting as a thing on the table: a cassette, or a gift tag for Christmas with Jesus Christ. Its own size comes
 * from its container's width (container queries). Not a button itself: callers wrap it in one, or show it as it records.
 */
export function GreetingObject({
  forName,
  gift = false,
  turning = false,
  recording = false,
  durationMs = null,
  tilt = 3,
}: {
  /** Whose it is: "For {first}", in the sender's pen. */
  forName: string;
  /** Christmas with Jesus Christ: a cream gift tag on a string, "Press to play" on it. */
  gift?: boolean;
  turning?: boolean;
  /** Being recorded now (Write on the back): the tag says so. */
  recording?: boolean;
  /** On the gift tag: "Press to play · 0:18". */
  durationMs?: number | null;
  tilt?: number;
}) {
  const first = forName.split(/\s+/)[0] || forName;
  if (gift) {
    return (
      <span aria-hidden className="relative block w-full" style={{ transform: `rotate(${-tilt * 2}deg)` } as CSSProperties}>
        {/* The string runs off from the tag's hole. */}
        <svg viewBox="0 0 100 40" className="pointer-events-none absolute -left-[22%] top-[18%] w-[34%] overflow-visible" aria-hidden>
          <path d="M100 22 C 70 10, 40 40, 0 18" fill="none" stroke="#8a6a45" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        <span
          className="relative block w-full bg-[#efe6d3] shadow-[0_10px_20px_rgba(4,3,2,0.45),0_2px_3px_rgba(4,3,2,0.3)]"
          style={{ aspectRatio: '1.9 / 1', clipPath: 'polygon(14% 0, 100% 0, 100% 100%, 14% 100%, 0 50%)' }}
        >
          <span className="absolute left-[9%] top-1/2 h-[11%] w-auto -translate-y-1/2 rounded-full bg-[#4a3423]" style={{ aspectRatio: '1 / 1' }} />
          <span className="absolute left-[24%] right-[6%] top-[13%] block truncate text-[#24305a]" style={{ fontFamily: PEN, fontSize: '12.5cqi', lineHeight: 1.3 }}>
            For {first}
          </span>
          {/* Two lines: what to do, then how long. */}
          <span className="absolute bottom-[13%] left-[24%] right-[6%] block whitespace-nowrap font-semibold uppercase tracking-[0.05em] text-[#6b5640]" style={{ fontSize: '6.8cqi', lineHeight: 1.3 }}>
            <span className="block">{recording ? '● Recording' : turning ? '❚❚ Playing' : '▶ Press to play'}</span>
            {durationMs && !recording ? <span className="block">{greetingLength(durationMs)}</span> : null}
          </span>
        </span>
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="relative block w-full rounded-[6%/9%] bg-[linear-gradient(160deg,#3a3431,#211d1b_70%)] p-[5%] shadow-[0_12px_22px_rgba(4,3,2,0.5),0_2px_4px_rgba(4,3,2,0.3),inset_0_1px_0_rgba(255,255,255,0.08)]"
      style={{ aspectRatio: '1.62 / 1', transform: `rotate(${tilt}deg)` }}
    >
      <span className="relative block h-[48%] rounded-[3%] bg-[#f3ead7] px-[6%] pt-[3%]">
        <span className="block truncate text-[#24305a]" style={{ fontFamily: PEN, fontSize: '13cqi', lineHeight: 1.35 }}>For {first}</span>
        <span className="absolute bottom-[22%] left-[6%] right-[6%] h-px bg-[#c98b84]" />
      </span>
      <span className="mx-auto mt-[6%] flex h-[30%] w-[64%] items-center justify-between rounded-full bg-[#141110] px-[5%] py-[2%] shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
        <Reel turning={turning} />
        <Reel turning={turning} />
      </span>
    </span>
  );
}

/**
 * The greeting to press and play: the object, and under a cassette "▶ Press to play · 0:18" (a gift tag carries the
 * words itself). Nothing plays by itself.
 */
export default function CardGreeting({
  source,
  durationMs,
  forName,
  fromName,
  gift = false,
  tilt = 3,
  active = true,
  className = '',
}: {
  source: PrintSource | null;
  durationMs: number | null;
  forName: string;
  /** Who recorded it, for screen readers. */
  fromName: string;
  gift?: boolean;
  tilt?: number;
  /** In sight: once it isn't (the card turned back, or put away), it stops playing. */
  active?: boolean;
  className?: string;
}) {
  const { state, playing, toggle, stop } = useGreetingPlayer(source);
  // Its stop changes each render; only being put out of sight matters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!active) stop(); }, [active]);
  const from = fromName.split(/\s+/)[0] || 'them';
  const length = spokenLength(durationMs);
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={playing}
      aria-label={playing ? `Pause the greeting from ${from}` : `Play the greeting from ${from}, ${length}`}
      data-testid="cardGreeting"
      data-state={state}
      className={`block w-full text-left [container-type:inline-size] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8b76f] ${className}`}
    >
      <GreetingObject forName={forName} gift={gift} turning={playing} durationMs={durationMs} tilt={tilt} />
      {gift ? null : (
        <span
          className="mx-auto mt-[5%] flex w-max items-center gap-[0.4em] whitespace-nowrap rounded-full bg-[rgba(16,12,10,0.72)] px-[0.9em] py-[0.35em] font-semibold text-[#f6ecd9] shadow-[inset_0_0_0_0.5px_rgba(246,236,217,0.16)]"
          style={{ fontSize: 'clamp(11px, 7cqi, 15px)' }}
          aria-hidden
        >
          {playing ? '❚❚ Playing' : state === 'loading' ? 'Loading…' : '▶ Press to play'} · {greetingLength(durationMs)}
        </span>
      )}
      {state === 'failed' ? (
        <span role="status" className="mt-1 block text-center text-[12px] text-[#ffb4a8]">This greeting couldn’t be played.</span>
      ) : null}
    </button>
  );
}
