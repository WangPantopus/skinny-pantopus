"use client";

// W8 — the inbox FAB target: a local "Share booking link" sheet. Resolves the
// active scope owner's booking-page slug and reuses the W0 ShareLink. If the
// owner has no booking page yet, it points to the booking-page setup (W4).

import { useEffect, useState } from "react";
import Link from "next/link";
import { Link2 } from "lucide-react";
import * as api from "@pantopus/api";
import type { SchedulingOwnerRef } from "@pantopus/types";
import { buildBookingPageUrl } from "@pantopus/utils";
import BottomSheet from "@/components/ui/BottomSheet";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import ShareLink from "@/components/scheduling/ShareLink";
import { decodeError } from "@/components/scheduling/decodeError";
import type { Pillar } from "@/components/scheduling/pillarTokens";

export default function ShareBookingSheet({
  open,
  onClose,
  owner,
  pillar = "personal",
}: {
  open: boolean;
  onClose: () => void;
  owner: SchedulingOwnerRef;
  pillar?: Pillar;
}) {
  const [phase, setPhase] = useState<"loading" | "error" | "ready" | "none">(
    "loading",
  );
  const [url, setUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setPhase("loading");
    api.scheduling
      .getBookingPage(owner)
      .then((res) => {
        if (!alive) return;
        const slug = res.page?.slug;
        if (!slug) {
          setPhase("none");
          return;
        }
        setUrl(buildBookingPageUrl(slug));
        setDraft(res.page?.is_live === false);
        setPhase("ready");
      })
      .catch((err) => {
        if (!alive) return;
        const d = decodeError(err);
        // No page configured yet → guide to setup rather than error out.
        if (d.kind === "not_found") setPhase("none");
        else setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, [open, owner]);

  return (
    <BottomSheet open={open} onClose={onClose} title="Share booking link">
      {phase === "loading" && (
        <div className="space-y-3">
          <ShimmerBlock className="h-5 w-40 rounded" />
          <ShimmerBlock className="h-12 rounded-xl" />
          <ShimmerBlock className="h-40 rounded-xl" />
        </div>
      )}
      {phase === "error" && (
        <ErrorState
          message="We couldn't load your booking link."
          onRetry={onClose}
        />
      )}
      {phase === "none" && (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <Link2 className="h-6 w-6" aria-hidden />
          </span>
          <h3 className="mb-1 text-[15px] font-semibold text-app-text">
            No booking link yet
          </h3>
          <p className="mb-5 max-w-xs text-sm text-app-text-secondary">
            Set up your booking page to start sharing a link people can book
            with.
          </p>
          <Link
            href="/app/scheduling/booking-page"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            Set up booking page
          </Link>
        </div>
      )}
      {phase === "ready" && url && (
        <ShareLink url={url} pillar={pillar} draft={draft} />
      )}
    </BottomSheet>
  );
}
