// ============================================================
// ProgressSegments — wizard segmented progress indicator.
// Fills the first `step` of `totalSteps` segments.
// ============================================================

'use client';

export interface ProgressSegmentsProps {
  step: number;
  totalSteps: number;
  hideReadout?: boolean;
  className?: string;
}

export default function ProgressSegments({
  step,
  totalSteps,
  hideReadout,
  className = '',
}: ProgressSegmentsProps) {
  const safeStep = Math.max(0, Math.min(step, totalSteps));
  return (
    <div className={className}>
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition ${
              i < safeStep ? 'bg-primary-600' : 'bg-app-surface-sunken'
            }`}
          />
        ))}
      </div>
      {hideReadout ? null : (
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-app-text-secondary">
          Step {safeStep} of {totalSteps}
        </p>
      )}
    </div>
  );
}
