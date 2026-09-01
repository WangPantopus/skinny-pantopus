"use client";

// W17 — the H13 period/filter state, backed by the URL query so it persists as
// the host moves between the four report tabs (and is shareable/bookmarkable).
// Both the shell (header chip + sheet) and each report read the same hook, so
// they always agree on the active window.

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FILTER_PARAM_KEYS,
  defaultTz,
  parseFilters,
  serializeFilters,
  type InsightsFilters,
} from "./filters";

export interface UseInsightsFilters {
  filters: InsightsFilters;
  setFilters: (next: InsightsFilters) => void;
  /** Serialized query string for preserving filters across tab links. */
  query: string;
}

export function useInsightsFilters(): UseInsightsFilters {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tz = useMemo(() => defaultTz(), []);
  const qs = searchParams?.toString() ?? "";

  const filters = useMemo(() => parseFilters(qs, tz), [qs, tz]);
  const query = useMemo(() => serializeFilters(filters), [filters]);

  const setFilters = useCallback(
    (next: InsightsFilters) => {
      // Rewrite only the filter-owned keys; preserve anything else (e.g. the
      // `owner` pillar param managed by the shell).
      const sp = new URLSearchParams(searchParams?.toString() ?? "");
      for (const k of FILTER_PARAM_KEYS) sp.delete(k);
      new URLSearchParams(serializeFilters(next)).forEach((v, k) =>
        sp.set(k, v),
      );
      const base = pathname ?? "";
      const s = sp.toString();
      router.replace(s ? `${base}?${s}` : base, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return { filters, setFilters, query };
}
