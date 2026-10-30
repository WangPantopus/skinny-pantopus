'use client';

// ============================================================
// A card you can turn over: the picture side, and the back laid over it at
// the same size. Turning takes half a second; with Reduce Motion the sides
// swap without turning.
// ============================================================

import type { ReactNode } from 'react';

export default function CardFlip({
  front,
  back,
  showBack,
  className = '',
}: {
  front: ReactNode;
  back: ReactNode;
  showBack: boolean;
  className?: string;
}) {
  return (
    <div className={`[perspective:1600px] ${className}`}>
      <div
        className="relative transition-transform duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transition-none"
        style={{ transform: showBack ? 'rotateY(180deg)' : 'none' }}
      >
        <div className="[backface-visibility:hidden]" aria-hidden={showBack}>{front}</div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]" aria-hidden={!showBack}>{back}</div>
      </div>
    </div>
  );
}
