"use client";

// A3 — Booking settings root. A grouped settings index gathering every booking
// preference + automation entry point for the active pillar: Automation,
// Scheduling defaults, Payments, and a red danger zone (reset link / disable),
// closed by a mono footer with the booking URL + owner id. Business adds a Team
// group with an auto-confirm vs approve-first control.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import {
  Bell,
  BellRing,
  CalendarX,
  Check,
  Clock,
  CreditCard,
  Globe,
  Lock,
  LockOpen,
  MessageSquare,
  RotateCcw,
  Users,
  Workflow,
} from "lucide-react";
import * as api from "@pantopus/api";
import type {
  BookingPage,
  CancellationPolicyValue,
  SchedulingOwnerRef,
} from "@pantopus/types";
import { resolvePolicyValue } from "@/components/scheduling/policyValue";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import { PillarThemeProvider } from "@/components/scheduling/PillarThemeProvider";
import {
  pillarForOwner,
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import TimezoneSelector, {
  zoneLabel,
} from "@/components/scheduling/TimezoneSelector";
import ErrorState from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/toast-store";
import { confirmStore } from "@/components/ui/confirm-store";
import { useHubOwners } from "./owners";
import { reminderLabel } from "./format";
import {
  AccentOverline,
  Card,
  Chevron,
  Chip,
  ChipChevron,
  ConnectPill,
  MonoFooter,
  Row,
  Segmented,
} from "./ui";

const BASE = "/app/scheduling";

function isPillar(v: string | null): v is Pillar {
  return v === "personal" || v === "home" || v === "business";
}

// Tolerates the string wire shape (iOS preset name / free text).
function cancellationLabel(
  value: CancellationPolicyValue | null,
): string | null {
  const p = resolvePolicyValue(value);
  if (!p) return null;
  const cutoff = typeof p.cutoff_min === "number" ? p.cutoff_min : null;
  if (cutoff == null) return p.notes ? "Custom policy" : null;
  if (cutoff % 1440 === 0) return `${cutoff / 1440}-day notice`;
  if (cutoff % 60 === 0) return `${cutoff / 60}-hour notice`;
  return `${cutoff} min notice`;
}

function reminderSummary(minutes: number[] | undefined): string | null {
  if (!minutes || minutes.length === 0) return null;
  return [...minutes]
    .sort((a, b) => b - a)
    .map(reminderLabel)
    .join(" · ");
}

export default function BookingSettings() {
  const router = useRouter();
  const sp = useSearchParams();
  const routeOwner = useSchedulingOwner();
  const { owners, loading: ownersLoading } = useHubOwners();

  const pillarParam = sp?.get("pillar") ?? null;
  const pillar: Pillar = isPillar(pillarParam)
    ? pillarParam
    : pillarForOwner(routeOwner.ownerType);
  const owner = useMemo<SchedulingOwnerRef | null>(
    () =>
      pillar === "personal" ? { ownerType: "user" } : owners[pillar].owner,
    [pillar, owners],
  );

  const [page, setPage] = useState<BookingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tzOpen, setTzOpen] = useState(false);

  const load = useCallback(async () => {
    if (!owner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { page: loaded } = await api.scheduling.getBookingPage(owner);
      setPage(loaded);
    } catch (err) {
      setError(decodeError(err).message);
    } finally {
      setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = useCallback(
    async (
      body: Parameters<typeof api.scheduling.updateBookingPage>[0],
      msg: string,
    ) => {
      if (!owner) return;
      setBusy(true);
      try {
        const { page: updated } = await api.scheduling.updateBookingPage(
          body,
          owner,
        );
        setPage(updated);
        toast.success(msg);
      } catch (err) {
        toast.error(decodeError(err).message || "Couldn’t save");
      } finally {
        setBusy(false);
      }
    },
    [owner],
  );

  const handleReset = useCallback(async () => {
    if (!owner) return;
    const ok = await confirmStore.open({
      title: "Reset booking link?",
      description:
        "Your current link stops working immediately and a new one is generated.",
      confirmLabel: "Reset link",
      cancelLabel: "Keep current",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const { page: updated } = await api.scheduling.resetSlug(owner);
      setPage(updated);
      toast.success("New booking link generated");
    } catch (err) {
      toast.error(decodeError(err).message || "Couldn’t reset the link");
    } finally {
      setBusy(false);
    }
  }, [owner]);

  const handleDisable = useCallback(async () => {
    if (!owner) return;
    const ok = await confirmStore.open({
      title: "Disable scheduling?",
      description:
        "Your public booking page goes offline. You can turn it back on any time.",
      confirmLabel: "Disable",
      cancelLabel: "Keep live",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const { page: updated } = await api.scheduling.disableBookingPage(owner);
      setPage(updated);
      toast.success("Scheduling disabled");
    } catch (err) {
      toast.error(decodeError(err).message || "Couldn’t disable scheduling");
    } finally {
      setBusy(false);
    }
  }, [owner]);

  const approvalMode = useMemo<"auto" | "approve">(() => {
    const v = page?.branding?.["default_requires_approval"];
    return v === true ? "approve" : "auto";
  }, [page]);

  const isLoading = loading || (pillar !== "personal" && ownersLoading);

  if (!owner && !isLoading) {
    return (
      <ErrorState
        message={`No ${pillar} scheduling is available on this account.`}
        onRetry={() => router.push(BASE)}
      />
    );
  }

  return (
    <PillarThemeProvider pillar={pillar}>
      <div className="mx-auto max-w-2xl" aria-busy={busy}>
        <h1 className="mb-4 text-xl font-bold text-app-text">
          Booking settings
        </h1>

        {isLoading ? (
          <div className="space-y-4" aria-hidden>
            <div className="h-44 w-full animate-pulse rounded-xl bg-app-surface-sunken" />
            <div className="h-40 w-full animate-pulse rounded-xl bg-app-surface-sunken" />
            <div className="h-28 w-full animate-pulse rounded-xl bg-app-surface-sunken" />
          </div>
        ) : error || !page ? (
          <ErrorState
            message={error ?? "Couldn’t load settings."}
            onRetry={() => void load()}
          />
        ) : (
          <div className="space-y-1">
            {pillar === "business" && (
              <section>
                <AccentOverline pillar={pillar} className="pb-2 pt-2">
                  Team
                </AccentOverline>
                <Card>
                  <Row
                    icon={Users}
                    label="Team & seats"
                    sub="Manage who can take bookings"
                    href={`${BASE}/business`}
                    right={<Chevron />}
                  />
                  <div className="px-4 py-3.5">
                    <p className="text-[15px] font-medium text-app-text">
                      New bookings
                    </p>
                    <p className="mt-0.5 text-xs text-app-text-secondary">
                      Choose how incoming bookings are handled.
                    </p>
                    <div className="mt-2.5">
                      <Segmented
                        pillar={pillar}
                        value={approvalMode}
                        options={[
                          { id: "auto", label: "Auto-confirm" },
                          { id: "approve", label: "Approve first" },
                        ]}
                        onChange={(id) =>
                          void patch(
                            {
                              branding: {
                                ...(page.branding ?? {}),
                                default_requires_approval: id === "approve",
                              },
                            },
                            "Default updated",
                          )
                        }
                      />
                    </div>
                  </div>
                </Card>
              </section>
            )}

            <section>
              <AccentOverline pillar={pillar} className="pb-2 pt-4">
                Automation
              </AccentOverline>
              <Card helper="Reminders go out automatically before each booking.">
                <Row
                  icon={BellRing}
                  label="Default reminders"
                  sub={reminderSummary(page.reminder_minutes) ?? undefined}
                  href={`${BASE}/reminders`}
                  right={
                    reminderSummary(page.reminder_minutes) ? (
                      <Chevron />
                    ) : (
                      <ChipChevron>
                        <Chip tone="warning">Off</Chip>
                      </ChipChevron>
                    )
                  }
                />
                <Row
                  icon={Workflow}
                  label="Workflows & follow-ups"
                  sub="Automate messages around bookings"
                  href={`${BASE}/workflows`}
                  right={<Chevron />}
                />
                <Row
                  icon={MessageSquare}
                  label="Message templates"
                  sub="Reusable booking messages"
                  href={`${BASE}/templates`}
                  right={<Chevron />}
                />
                <Row
                  icon={Bell}
                  label="Booking notifications"
                  sub="Choose your channels"
                  href={`${BASE}/settings/notifications`}
                  right={<Chevron />}
                />
              </Card>
            </section>

            <section>
              <AccentOverline pillar={pillar} className="pb-2 pt-4">
                Scheduling defaults
              </AccentOverline>
              <Card>
                <Row
                  icon={Globe}
                  label="Default timezone"
                  sub={page.timezone ? zoneLabel(page.timezone) : "Not set"}
                  onClick={() => setTzOpen(true)}
                  right={
                    <div className="flex items-center gap-1.5">
                      <span
                        className={clsx(
                          "flex h-7 w-7 items-center justify-center rounded-lg border",
                          page.timezone
                            ? clsx(
                                pillarTokens(pillar).bgSoft,
                                pillarTokens(pillar).text,
                                "border-transparent",
                              )
                            : "border-app-border bg-app-surface-sunken text-app-text-muted",
                        )}
                      >
                        {page.timezone ? (
                          <Lock className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <LockOpen className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </span>
                      <Chevron />
                    </div>
                  }
                />
                <Row
                  icon={Clock}
                  label="Default availability"
                  sub="Your weekly hours"
                  href={`${BASE}/availability`}
                  right={<Chevron />}
                />
                <Row
                  icon={CalendarX}
                  label="Cancellation policy"
                  sub={cancellationLabel(page.cancellation_policy) ?? undefined}
                  href={`${BASE}/payments/policy`}
                  right={
                    cancellationLabel(page.cancellation_policy) ? (
                      <Chevron />
                    ) : (
                      <ChipChevron>
                        <Chip tone="warning">Set up</Chip>
                      </ChipChevron>
                    )
                  }
                />
              </Card>
            </section>

            <section>
              <AccentOverline pillar={pillar} className="pb-2 pt-4">
                Payments
              </AccentOverline>
              {/* stripeConnected: no backend field available yet — renders ConnectPill (fresh state) per design placeholder */}
              {(() => {
                const stripeConnected = !!(page as unknown as Record<string, unknown>)["payments_connected"];
                return (
                  <Card helper="Required only for paid event types.">
                    <Row
                      icon={CreditCard}
                      label="Payments & payouts"
                      sub={stripeConnected ? "Stripe · ••••" : "Take payment at booking"}
                      href={stripeConnected ? `${BASE}/payments` : undefined}
                      onClick={stripeConnected ? undefined : () => router.push(`${BASE}/payments`)}
                      right={
                        stripeConnected ? (
                          <ChipChevron>
                            <Chip tone="success" icon={Check}>Connected</Chip>
                          </ChipChevron>
                        ) : (
                          <ConnectPill
                            pillar={pillar}
                            onClick={() => router.push(`${BASE}/payments`)}
                          />
                        )
                      }
                    />
                  </Card>
                );
              })()}
            </section>

            <section>
              <AccentOverline
                pillar="personal"
                className="pb-2 pt-4 !text-app-error"
              >
                Danger zone
              </AccentOverline>
              <Card tone="danger">
                <Row
                  icon={RotateCcw}
                  label="Reset booking link"
                  destructive
                  onClick={handleReset}
                />
                <Row
                  icon={CalendarX}
                  label="Disable scheduling"
                  destructive
                  onClick={handleDisable}
                />
              </Card>
              <MonoFooter>
                {`${page.slug} · ${owner!.ownerType}${owner!.ownerId ? ` #${owner!.ownerId.slice(0, 8)}` : ""}`}
              </MonoFooter>
            </section>
          </div>
        )}

        {page && (
          <TimezoneSelector
            open={tzOpen}
            onClose={() => setTzOpen(false)}
            value={page.timezone ?? undefined}
            onSelect={(z) => {
              setTzOpen(false);
              void patch({ timezone: z }, "Timezone updated");
            }}
            pillar={pillar}
          />
        )}
      </div>
    </PillarThemeProvider>
  );
}
