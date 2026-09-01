'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface RadiusSuggestion {
  suggestedRadius: number;
  reason: string;
  direction: 'expand' | 'narrow';
}

interface RadiusSuggestionOptions {
  enabled?: boolean;
  singularLabel?: string;
  pluralLabel?: string;
}

const RADIUS_OPTIONS = [1, 3, 10, 25, 100, 1000, 25000] as const;
const DEFAULT_LABELS = {
  singularLabel: 'post',
  pluralLabel: 'posts',
};

function formatRadius(miles: number): string {
  return miles === 25000 ? 'Global' : `${miles} mi`;
}

function resolveLabels(options: RadiusSuggestionOptions) {
  return {
    singularLabel: options.singularLabel || DEFAULT_LABELS.singularLabel,
    pluralLabel: options.pluralLabel || DEFAULT_LABELS.pluralLabel,
  };
}

function countLabel(count: number, labels: { singularLabel: string; pluralLabel: string }) {
  return count === 1 ? labels.singularLabel : labels.pluralLabel;
}

/**
 * Given the current radius and item count, suggest a different radius.
 *
 * Thresholds (tuned for neighborhood-scale content):
 *   - 0 items at any radius -> suggest next larger radius
 *   - 1-2 items at >=3mi -> suggest next larger radius
 *   - 50+ items at >=3mi -> suggest next smaller radius
 *   - Otherwise -> no suggestion
 */
function computeSuggestion(
  currentRadius: number,
  itemCount: number,
  labels: { singularLabel: string; pluralLabel: string },
): RadiusSuggestion | null {
  const currentIdx = RADIUS_OPTIONS.indexOf(currentRadius as any);
  if (currentIdx === -1) return null;

  // Too few items -> suggest expanding
  if (itemCount === 0 && currentIdx < RADIUS_OPTIONS.length - 1) {
    const next = RADIUS_OPTIONS[currentIdx + 1];
    return {
      suggestedRadius: next,
      reason: `No ${labels.pluralLabel} within ${formatRadius(currentRadius)}. Expand to ${formatRadius(next)}?`,
      direction: 'expand',
    };
  }

  if (itemCount <= 2 && currentRadius < 25000 && currentIdx < RADIUS_OPTIONS.length - 1) {
    const next = RADIUS_OPTIONS[currentIdx + 1];
    return {
      suggestedRadius: next,
      reason: `${itemCount} ${countLabel(itemCount, labels)} within ${formatRadius(currentRadius)}. Expand to ${formatRadius(next)}?`,
      direction: 'expand',
    };
  }

  // Too many items -> suggest narrowing
  if (itemCount >= 50 && currentRadius > 1 && currentIdx > 0) {
    const next = RADIUS_OPTIONS[currentIdx - 1];
    return {
      suggestedRadius: next,
      reason: `Lots of ${labels.pluralLabel} here. Focus to ${formatRadius(next)}?`,
      direction: 'narrow',
    };
  }

  return null;
}

/**
 * Content-density-based radius suggestion hook.
 *
 * On web, the caller provides the current radius and an optional setter
 * (since web doesn't have a global LocationContext like mobile).
 *
 * Usage:
 *   const [radius, setRadius] = useState(10);
 *   const { suggestion, dismiss, applySuggestion } = useRadiusSuggestion(itemCount, radius, setRadius);
 */
export function useRadiusSuggestion(
  itemCount: number,
  currentRadius: number = 100,
  setRadius?: (r: number) => void,
  options: RadiusSuggestionOptions = {},
) {
  const [suggestion, setSuggestion] = useState<RadiusSuggestion | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const prevRadiusRef = useRef<number | null>(null);
  const enabled = options.enabled ?? true;
  const labels = resolveLabels(options);

  // Reset dismissed state when radius changes (user manually changed it)
  useEffect(() => {
    if (prevRadiusRef.current !== null && prevRadiusRef.current !== currentRadius) {
      setDismissed(false);
    }
    prevRadiusRef.current = currentRadius;
  }, [currentRadius]);

  // Compute suggestion when item count changes
  useEffect(() => {
    if (!enabled) {
      setSuggestion(null);
      return;
    }

    if (dismissed) {
      setSuggestion(null);
      return;
    }

    const s = computeSuggestion(currentRadius, itemCount, labels);
    setSuggestion(s);
  }, [
    itemCount,
    currentRadius,
    dismissed,
    enabled,
    labels.singularLabel,
    labels.pluralLabel,
  ]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setSuggestion(null);
  }, []);

  const applySuggestion = useCallback(() => {
    if (suggestion) {
      setRadius?.(suggestion.suggestedRadius);
      setSuggestion(null);
      setDismissed(true);
    }
  }, [suggestion, setRadius]);

  return {
    suggestion: dismissed ? null : suggestion,
    dismiss,
    applySuggestion,
  };
}
