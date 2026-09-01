'use client';

const shimmerBase =
  'rounded bg-gradient-to-r from-app-surface-sunken via-app-surface to-app-surface-sunken bg-[length:200%_100%] animate-shimmer motion-reduce:animate-pulse';

export function ShimmerLine({ width = 'w-32', className = '' }: { width?: string; className?: string }) {
  return <div className={`h-4 ${width} ${shimmerBase} ${className}`} />;
}

export function ShimmerBlock({ className = '' }: { className?: string }) {
  return <div className={`${shimmerBase} ${className}`} />;
}
