'use client';

/**
 * Full-viewport overlay shown when the map zoom level is too low
 * to meaningfully display individual markers.
 */
export function ZoomGateOverlay({
  visible,
  contentLabel = 'content',
}: {
  /** Whether to display the overlay (usually `zoom < threshold`) */
  visible: boolean;
  /** Noun to fill "Zoom in to see [content]" – e.g. "tasks", "posts", "businesses" */
  contentLabel?: string;
}) {
  if (!visible) return null;

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] flex items-center gap-2 bg-app-surface/90 backdrop-blur rounded-2xl px-5 py-3 shadow text-sm text-app-text-secondary pointer-events-none select-none">
      <span>🔍</span>
      Zoom in to see {contentLabel}
    </div>
  );
}
