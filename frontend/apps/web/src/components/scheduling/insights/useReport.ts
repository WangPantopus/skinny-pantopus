"use client";

// W17 — a tiny fetch-state hook shared by the four read-only reports. Mirrors
// the app convention (loading | error | ready phase + a request guard against
// stale responses) and decodes the error envelope so callers can branch on
// BUSINESS_ONLY etc. `deps` is the dependency list that should re-run the load
// (typically the serialized filters + owner); `reload` re-runs on demand.

import { useCallback, useEffect, useRef, useState } from "react";
import type { DecodedSchedulingError } from "@pantopus/types";
import { decodeError } from "@/components/scheduling/decodeError";

export type ReportPhase = "loading" | "error" | "ready";

export interface ReportState<T> {
  phase: ReportPhase;
  data: T | null;
  error: DecodedSchedulingError | null;
  reload: () => void;
}

export function useReport<T>(
  loader: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
): ReportState<T> {
  const [phase, setPhase] = useState<ReportPhase>("loading");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<DecodedSchedulingError | null>(null);
  const reqRef = useRef(0);
  const [nonce, setNonce] = useState(0);

  const run = useCallback(() => {
    const id = ++reqRef.current;
    setPhase("loading");
    setError(null);
    loader()
      .then((res) => {
        if (reqRef.current !== id) return; // stale
        setData(res);
        setPhase("ready");
      })
      .catch((e) => {
        if (reqRef.current !== id) return;
        setError(decodeError(e));
        setPhase("error");
      });
    // loader is intentionally excluded — `deps` drives re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  useEffect(() => {
    run();
  }, [run]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { phase, data, error, reload };
}
