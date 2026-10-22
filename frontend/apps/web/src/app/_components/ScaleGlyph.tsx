// The scale a fact describes, drawn: a wide dashed wash for a county (or
// a state), a cell for an area, a pin for this address, and a dashed
// empty box where a source had nothing.

export type GlyphScale = 'county' | 'area' | 'address' | 'missing';

export default function ScaleGlyph({ scale, size = 20, color = 'currentColor' }: { scale: GlyphScale; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} aria-hidden="true" style={{ flex: '0 0 auto' }}>
      {scale === 'county' ? (
        <>
          <circle cx="12" cy="12" r="9.5" strokeDasharray="2 2.5" />
          <circle cx="12" cy="12" r="5" fill={color} stroke="none" opacity="0.25" />
        </>
      ) : scale === 'area' ? (
        <polygon points="20,16.5 12,21 4,16.5 4,7.5 12,3 20,7.5" />
      ) : scale === 'address' ? (
        <>
          <path d="M12 22C8.5 17.5 6 14.2 6 10.5A6 6 0 1 1 18 10.5C18 14.2 15.5 17.5 12 22Z" />
          <circle cx="12" cy="10.5" r="2" />
        </>
      ) : (
        <>
          <rect x="4" y="4" width="16" height="16" rx="3" strokeDasharray="3 3" />
          <path d="M8 16L16 8" />
        </>
      )}
    </svg>
  );
}
