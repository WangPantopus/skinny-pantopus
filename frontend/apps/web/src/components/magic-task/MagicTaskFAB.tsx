'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';

interface MagicTaskFABProps {
  /** Open the Magic Task composer modal */
  onOpenComposer: () => void;
}

/**
 * Routes where another FAB already occupies the bottom-right corner.
 * On these pages we hide the Magic Task FAB to avoid overlap.
 */
const ROUTES_WITH_FAB = ['/app/hub', '/app/homes/', '/app/feed'];

/**
 * Floating Action Button for Magic Task.
 * Appears on every major surface (bottom-right).
 * Automatically shifts upward on pages that already have a FAB.
 */
export default function MagicTaskFAB({ onOpenComposer }: MagicTaskFABProps) {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);
  const [showPulse, setShowPulse] = useState(true);

  // Stop the pulse animation after a few seconds so it's not distracting
  useEffect(() => {
    const timer = setTimeout(() => setShowPulse(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  // Shift up when another FAB is present on this route
  const hasOtherFAB = ROUTES_WITH_FAB.some((r) => pathname.startsWith(r));

  // Hide entirely on pages that already have their own FAB with task actions
  if (hasOtherFAB) return null;

  return (
    <button
      onClick={onOpenComposer}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 
        bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700
        text-white rounded-full shadow-lg hover:shadow-xl
        transition-all duration-300 ease-out
        px-5 py-3.5 text-sm font-semibold
        group`}
      style={{ minWidth: isHovered ? 160 : 'auto' }}
      aria-label="Hire Help — Post a task"
    >
      {/* Pulse ring */}
      {showPulse && (
        <span className="absolute inset-0 rounded-full animate-ping bg-blue-400 opacity-20" />
      )}

      {/* Sparkle icon */}
      <Sparkles
        className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${
          isHovered ? 'rotate-12 scale-110' : ''
        }`}
      />

      {/* Label */}
      <span className="whitespace-nowrap">Hire Help</span>
    </button>
  );
}