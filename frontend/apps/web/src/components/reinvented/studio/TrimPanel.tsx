'use client';

// Trim, on the Studio's first screen (PHASE-5 A2: "A video also has trim"): which part of the picked video goes up. The
// preview behind it plays that part, over and over, as it is chosen; posting cuts the file to it (wholeVideo.ts).

/** The shortest part kept, in milliseconds. */
export const TRIM_MIN_MS = 500;

export interface TrimSpan {
  from_ms: number;
  to_ms: number;
}

const seconds = (ms: number) => (ms / 1000).toFixed(1) + ' s';

/** `span` held inside a video `durationMs` long, at least TRIM_MIN_MS; null when it keeps the whole video. */
export function heldTrim(span: TrimSpan | null, durationMs: number | null): TrimSpan | null {
  if (!span || durationMs == null || durationMs < TRIM_MIN_MS) return null;
  const from = Math.max(0, Math.min(span.from_ms, durationMs - TRIM_MIN_MS));
  const to = Math.max(from + TRIM_MIN_MS, Math.min(span.to_ms, durationMs));
  return from < 50 && to > durationMs - 50 ? null : { from_ms: Math.round(from), to_ms: Math.round(to) };
}

export function TrimPanel({
  durationMs,
  span,
  onSpan,
  onOff,
  onDone,
}: {
  /** The video's own length, once the preview has read it. */
  durationMs: number | null;
  span: TrimSpan | null;
  onSpan(span: TrimSpan): void;
  onOff(): void;
  onDone(): void;
}) {
  const from = span?.from_ms ?? 0,
    to = span?.to_ms ?? durationMs ?? 0;
  return (
    <div className="st-toolpanel" role="group" aria-label="Trim">
      {durationMs == null ? (
        <p className="st-hint">Reading the video…</p>
      ) : durationMs < TRIM_MIN_MS * 2 ? (
        <p className="st-hint">This video is too short to trim.</p>
      ) : (
        <>
          <p className="st-hint">Only this part goes up: {seconds(to - from)} of {seconds(durationMs)}.</p>
          <div className="st-picture-row">
            <label className="st-field">
              Starts at {seconds(from)}
              <input
                type="range"
                min={0}
                max={Math.max(0, durationMs - TRIM_MIN_MS)}
                step={100}
                value={from}
                onChange={(e) => onSpan({ from_ms: Number(e.target.value), to_ms: Math.max(to, Number(e.target.value) + TRIM_MIN_MS) })}
              />
            </label>
            <label className="st-field">
              Ends at {seconds(to)}
              <input
                type="range"
                min={TRIM_MIN_MS}
                max={durationMs}
                step={100}
                value={to}
                onChange={(e) => onSpan({ from_ms: Math.min(from, Number(e.target.value) - TRIM_MIN_MS), to_ms: Number(e.target.value) })}
              />
            </label>
          </div>
        </>
      )}
      <div className="dt-row">
        {span && (
          <button type="button" className="st-chip" onClick={onOff}>
            Keep it all
          </button>
        )}
        <button type="button" className="st-done" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
