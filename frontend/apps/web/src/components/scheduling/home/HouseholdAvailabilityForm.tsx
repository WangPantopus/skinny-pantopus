"use client";

// F8 — My household availability settings. A boundary screen that governs
// EXPOSURE only — it never edits the source availability (that lives in
// Personal, deep-linked). The exposure toggles round-trip as flexible keys on
// the home-scoped notification preferences (object.unknown(true) on the
// backend). "Not set up" derives from an empty personal availability.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CalendarX,
  ChevronRight,
  ExternalLink,
  Eye,
  Home as HomeIcon,
  Info,
  Loader2,
  Moon,
  Repeat,
} from "lucide-react";
import * as api from "@pantopus/api";
import type { NotificationPreferences } from "@pantopus/types";
import { toast } from "@/components/ui/toast-store";
import { confirmStore } from "@/components/ui/confirm-store";
import ErrorState from "@/components/ui/ErrorState";
import { decodeError } from "@/components/scheduling/decodeError";

type ToggleKey =
  | "home_share_free_busy"
  | "home_round_robin"
  | "home_auto_decline";

const DEFAULTS: Record<ToggleKey, boolean> = {
  home_share_free_busy: true,
  home_round_robin: true,
  home_auto_decline: false,
};

export default function HouseholdAvailabilityForm({
  homeId,
}: {
  homeId: string;
}) {
  const router = useRouter();
  const owner = { ownerType: "home" as const, homeId };

  const [prefs, setPrefs] = useState<NotificationPreferences>({});
  const [notSetUp, setNotSetUp] = useState(false);
  const [homeName, setHomeName] = useState<string>("this household");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<ToggleKey | null>(null);

  const load = useCallback(async () => {
    try {
      const [availRes, prefsRes, homeRes] = await Promise.allSettled([
        api.scheduling.getAvailability(),
        api.scheduling.getNotificationPreferences(owner),
        api.homes.getHome(homeId),
      ]);
      if (availRes.status === "fulfilled") {
        setNotSetUp((availRes.value.schedules || []).length === 0);
      }
      if (prefsRes.status === "fulfilled") {
        setPrefs(prefsRes.value.prefs || {});
      } else {
        // prefs endpoint failure shouldn't blank the screen — start from defaults
        setPrefs({});
      }
      if (homeRes.status === "fulfilled") {
        setHomeName(homeRes.value.home?.address || "this household");
      }
      setError(null);
    } catch (err) {
      setError(decodeError(err).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const valueOf = (k: ToggleKey): boolean =>
    typeof prefs[k] === "boolean" ? (prefs[k] as boolean) : DEFAULTS[k];

  const persist = async (k: ToggleKey, next: boolean) => {
    const prev = prefs;
    const merged: NotificationPreferences = { ...prefs, [k]: next };
    setPrefs(merged);
    setSavingKey(k);
    try {
      const res = await api.scheduling.updateNotificationPreferences(
        merged,
        owner,
      );
      if (res?.prefs) setPrefs(res.prefs);
    } catch (err) {
      setPrefs(prev);
      toast.error(decodeError(err).message || "Couldn't save");
    } finally {
      setSavingKey(null);
    }
  };

  const onToggle = async (k: ToggleKey) => {
    if (notSetUp || savingKey) return;
    const next = !valueOf(k);
    // Opting out of free/busy sharing asks for confirmation.
    if (k === "home_share_free_busy" && !next) {
      const ok = await confirmStore.open({
        title: `Hide your free/busy from ${homeName}?`,
        description: "They won't be able to include you in Find a time.",
        confirmLabel: "Hide",
        cancelLabel: "Keep sharing",
        variant: "destructive",
      });
      if (!ok) return;
    }
    void persist(k, next);
  };

  if (loading) return <SettingsSkeleton />;
  if (error)
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          setLoading(true);
          void load();
        }}
      />
    );

  const sharing = valueOf("home_share_free_busy");

  return (
    <div className="space-y-3">
      {/* context header */}
      <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-home-bg">
          <HomeIcon className="h-5 w-5 text-app-home" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold tracking-tight text-app-text">
            {homeName}
          </div>
          <div className="mt-0.5 text-[11.5px] text-app-text-secondary">
            How you appear here
          </div>
        </div>
      </div>

      {notSetUp && (
        <>
          <div className="flex items-start gap-2.5 rounded-xl border border-app-info-light bg-app-info-bg px-3 py-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-app-info" />
            <div>
              <div className="text-[12px] font-bold text-app-info">
                Set up your availability in Personal first
              </div>
              <div className="mt-0.5 text-[11.5px] leading-4 text-app-text-secondary">
                Until you set your free/busy hours, this household can&apos;t
                see when you&apos;re free.
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push("/app/scheduling/availability")}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-app-home text-sm font-bold text-white"
          >
            <ExternalLink className="h-4 w-4" /> Set it up in Personal
          </button>
        </>
      )}

      {/* source deep-link — only shown when personal availability is set up */}
      {!notSetUp && (
        <div>
          <SectionLabel>Source</SectionLabel>
          <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <button
              onClick={() => router.push("/app/scheduling/availability")}
              className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-app-info-light bg-app-info-bg text-app-info">
                <Calendar className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-app-text">
                  Edit my full availability in Personal
                </div>
                <div className="mt-0.5 text-[10.5px] leading-[14px] text-app-text-secondary">
                  Your source of truth — changes apply everywhere
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-app-text-muted" />
            </button>
          </div>
        </div>
      )}

      {/* exposure toggles */}
      <div>
        <SectionLabel>What this household sees</SectionLabel>
        <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <ToggleRow
            icon={<Eye className="h-4 w-4" />}
            label="Share my free/busy with this household"
            sub="Members see when you're free, never event details"
            on={sharing}
            disabled={notSetUp}
            saving={savingKey === "home_share_free_busy"}
            onToggle={() => onToggle("home_share_free_busy")}
            first
          />
          <ToggleRow
            icon={<Repeat className="h-4 w-4" />}
            label="Include me in round-robin rotation"
            sub="You can be auto-assigned when more than one is free"
            on={valueOf("home_round_robin")}
            disabled={notSetUp || !sharing}
            saving={savingKey === "home_round_robin"}
            onToggle={() => onToggle("home_round_robin")}
          />
          {!notSetUp && (
            <DisclosureRow
              icon={<Moon className="h-4 w-4" />}
              label="Household quiet hours"
              value="Weeknights 9 PM"
            />
          )}
          <ToggleRow
            icon={<CalendarX className="h-4 w-4" />}
            label="Auto-decline conflicting invites"
            on={valueOf("home_auto_decline")}
            disabled={notSetUp}
            saving={savingKey === "home_auto_decline"}
            onToggle={() => onToggle("home_auto_decline")}
            last
          />
        </div>
      </div>

      <p className="px-1 text-[11px] leading-4 text-app-text-secondary">
        This only controls what this household sees. It doesn&apos;t change your
        personal calendar.
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 pl-1 text-[9.5px] font-bold uppercase tracking-[0.08em] text-app-text-secondary">
      {children}
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  sub,
  on,
  disabled,
  saving,
  onToggle,
  first,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  on: boolean;
  disabled?: boolean;
  saving?: boolean;
  onToggle: () => void;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3.5 py-3 ${
        first ? "" : "border-t border-app-border"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          on && !disabled
            ? "bg-app-home-bg text-app-home"
            : "bg-app-surface-sunken text-app-text-secondary"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold leading-tight text-app-text">
          {label}
        </div>
        {sub && (
          <div className="mt-0.5 text-[10.5px] leading-[14px] text-app-text-secondary">
            {sub}
          </div>
        )}
      </div>
      {saving ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-app-home" />
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          disabled={disabled}
          onClick={onToggle}
          className={`relative h-5 w-9 shrink-0 rounded-full transition disabled:cursor-not-allowed ${
            on && !disabled ? "bg-app-home" : "bg-app-border-strong"
          } ${last ? "" : ""}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
              on ? "left-[18px]" : "left-0.5"
            }`}
          />
        </button>
      )}
    </div>
  );
}

/** DisclosureRow — navigation row with icon, label, value text, and chevron.
 *  Design: availability-settings-frames.jsx DisclosureRow (lines 52-60). */
function DisclosureRow({
  icon,
  label,
  value,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 border-t border-app-border px-3.5 py-3 ${
        disabled ? "opacity-50" : "cursor-pointer"
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-secondary">
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-[12.5px] font-semibold text-app-text">
        {label}
      </div>
      {value && (
        <span className="text-[11.5px] font-medium text-app-text-secondary">
          {value}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-app-text-muted" />
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-[68px] rounded-2xl bg-app-surface-sunken" />
      <div className="h-[60px] rounded-2xl bg-app-surface-sunken" />
      <div className="h-[200px] rounded-2xl bg-app-surface-sunken" />
    </div>
  );
}
