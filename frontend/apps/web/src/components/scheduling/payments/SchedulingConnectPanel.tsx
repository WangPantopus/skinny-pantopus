"use client";

// W14 · G6 — Payments Setup / Stripe Connect & Tax. A status hero (Stripe badge,
// plain headline, three readiness pills: charges / payouts / details) over
// grouped Account + Tax cards. Reuses A14.6 row vocabulary + A18 status framing
// (not-connected · incomplete · ready · restricted · returned-from-Stripe).
// Connect/Resume/Finish reuse the platform Stripe Connect API (read-only);
// settings live in Stripe's hosted dashboard. Business violet accent; sky CTAs.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Check,
  CircleDollarSign,
  ExternalLink,
  FileText,
  Info,
  Percent,
  ShieldAlert,
  TextCursorInput,
} from "lucide-react";
import * as api from "@pantopus/api";
import type {
  PaymentsStatus,
  SchedulingOwnerRef,
  StripeAccount,
} from "@pantopus/types";
import { decodeError } from "@/components/scheduling/decodeError";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/toast-store";
import {
  Card,
  Dash,
  InlineNote,
  ReadyPill,
  SectionLabel,
  SettingRow,
  StatusChip,
} from "./kit";
import { type ConnectState, deriveConnectState } from "./connectState";

function StripeBadge() {
  // Brand mark (Stripe identity color), not a theme token.
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] text-lg font-extrabold text-white"
      style={{ background: "#635BFF" }}
      aria-hidden
    >
      S
    </span>
  );
}

function StatusHero({
  state,
}: {
  state: Exclude<ConnectState, "not_applicable">;
}) {
  const config = {
    not_connected: {
      headline: "Not connected",
      chip: <StatusChip tone="neutral">Off</StatusChip>,
      body: "Pantopus uses Stripe to charge for bookings and pay you out.",
      pills: ["off", "off", "off"] as const,
    },
    incomplete: {
      headline: "Setup unfinished",
      chip: <StatusChip tone="warning">In review</StatusChip>,
      body: "A few details are still needed before you can charge.",
      pills: ["warn", "off", "warn"] as const,
    },
    restricted: {
      headline: "Action needed",
      chip: <StatusChip tone="error">Restricted</StatusChip>,
      body: "Charges still work, but payouts are paused until you verify.",
      pills: ["on", "warn", "warn"] as const,
    },
    ready: {
      headline: "Stripe",
      chip: (
        <StatusChip tone="success" icon={Check}>
          Connected
        </StatusChip>
      ),
      body: "Charges and payouts are on. You're ready to take bookings.",
      pills: ["on", "on", "on"] as const,
    },
  }[state];

  return (
    <Card className="p-3.5">
      <div className="mb-3 flex items-start gap-3">
        <StripeBadge />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-app-text">
              {config.headline}
            </span>
            {config.chip}
          </div>
          <p className="mt-1 text-xs leading-snug text-app-text-secondary">
            {config.body}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <ReadyPill label="Charges" state={config.pills[0]} />
        <ReadyPill label="Payouts" state={config.pills[1]} />
        <ReadyPill label="Details" state={config.pills[2]} />
      </div>
    </Card>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  busy,
}: {
  icon: typeof ExternalLink;
  label: string;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center gap-3 border-t border-app-border-subtle px-4 py-3 text-left transition-colors hover:bg-app-hover disabled:opacity-60"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="flex-1 text-sm font-bold text-primary-600">
        {busy ? "Opening Stripe…" : label}
      </span>
      <ArrowRight className="h-4 w-4 text-primary-600 opacity-60" aria-hidden />
    </button>
  );
}

export default function SchedulingConnectPanel({
  owner,
}: {
  owner?: SchedulingOwnerRef;
}) {
  const searchParams = useSearchParams();
  const returned = searchParams.get("onboarding") === "success";

  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<PaymentsStatus | null>(null);
  const [account, setAccount] = useState<StripeAccount | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [openingDashboard, setOpeningDashboard] = useState(false);

  useEffect(() => {
    let alive = true;
    setPhase("loading");
    Promise.allSettled([
      api.scheduling.getPaymentsStatus(owner),
      api.payments.getStripeAccount(),
    ]).then(([s, a]) => {
      if (!alive) return;
      const statusOk = s.status === "fulfilled";
      if (statusOk) setStatus(s.value);
      setAccount(a.status === "fulfilled" ? (a.value.account ?? null) : null);
      // Status is the primary signal; a 404 on the account just means "none".
      setPhase(statusOk || a.status === "fulfilled" ? "ready" : "error");
    });
    return () => {
      alive = false;
    };
  }, [owner, reloadKey]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const result = account
        ? await api.payments.refreshStripeAccountLink()
        : await api.payments.connectStripeAccount();
      const link = "accountLink" in result ? result.accountLink : "";
      if (link) {
        window.location.href = link;
        return;
      }
      toast.error("Couldn't open the Stripe setup link.");
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setConnecting(false);
    }
  }, [account]);

  const openDashboard = useCallback(async () => {
    setOpeningDashboard(true);
    try {
      const result = await api.payments.connectStripeDashboard();
      if (result.dashboardUrl) {
        window.open(result.dashboardUrl, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Could not open the Stripe dashboard.");
      }
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setOpeningDashboard(false);
    }
  }, []);

  if (phase === "loading") {
    return (
      <div className="flex flex-col gap-3">
        <ShimmerBlock className="h-32 rounded-2xl" />
        <ShimmerBlock className="h-40 rounded-2xl" />
        <ShimmerBlock className="h-28 rounded-2xl" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <ErrorState
        message="We couldn't load your payments status."
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  const state = deriveConnectState(status, account);

  if (state === "not_applicable") {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <span className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-violet-100 text-violet-700">
          <Info className="h-8 w-8" aria-hidden />
        </span>
        <h2 className="text-base font-bold text-app-text">
          Payments are per-person
        </h2>
        <p className="mt-2 max-w-xs text-sm leading-snug text-app-text-secondary">
          Payments are managed per person. Switch to a personal or business
          space to connect Stripe and take booking payments.
        </p>
      </div>
    );
  }

  const gated = state === "not_connected";
  const chevron = (
    <ExternalLink className="h-4 w-4 text-app-text-muted" aria-hidden />
  );

  const action =
    state === "not_connected" ? (
      <ActionRow
        icon={ExternalLink}
        label="Connect Stripe"
        onClick={connect}
        busy={connecting}
      />
    ) : state === "incomplete" ? (
      <ActionRow
        icon={ArrowRight}
        label="Resume verification"
        onClick={connect}
        busy={connecting}
      />
    ) : state === "restricted" ? (
      <ActionRow
        icon={ArrowRight}
        label="Finish verification"
        onClick={connect}
        busy={connecting}
      />
    ) : null;

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-xs leading-snug text-app-text-secondary">
        Connect Stripe to take payments and get paid out.
      </p>

      {returned && state === "ready" && (
        <InlineNote tone="success" icon={Check}>
          You&apos;re set up to take payments. Welcome back from Stripe.
        </InlineNote>
      )}

      <StatusHero state={state} />

      {state === "incomplete" && (
        <InlineNote tone="warning" icon={AlertTriangle}>
          Finish setup on Stripe to start charging.
        </InlineNote>
      )}
      {state === "restricted" && (
        <InlineNote tone="error" icon={ShieldAlert}>
          Stripe needs more info to keep payouts on.
        </InlineNote>
      )}

      {/* Account group */}
      <div>
        <SectionLabel accent>Account</SectionLabel>
        <Card>
          <SettingRow
            icon={CircleDollarSign}
            label="Default currency"
            sub={gated ? undefined : "USD"}
            trailing={gated ? <Dash /> : chevron}
            onClick={gated ? undefined : openDashboard}
          />
          <SettingRow
            icon={TextCursorInput}
            label="Statement descriptor"
            sub={gated ? undefined : "Shown on the invitee's card statement"}
            trailing={gated ? <Dash /> : chevron}
            onClick={gated ? undefined : openDashboard}
          />
          {!gated && (
            <SettingRow
              icon={Banknote}
              label="Payouts"
              sub={
                state === "ready"
                  ? "Enabled · paid out by Stripe"
                  : state === "restricted"
                    ? "Paused — verification needed"
                    : "Available after verification"
              }
              trailing={chevron}
              onClick={openDashboard}
              last={!action}
            />
          )}
          {action}
        </Card>
      </div>

      {/* Tax group */}
      <div>
        <SectionLabel accent>Tax</SectionLabel>
        <Card>
          <SettingRow
            icon={Percent}
            label="Collect tax"
            sub={gated ? undefined : "Managed with Stripe Tax"}
            trailing={gated ? <Dash /> : chevron}
            onClick={gated ? undefined : openDashboard}
          />
          <SettingRow
            icon={FileText}
            label="Tax rate · Stripe Tax"
            sub={gated ? undefined : "Automatic by location"}
            trailing={gated ? <Dash /> : chevron}
            onClick={gated ? undefined : openDashboard}
            last
          />
        </Card>
      </div>

      {state === "ready" && (
        <button
          type="button"
          onClick={openDashboard}
          disabled={openingDashboard}
          className="mt-1 inline-flex items-center justify-center gap-2 self-start rounded-xl border border-app-border bg-app-surface px-4 py-2.5 text-sm font-semibold text-app-text-strong transition hover:bg-app-hover disabled:opacity-60"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          {openingDashboard ? "Opening…" : "Open Stripe dashboard"}
        </button>
      )}
    </div>
  );
}
