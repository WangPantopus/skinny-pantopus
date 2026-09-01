"use client";

// A1 — Booking-link card. The hub hero: a miniature live preview of the public
// /book page plus the reusable W0 ShareLink (copy / share / QR / draft banner /
// regenerate). Dims to a "Paused" state. Read-only members get copy only.

import clsx from "clsx";
import { Check, Copy, Link2, Pause } from "lucide-react";
import { useState } from "react";
import { copyToClipboard, buildBookingPageUrl } from "@pantopus/utils";
import type { BookingPage } from "@pantopus/types";
import ShareLink from "@/components/scheduling/ShareLink";
import { toast } from "@/components/ui/toast-store";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import { initials } from "./format";

interface BookingLinkCardProps {
  page: BookingPage;
  pillar: Pillar;
  name: string;
  role: string;
  readOnly?: boolean;
  onTurnOn?: () => void;
  onRegenerate?: () => void;
}

function LivePreview({
  pillar,
  name,
  role,
  paused,
}: {
  pillar: Pillar;
  name: string;
  role: string;
  paused: boolean;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-xl border border-app-border-subtle bg-app-surface-sunken">
      <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full border border-app-border bg-app-surface/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-app-text-secondary">
        <span
          className={clsx(
            "h-1.5 w-1.5 rounded-full",
            paused ? "bg-app-text-muted" : "bg-app-success",
          )}
        />
        Live preview
      </span>

      <div className="w-[188px] overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-md">
        <div className={clsx("relative h-8", tk.bg)}>
          <div
            className={clsx(
              "absolute -bottom-3 left-3 flex h-7 w-7 items-center justify-center rounded-full border-2 border-app-surface text-[9px] font-bold text-white",
              tk.bg,
            )}
          >
            {initials(name)}
          </div>
        </div>
        <div className="px-3 pb-2.5 pt-4">
          <p className="truncate text-[10px] font-bold text-app-text">{name}</p>
          <p className="mt-0.5 truncate text-[8px] text-app-text-secondary">
            {role}
          </p>
          <div className="mt-2 flex gap-1">
            {["9:00", "9:30", "10:00"].map((t) => (
              <span
                key={t}
                className={clsx(
                  "flex-1 rounded-md border py-1 text-center text-[8px] font-bold",
                  paused
                    ? "border-app-border bg-app-surface-sunken text-app-text-muted"
                    : clsx(tk.border, tk.bgSoft, tk.text),
                )}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-app-surface/60">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-app-warning-light bg-app-surface px-3 py-1 text-[11px] font-bold text-app-warning">
            <Pause className="h-3 w-3" aria-hidden />
            Paused
          </span>
        </div>
      )}
    </div>
  );
}

function CopyOnly({ url, pillar }: { url: string; pillar: Pillar }) {
  const tk = pillarTokens(pillar);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1 truncate rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text">
        {url}
      </div>
      <button
        type="button"
        onClick={async () => {
          const ok = await copyToClipboard(url);
          if (ok) {
            setCopied(true);
            toast.success("Link copied");
            setTimeout(() => setCopied(false), 2000);
          } else {
            toast.error("Could not copy the link");
          }
        }}
        className={clsx(
          "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold",
          tk.bg,
          tk.textOn,
        )}
      >
        {copied ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function BookingLinkCard({
  page,
  pillar,
  name,
  role,
  readOnly,
  onTurnOn,
  onRegenerate,
}: BookingLinkCardProps) {
  const tk = pillarTokens(pillar);
  const url = buildBookingPageUrl(page.slug);
  const paused = page.is_paused || !page.is_live;

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm">
      <div className="mb-2.5 flex items-center gap-1.5">
        <Link2 className={clsx("h-3.5 w-3.5", tk.text)} aria-hidden />
        <span className="text-[11.5px] font-bold text-app-text-strong">
          Your booking link
        </span>
        <span className="ml-auto text-[11px] text-app-text-secondary">
          Anyone with the link can book you
        </span>
      </div>

      <LivePreview pillar={pillar} name={name} role={role} paused={paused} />

      <div className="mt-3">
        {readOnly ? (
          <CopyOnly url={url} pillar={pillar} />
        ) : (
          <ShareLink
            url={url}
            pillar={pillar}
            label="Booking link"
            shareTitle={`Book time with ${name}`}
            draft={!page.is_live}
            onTurnOn={onTurnOn}
            onRegenerate={onRegenerate}
          />
        )}
      </div>
    </div>
  );
}
