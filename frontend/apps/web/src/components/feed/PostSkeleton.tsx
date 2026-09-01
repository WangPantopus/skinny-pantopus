'use client';

export default function PostSkeleton() {
  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-app p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-16 h-4 rounded-full bg-surface-muted" />
        <div className="w-8 h-3 rounded bg-surface-muted" />
      </div>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-surface-muted" />
        <div>
          <div className="w-24 h-3.5 rounded bg-surface-muted mb-1.5" />
          <div className="w-16 h-2.5 rounded bg-surface-muted" />
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="w-full h-3 rounded bg-surface-muted" />
        <div className="w-4/5 h-3 rounded bg-surface-muted" />
        <div className="w-2/3 h-3 rounded bg-surface-muted" />
      </div>
      <div className="flex gap-2">
        <div className="w-16 h-7 rounded-lg bg-surface-muted" />
        <div className="w-12 h-7 rounded-lg bg-surface-muted" />
      </div>
    </div>
  );
}
