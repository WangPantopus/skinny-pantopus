// ============================================================
// The stack (Boards: Overview, The peel, Web lookup). P0 draws the
// canvas's nine decorative polygons — never real boundaries — one per
// counted government, widest first, each placed with the canvas's own
// transform: translate(cx, base − i·gap) scale(S) scale(1, .5)
// rotate(45). Layer 0 fills #eef1f5, the rest white at 94%, and a
// dashed home-green line drops to the home dot. With `story`, each
// layer lifts 8 and takes the green highlight in turn, 1.2 s apart
// (Board: The peel).
//
// P0 has no verified "nothing this year" status, so every layer uses
// the solid stroke; the dashed style waits for verified-empty data.
// ============================================================

/** One government's turn in the peel story, in milliseconds. */
export const STORY_STEP_MS = 1200;

export const STACK_POLYGONS = [
  '-144,-133 133,-144 144,130 -133,144',
  '-126,-105 105,-130 130,84 42,122 -119,119',
  '-105,-77 84,-98 105,63 -28,105 -98,84',
  '-84,-56 49,-88 91,28 21,84 -77,67',
  '-70,-77 63,-56 74,49 -42,74 -80,14',
  '-91,-28 14,-67 77,-14 56,56 -63,49',
  '-56,-49 42,-60 60,21 14,56 -53,39',
  '-77,-42 28,-49 49,42 -42,63',
  '-42,-35 39,-42 46,32 -35,42',
];

type StackSize = 'teaser' | 'peel';

const SIZES: Record<StackSize, {
  width: number; height: number; cx: number; base: number; gap: number; scale: number; stroke: number;
  lineWidth: number; dash: string; lineLead: number; dot: number; ring: number;
}> = {
  // Board: Web lookup — 196 × 168, scale .45, 14 apart, 1.25 stroke.
  teaser: { width: 196, height: 168, cx: 98, base: 150, gap: 14, scale: 0.45, stroke: 1.25, lineWidth: 1.5, dash: '2 3', lineLead: 8, dot: 5, ring: 2 },
  // Board: The peel — 390 × 420, scale .82, 32 apart, 1.4 stroke.
  peel: { width: 390, height: 420, cx: 195, base: 350, gap: 32, scale: 0.82, stroke: 1.4, lineWidth: 2, dash: '3 4', lineLead: 10, dot: 7, ring: 2.5 },
};

export interface GovernmentStackProps {
  /** Governments counted for this address (drawn up to nine). */
  count: number;
  size: StackSize;
  label: string;
  homeTitle?: string;
  /** The canvas lets the teaser's drawing shrink beside a long legend. */
  shrink?: boolean;
  /** Plays the peel story: each layer lifts and highlights in turn. */
  story?: boolean;
}

export default function GovernmentStack({ count, size, label, homeTitle, shrink = false, story = false }: GovernmentStackProps) {
  const s = SIZES[size];
  const layers = Math.max(1, Math.min(count, STACK_POLYGONS.length));
  const topY = s.base - (layers - 1) * s.gap;

  return (
    <svg width={s.width} height={s.height} viewBox={`0 0 ${s.width} ${s.height}`} role="img" aria-label={label} className={`block ${shrink ? 'min-w-0' : 'shrink-0'}`}>
      {STACK_POLYGONS.slice(0, layers).map((points, i) => {
        const delay = story ? { animationDelay: `${i * STORY_STEP_MS}ms` } : undefined;
        return (
          <g key={points} className={story ? 'motion-safe:animate-[ballotLift_1.2s_ease-out_both]' : undefined} style={delay}>
            <g transform={`translate(${s.cx} ${s.base - i * s.gap}) scale(${s.scale}) scale(1 0.5) rotate(45)`}>
              <polygon
                points={points}
                fillOpacity={i === 0 ? 1 : 0.94}
                strokeWidth={s.stroke}
                vectorEffect="non-scaling-stroke"
                className={`${i === 0 ? 'fill-[#eef1f5] dark:fill-slate-700' : 'fill-white dark:fill-slate-800'} stroke-[#111827] dark:stroke-slate-200`}
              />
              {story ? (
                <polygon
                  points={points}
                  strokeWidth={3}
                  vectorEffect="non-scaling-stroke"
                  className="fill-app-home-bg stroke-app-home opacity-0 motion-safe:animate-[ballotHi_1.2s_ease-out_both]"
                  style={delay}
                />
              ) : null}
            </g>
          </g>
        );
      })}
      <line
        x1={s.cx}
        y1={topY - s.lineLead}
        x2={s.cx}
        y2={s.base}
        strokeWidth={s.lineWidth}
        strokeDasharray={s.dash}
        className="stroke-[#15803d] dark:stroke-app-home"
      />
      <circle cx={s.cx} cy={s.base} r={s.dot} strokeWidth={s.ring} className="fill-[#15803d] stroke-white dark:stroke-slate-900">
        {homeTitle ? <title>{homeTitle}</title> : null}
      </circle>
    </svg>
  );
}
