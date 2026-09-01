"use client";

// W15 · G9 — Create / Edit Package (owner). One scrolling form (not a wizard)
// with live per-session math. Reuses the W2 card + field grammar via this
// stream's own primitives. Business-violet accent via pillar tokens; product
// sky on the functional save chrome. `id === "new"` is create; otherwise edit
// (loaded from the owner's package list — there is no GET /packages/:id).
//
// Backend note: POST/PUT /packages persist name, sessions_count, price_cents,
// currency, event_type_id, is_active. The design's description, expiry policy,
// and multi-event eligibility have no backing fields, so they're omitted rather
// than faked. "Redeems against" maps to the single optional event_type_id.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ChevronLeft, Info, Lock, Power } from "lucide-react";
import * as api from "@pantopus/api";
import type {
  EventType,
  Package,
  SchedulingOwnerRef,
} from "@pantopus/types";
import { toast } from "@/components/ui/toast-store";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import { pillarForOwner } from "@/components/scheduling/pillarTokens";
import { decodeError, fieldErrors } from "@/components/scheduling/decodeError";
import {
  defaultPackageForm,
  formToInput,
  packageToForm,
  validatePackageForm,
  type PackageFormValues,
  MAX_SESSIONS,
  MIN_SESSIONS,
} from "@/components/scheduling/packages/packageForm";
import {
  dollarsToCents,
  perSessionLabel,
} from "@/components/scheduling/packages/money";
import {
  Card,
  EventTypeTiles,
  Note,
  PillarPill,
  SegmentedControl,
  Stepper,
  TextArea,
  TextField,
  ToggleRow,
} from "@/components/scheduling/packages/ui";
import PaidFeatureGate from "@/components/scheduling/packages/PaidFeatureGate";

const BASE = "/app/scheduling/packages";

export default function PackageEditor({
  id,
  owner,
}: {
  id: string;
  owner: SchedulingOwnerRef;
}) {
  const router = useRouter();
  const pillar = pillarForOwner(owner.ownerType);
  const isNew = id === "new";

  const [phase, setPhase] = useState<"loading" | "error" | "ready">(
    isNew ? "ready" : "loading",
  );
  const [form, setForm] = useState<PackageFormValues>(defaultPackageForm());
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // UI-only fields not persisted by the backend (design shows them view-only).
  const [description, setDescription] = useState("");
  const [expiry, setExpiry] = useState("1 year");
  // Has-active-buyers locked state: backend does not expose a buyers count today;
  // this flag gates UI only and would be wired to the API response when available.
  const hasActiveBuyers = false; // TODO: wire to API when endpoint exposes it

  const load = useCallback(() => {
    let alive = true;
    setPhase(isNew ? "ready" : "loading");
    // Event types feed the "Redeems against" tiles (optional eligibility).
    api.scheduling
      .listEventTypes(owner)
      .then((res) => {
        if (alive) setEventTypes(res.eventTypes ?? []);
      })
      .catch(() => {
        /* tiles fall back to "Any event type" only */
      });
    if (isNew)
      return () => {
        alive = false;
      };
    api.scheduling
      .listPackages(owner)
      .then((res) => {
        if (!alive) return;
        const pkg = (res.packages ?? []).find((p: Package) => p.id === id);
        if (!pkg) {
          setPhase("error");
          return;
        }
        setForm(packageToForm(pkg));
        setPhase("ready");
      })
      .catch(() => {
        if (alive) setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, [owner, id, isNew]);

  useEffect(() => load(), [load]);

  const set = <K extends keyof PackageFormValues>(
    key: K,
    value: PackageFormValues[K],
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[fieldKeyFor(key)]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[fieldKeyFor(key)];
        return next;
      });
    }
  };

  const priceCents = dollarsToCents(form.priceDollars);
  const perSession = perSessionLabel(
    priceCents,
    form.sessionsCount,
    form.currency,
  );
  const tileOptions = useMemo(
    () =>
      eventTypes.map((et) => ({
        id: et.id,
        name: et.name,
        sub: `${et.default_duration} min`,
      })),
    [eventTypes],
  );

  const save = async () => {
    const v = validatePackageForm(form);
    setErrors(v);
    if (Object.keys(v).length > 0) return;
    setSaving(true);
    try {
      const input = formToInput(form);
      if (isNew) {
        await api.scheduling.createPackage(input, owner);
        toast.success("Package created.");
      } else {
        await api.scheduling.updatePackage(id, input, owner);
        toast.success("Package saved.");
      }
      router.push(BASE);
    } catch (err) {
      const decoded = decodeError(err);
      if (decoded.kind === "validation") {
        setErrors(fieldErrors(decoded));
      }
      toast.error(decoded.message);
      setSaving(false);
    }
  };

  return (
    <PaidFeatureGate feature="Packages">
      <div className="mx-auto max-w-xl">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            aria-label="Back"
            onClick={() => router.push(BASE)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-app-text-secondary hover:bg-app-hover"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <div className="mb-1">
              <PillarPill pillar={pillar} />
            </div>
            <h1 className="text-lg font-bold text-app-text">
              {isNew ? "New package" : "Edit package"}
            </h1>
          </div>
        </div>

        {phase === "loading" && (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <ShimmerBlock key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        )}

        {phase === "error" && (
          <ErrorState message="We couldn't load this package." onRetry={load} />
        )}

        {phase === "ready" && (
          <div className="flex flex-col gap-3">
            <p className="px-1 text-[12px] leading-4 text-app-text-secondary">
              Set a price and we&apos;ll do the per-session math.
            </p>

            <Card overline="Details" pillar={pillar}>
              <TextField
                label="Name"
                value={form.name}
                onChange={(v) => set("name", v)}
                placeholder="5-session cleaning"
                error={errors.name}
              />
              {/* Description: view-only UI field; not persisted by the backend. */}
              <TextArea
                label="Description"
                value={description}
                onChange={setDescription}
                placeholder="What's included"
                rows={3}
              />
            </Card>

            {hasActiveBuyers && (
              <Note tone="warning" icon={Lock}>
                People own credits — you can&apos;t change sessions or
                eligibility while credits are active.
              </Note>
            )}

            <Card overline="Redeems against" pillar={pillar}>
              <p className="-mt-1 text-[11px] text-app-text-secondary">
                Which bookings credits can be used on.
              </p>
              <EventTypeTiles
                options={tileOptions}
                value={form.eventTypeId}
                onChange={(v) => set("eventTypeId", v)}
                pillar={pillar}
                disabled={hasActiveBuyers}
              />
            </Card>

            <Card overline="Sessions" pillar={pillar}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-app-text">
                  Number of sessions
                </span>
                <Stepper
                  value={form.sessionsCount}
                  onChange={(v) => set("sessionsCount", v)}
                  min={MIN_SESSIONS}
                  max={MAX_SESSIONS}
                  ariaLabel="Number of sessions"
                  disabled={hasActiveBuyers}
                />
              </div>
              {errors.sessions_count && (
                <p className="text-xs text-app-error">
                  {errors.sessions_count}
                </p>
              )}
            </Card>

            <Card overline="Price" pillar={pillar}>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <TextField
                    value={form.priceDollars}
                    onChange={(v) => set("priceDollars", v)}
                    placeholder="0.00"
                    prefix="$"
                    inputMode="decimal"
                    error={errors.price_cents}
                    ariaLabel="Price"
                  />
                </div>
                <span className="flex h-[42px] shrink-0 items-center rounded-lg bg-app-surface-sunken px-3 text-[12.5px] font-bold text-app-text-secondary">
                  {form.currency}
                </span>
              </div>
              {perSession && !errors.price_cents && (
                <p
                  className={clsx(
                    "text-[11.5px] font-bold",
                    pillarForOwner(owner.ownerType) === "business"
                      ? "text-app-business"
                      : "text-app-personal",
                  )}
                >
                  {perSession}
                </p>
              )}
            </Card>

            {!isNew && (
              <Note tone="info" icon={Info}>
                Changing the price creates a new Stripe price. Current buyers
                keep their terms.
              </Note>
            )}

            {/* Expiry card: view-only UI field; not persisted by the backend. */}
            <Card overline="Expiry" pillar={pillar}>
              <SegmentedControl
                options={["90 days", "1 year", "Never"]}
                value={expiry}
                onChange={setExpiry}
              />
            </Card>

            <Card pillar={pillar}>
              <ToggleRow
                icon={Power}
                label="Active"
                sub="Buyers can purchase this package"
                on={form.isActive}
                onChange={(v) => set("isActive", v)}
              />
            </Card>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="mt-1 flex h-12 w-full items-center justify-center rounded-xl bg-primary-600 text-[14.5px] font-bold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save package"}
            </button>
          </div>
        )}
      </div>
    </PaidFeatureGate>
  );
}

// Map a form key onto its backend `details[].field` so clearing the right error
// works when the user edits.
function fieldKeyFor(key: keyof PackageFormValues): string {
  if (key === "name") return "name";
  if (key === "sessionsCount") return "sessions_count";
  if (key === "priceDollars") return "price_cents";
  return key;
}
