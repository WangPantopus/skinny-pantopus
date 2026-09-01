"use client";

// F9 — Bookable Home Resources · List. Same ListOfRows recipe as Bills /
// Maintenance / Pets. owner_type=home. Loaded / empty (templates) / loading /
// error / offline states. Each row shows an at-a-glance free/booked status
// derived from the home bookings list (read-only — we never create booking
// rows).

import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight,
  CloudOff,
  PackageOpen,
  Plus,
  RotateCw,
  WifiOff,
} from "lucide-react";
import { scheduling } from "@pantopus/api";
import type { Booking, Resource, ResourceType } from "@pantopus/types";
import { useSchedulingOwner } from "@/components/scheduling";
import { Card, PrimaryButton } from "./primitives";
import { resourceLiveStatus, resourceTypeMeta } from "./resourceMeta";

/** Backend Booking rows carry resource_id (select('*')) though the shared type omits it. */
type ResourceBookingRow = Booking & { resource_id?: string | null };

export interface ResourcePrefill {
  type: ResourceType;
  name: string;
}

/** Lightweight online/offline detection — navigator.onLine + 'offline'/'online' events. */
function useIsOnline(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => {
      window.removeEventListener("online", set);
      window.removeEventListener("offline", set);
    };
  }, []);
  return online;
}

const TEMPLATES: {
  label: string;
  prefill: ResourcePrefill;
  neutral?: boolean;
}[] = [
  { label: "Guest room", prefill: { type: "room", name: "Guest room" } },
  { label: "Driveway", prefill: { type: "vehicle", name: "Driveway" } },
  { label: "EV charger", prefill: { type: "charger", name: "EV charger" } },
  { label: "Tools", prefill: { type: "tool", name: "Power tools" } },
  { label: "Other", prefill: { type: "other", name: "" }, neutral: true },
];

export default function ResourceList({
  canEdit,
  onOpenResource,
  onAddResource,
}: {
  canEdit: boolean;
  onOpenResource: (rid: string) => void;
  onAddResource: (prefill?: ResourcePrefill) => void;
}) {
  const owner = useSchedulingOwner();
  const isOnline = useIsOnline();
  const [resources, setResources] = useState<Resource[] | null>(null);
  const [bookings, setBookings] = useState<ResourceBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [resRes, bookRes] = await Promise.all([
        scheduling.listResources(owner),
        scheduling
          .listBookings({}, owner)
          .catch(() => ({ bookings: [] as Booking[] })),
      ]);
      setResources(resRes.resources);
      setBookings(bookRes.bookings as ResourceBookingRow[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    void load();
  }, [load]);

  const bookingsFor = (rid: string) =>
    bookings.filter((b) => b.resource_id === rid);

  // ─── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i} className="!p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-app-surface-sunken" />
              <div className="flex-1">
                <div className="h-3 w-1/2 animate-pulse rounded bg-app-surface-sunken" />
                <div className="mt-2 h-3.5 w-12 animate-pulse rounded-full bg-app-surface-sunken" />
              </div>
              <div className="h-3 w-14 animate-pulse rounded bg-app-surface-sunken" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center px-7 py-16 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-app-error-bg">
          <CloudOff className="h-7 w-7 text-app-error" />
        </div>
        <div className="text-[15.5px] font-bold text-app-text">
          Couldn&apos;t load resources
        </div>
        <p className="mt-1.5 max-w-[220px] text-[12.5px] text-app-text-secondary">
          Check your connection and try again.
        </p>
        <div className="mt-4 w-40">
          <PrimaryButton icon={RotateCw} onClick={() => void load()}>
            Retry
          </PrimaryButton>
        </div>
      </div>
    );
  }

  // ─── Empty (templates) ────────────────────────────────────
  if (!resources || resources.length === 0) {
    return (
      <div className="flex flex-col gap-2.5">
        <Card className="text-center !p-5">
          <div className="mx-auto mb-3 flex h-[50px] w-[50px] items-center justify-center rounded-2xl bg-app-home-bg">
            <PackageOpen className="h-6 w-6 text-app-home" />
          </div>
          <div className="text-[15px] font-bold text-app-text">
            Add what your household shares
          </div>
          <p className="mx-auto mt-1.5 max-w-[260px] text-[12px] leading-[17px] text-app-text-secondary">
            Anything members book — rooms, the driveway, tools. Start from a
            template.
          </p>
        </Card>
        {canEdit && (
          <>
            <div className="px-0.5 pt-1 text-[11px] font-bold uppercase tracking-[0.06em] text-app-text-secondary">
              Templates
            </div>
            {TEMPLATES.map((t) => {
              const meta = resourceTypeMeta(t.prefill.type);
              const Icon = t.neutral ? Plus : meta.Icon;
              return (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => onAddResource(t.prefill)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-3 py-2.5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:border-app-home/40"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      t.neutral
                        ? "bg-app-surface-sunken text-app-text-secondary"
                        : "bg-app-home-bg text-app-home"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <span className="flex-1 text-[13.5px] font-bold text-app-text">
                    {t.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-app-text-muted" />
                </button>
              );
            })}
          </>
        )}
      </div>
    );
  }

  // ─── Loaded (with optional offline banner + row dimming) ─────
  return (
    <div className="flex flex-col gap-2.5">
      {!isOnline && (
        <div className="flex items-start gap-2.5 rounded-xl border border-app-warning/30 bg-app-warning-bg px-3 py-2.5">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-app-warning" />
          <div className="min-w-0 text-[12px] leading-[17px] text-app-warning">
            <div className="font-bold">You&apos;re offline</div>
            <div className="opacity-90">
              Showing cached resources. Availability may be out of date.
            </div>
          </div>
        </div>
      )}
      {resources.map((r) => {
        const meta = resourceTypeMeta(r.resource_type);
        const status = resourceLiveStatus(bookingsFor(r.id));
        const free = status.state === "free";
        return (
          <Card
            key={r.id}
            className={`!p-3 ${!isOnline ? "opacity-[0.55]" : ""}`}
            onClick={() => onOpenResource(r.id)}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-home-bg text-app-home">
                <meta.Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold tracking-tight text-app-text">
                  {r.name}
                </div>
                <span className="mt-1 inline-flex rounded-full bg-app-surface-sunken px-2 py-0.5 text-[10px] font-semibold text-app-text-secondary">
                  {meta.label}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className={`h-[7px] w-[7px] rounded-full ${free ? "bg-app-success" : "bg-app-text-muted"}`}
                />
                <span
                  className={`whitespace-nowrap text-[11px] font-semibold ${free ? "text-app-success" : "text-app-text-secondary"}`}
                >
                  {status.label}
                </span>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
