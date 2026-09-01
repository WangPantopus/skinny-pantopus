"use client";

// C3 — "Share your link" sheet. Presented LOCALLY from the booking-page manager
// (no global route). Reuses the W0 ShareLink (URL + copy + native share + QR +
// draft banner) and layers the design's extra rows: a "Show on my profile"
// toggle (wired to the page's listed/unlisted visibility) and an email-signature
// hint, plus a regenerate-link danger confirm that resets the slug.

import { useState } from "react";
import { Mail, RotateCcw, UserRound } from "lucide-react";
import BottomSheet from "@/components/ui/BottomSheet";
import ShareLink from "@/components/scheduling/ShareLink";
import type { Pillar } from "@/components/scheduling/pillarTokens";
import { ToggleRow } from "./controls";
import ConfirmDialog from "./ConfirmDialog";

export default function ShareSheet({
  open,
  onClose,
  url,
  pillar = "personal",
  draft = false,
  onTurnOn,
  listed,
  onToggleListed,
  onRegenerate,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  pillar?: Pillar;
  draft?: boolean;
  onTurnOn?: () => void;
  /** Page is listed on the public profile (visibility === 'listed'). */
  listed?: boolean;
  onToggleListed?: (next: boolean) => void;
  /** Resets the slug (new public link). */
  onRegenerate?: () => Promise<void> | void;
}) {
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [emailSig, setEmailSig] = useState(false);

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    setRegenerating(true);
    try {
      await onRegenerate();
      setConfirmRegen(false);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Share booking link">
      <div className="space-y-5">
        <ShareLink
          url={url}
          pillar={pillar}
          label={`${pillar === "business" ? "Business" : pillar === "home" ? "Home" : "Personal"} booking link`}
          draft={draft}
          onTurnOn={onTurnOn}
          onRegenerate={onRegenerate ? () => setConfirmRegen(true) : undefined}
        />

        <div className="rounded-2xl border border-app-border bg-app-surface px-3 shadow-sm">
          <ToggleRow
            icon={UserRound}
            label="Show on my profile"
            sub="People see a Book button on your page."
            on={!!listed}
            onChange={(next) => onToggleListed?.(next)}
          />
          <ToggleRow
            icon={Mail}
            label="Add to email signature"
            sub="Append the link to outgoing mail."
            on={emailSig}
            onChange={setEmailSig}
            last
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmRegen}
        icon={RotateCcw}
        title="Regenerate this link?"
        body="The old link stops working. Anyone using it will need the new one."
        confirmLabel="Regenerate"
        busy={regenerating}
        onConfirm={handleRegenerate}
        onCancel={() => {
          if (!regenerating) setConfirmRegen(false);
        }}
      />
    </BottomSheet>
  );
}
