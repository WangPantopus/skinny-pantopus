// ============================================================
// The canvas's ballot-box glyph (Board: Place: Your ballot card), and
// the 34px home-green tile that carries it. Not a lucide icon: the
// canvas draws its own three strokes, reproduced here exactly.
// ============================================================

export function BallotGlyph({ size = 19, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M9 11V4h6v7" />
      <path d="M8 16h8" />
    </svg>
  );
}

export function BallotTile() {
  return (
    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-app-home-bg text-app-home">
      <BallotGlyph />
    </span>
  );
}
