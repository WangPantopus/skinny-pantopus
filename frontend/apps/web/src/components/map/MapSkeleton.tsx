'use client';

/**
 * MapSkeleton — lightweight placeholder rendered while the real map tiles load.
 *
 * Uses a CSS gradient that loosely approximates a street map at the default
 * zoom level.  Map controls (zoom buttons, recenter) are shown immediately
 * so the UI feels interactive from the first frame.
 */

export function MapSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{
        background:
          'linear-gradient(135deg, #e8edf2 0%, #dfe6ed 20%, #e2e8ee 40%, #d9e1e9 60%, #e5eaf0 80%, #dce3eb 100%)',
      }}
    >
      {/* Faint grid lines to suggest streets */}
      <div className="absolute inset-0 opacity-[0.18]" style={{
        backgroundImage:
          'linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }} />

      {/* Subtle horizontal "road" bands */}
      <div className="absolute left-0 right-0 top-[30%] h-[2px] bg-slate-300/40" />
      <div className="absolute left-0 right-0 top-[55%] h-[2px] bg-slate-300/40" />
      <div className="absolute top-0 bottom-0 left-[40%] w-[2px] bg-slate-300/40" />
      <div className="absolute top-0 bottom-0 left-[70%] w-[2px] bg-slate-300/40" />

      {/* Placeholder control buttons (bottom right like Leaflet default) */}
      <div className="absolute bottom-6 right-3 z-10 flex flex-col gap-1">
        <div className="w-8 h-8 rounded bg-white/80 shadow-sm flex items-center justify-center text-slate-400 text-lg font-bold select-none">
          +
        </div>
        <div className="w-8 h-8 rounded bg-white/80 shadow-sm flex items-center justify-center text-slate-400 text-lg font-bold select-none">
          −
        </div>
      </div>

      {/* Pulsing center dot */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-3 h-3 rounded-full bg-primary-400/50 animate-pulse" />
      </div>
    </div>
  );
}

/**
 * MapProgressBar — thin animated bar shown at the top of the map container
 * while data is loading. Replaces the old full-overlay spinner.
 */
export function MapProgressBar({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="absolute top-0 left-0 right-0 z-[1000] h-[3px] overflow-hidden bg-primary-100">
      <div className="h-full w-1/3 bg-primary-500 rounded-full animate-[progressSlide_1.2s_ease-in-out_infinite]" />
      <style>{`
        @keyframes progressSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
