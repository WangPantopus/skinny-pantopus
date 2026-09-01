"use client";

// W15 · G8 — Packages List (owner). A business sells N-session bundles. Segmented
// Active / Archived filter (is_active), package rows with per-session math, a
// status pill, and a row actions menu (Edit / Duplicate / Archive — Restore when
// archived). Inline empty + a Stripe payouts gate (you must be able to take
// payouts before you can sell). All behind schedulingPaid; calls carry the
// SchedulingOwner context. Soft-delete = DELETE (sets is_active=false).
//
// Backend note: GET /packages exposes no per-package "sold" count, so the
// design's sold tally is omitted rather than faked.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  ArchiveRestore,
  Copy,
  EllipsisVertical,
  Layers,
  Pencil,
  Plus,
} from "lucide-react";
import * as api from "@pantopus/api";
import type {
  Package,
  PaymentsStatus,
  SchedulingOwnerRef,
} from "@pantopus/types";
import { toast } from "@/components/ui/toast-store";
import { confirmStore } from "@/components/ui/confirm-store";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import { pillarForOwner } from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import { packageSubLine } from "@/components/scheduling/packages/money";
import {
  formToInput,
  packageToForm,
} from "@/components/scheduling/packages/packageForm";
import {
  EmptyHero,
  PillarPill,
  SectionOverline,
  StripeGate,
} from "@/components/scheduling/packages/ui";
import PaidFeatureGate from "@/components/scheduling/packages/PaidFeatureGate";

const BASE = "/app/scheduling/packages";

export default function PackageList({ owner }: { owner: SchedulingOwnerRef }) {
  const router = useRouter();
  const pillar = pillarForOwner(owner.ownerType);

  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [packages, setPackages] = useState<Package[]>([]);
  const [payments, setPayments] = useState<PaymentsStatus | null>(null);
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    let alive = true;
    setPhase("loading");
    api.scheduling
      .listPackages(owner)
      .then((res) => {
        if (!alive) return;
        setPackages(res.packages ?? []);
        setPhase("ready");
      })
      .catch(() => {
        if (alive) setPhase("error");
      });
    // Best-effort: drives the "connect payouts before selling" gate.
    api.scheduling
      .getPaymentsStatus(owner)
      .then((res) => {
        if (alive) setPayments(res);
      })
      .catch(() => {
        /* gate hidden if status is unknown */
      });
    return () => {
      alive = false;
    };
  }, [owner]);

  useEffect(() => load(), [load]);

  const active = packages.filter((p) => p.is_active);
  const archived = packages.filter((p) => !p.is_active);
  const shown = filter === "active" ? active : archived;
  const needsPayouts = Boolean(
    payments?.applicable && !payments.payouts_enabled,
  );

  // ── Row actions ───────────────────────────────────────────────
  const duplicate = async (pkg: Package) => {
    setBusyId(pkg.id);
    try {
      const input = formToInput({
        ...packageToForm(pkg),
        name: `${pkg.name} (copy)`,
      });
      await api.scheduling.createPackage(input, owner);
      toast.success("Package duplicated.");
      load();
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const archive = async (pkg: Package) => {
    const ok = await confirmStore.open({
      title: `Archive "${pkg.name}"?`,
      description:
        "Buyers can no longer purchase it. People who already own credits keep them and can still book.",
      confirmLabel: "Archive",
      cancelLabel: "Keep selling",
    });
    if (!ok) return;
    setBusyId(pkg.id);
    setPackages((list) =>
      list.map((x) => (x.id === pkg.id ? { ...x, is_active: false } : x)),
    );
    try {
      await api.scheduling.deletePackage(pkg.id, owner);
      toast.success("Package archived.");
    } catch (err) {
      setPackages((list) =>
        list.map((x) => (x.id === pkg.id ? { ...x, is_active: true } : x)),
      );
      toast.error(decodeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const restore = async (pkg: Package) => {
    setBusyId(pkg.id);
    setPackages((list) =>
      list.map((x) => (x.id === pkg.id ? { ...x, is_active: true } : x)),
    );
    try {
      await api.scheduling.updatePackage(pkg.id, { is_active: true }, owner);
      toast.success("Package restored.");
    } catch (err) {
      setPackages((list) =>
        list.map((x) => (x.id === pkg.id ? { ...x, is_active: false } : x)),
      );
      toast.error(decodeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <PaidFeatureGate feature="Packages">
      <div>
        <header className="mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2">
                <PillarPill pillar={pillar} />
              </div>
              <h1 className="text-xl font-bold text-app-text">Packages</h1>
              <p className="mt-0.5 text-sm text-app-text-secondary">
                Sell a bundle of sessions at a better rate. Buyers keep their
                price if you change it later.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`${BASE}/new/edit`)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden />
              New
            </button>
          </div>

          {phase === "ready" && (
            <div className="mt-4 flex gap-1 rounded-[10px] bg-app-surface-sunken p-1">
              {(["active", "archived"] as const).map((f) => {
                const on = filter === f;
                const count = f === "active" ? active.length : archived.length;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={clsx(
                      "h-8 flex-1 rounded-md text-xs capitalize transition",
                      on
                        ? "bg-app-surface font-bold text-primary-700 shadow-sm"
                        : "font-semibold text-app-text-secondary hover:text-app-text",
                    )}
                  >
                    {f}
                    {count > 0 && ` (${count})`}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        {phase === "loading" && (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <ShimmerBlock key={i} className="h-[68px] rounded-[14px]" />
            ))}
          </div>
        )}

        {phase === "error" && (
          <ErrorState
            message="We couldn't load your packages."
            onRetry={load}
          />
        )}

        {phase === "ready" && packages.length === 0 && (
          <EmptyHero
            icon={Layers}
            pillar={pillar}
            title="Sell a package of sessions"
            body="Bundle sessions so regulars can prepay and rebook fast."
            action={
              needsPayouts ? (
                <div className="w-60">
                  <StripeGate
                    compact
                    title="Set up payouts to sell packages."
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push(`${BASE}/new/edit`)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                  Create a package
                </button>
              )
            }
          />
        )}

        {phase === "ready" && packages.length > 0 && (
          <div className="flex flex-col gap-3">
            {shown.length === 0 ? (
              <p className="px-1 py-10 text-center text-sm text-app-text-secondary">
                {filter === "archived"
                  ? "Nothing archived. Archived packages show up here."
                  : "No active packages. Switch to Archived or create a new one."}
              </p>
            ) : (
              <>
                <SectionOverline pillar={pillar}>
                  {filter === "active" ? "On sale" : "Archived"}
                </SectionOverline>
                <div className="overflow-hidden rounded-[14px] border border-app-border bg-app-surface shadow-sm">
                  {shown.map((pkg, i) => (
                    <PackageRow
                      key={pkg.id}
                      pkg={pkg}
                      busy={busyId === pkg.id}
                      last={i === shown.length - 1}
                      onEdit={() => router.push(`${BASE}/${pkg.id}/edit`)}
                      onDuplicate={() => duplicate(pkg)}
                      onArchive={() => archive(pkg)}
                      onRestore={() => restore(pkg)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </PaidFeatureGate>
  );
}

function PackageRow({
  pkg,
  busy,
  last,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
}: {
  pkg: Package;
  busy: boolean;
  last?: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const archived = !pkg.is_active;
  const close = () => setMenuOpen(false);
  const run = (fn: () => void) => {
    close();
    fn();
  };

  const menuItems = [
    { icon: Pencil, label: "Edit", onClick: onEdit },
    { icon: Copy, label: "Duplicate", onClick: onDuplicate },
    {
      icon: ArchiveRestore,
      label: "Archive",
      onClick: onArchive,
      danger: true,
    },
  ];

  return (
    <div
      className={clsx(
        "relative flex items-center gap-3 p-3 transition",
        !last && "border-b border-app-border",
        busy && "opacity-60",
        archived && "opacity-75",
      )}
    >
      <span
        className={clsx(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          archived
            ? "bg-app-surface-sunken text-app-text-muted"
            : "bg-app-business-bg text-app-business",
        )}
        aria-hidden
      >
        <Layers className="h-5 w-5" strokeWidth={2} />
      </span>

      <button
        type="button"
        onClick={archived ? undefined : onEdit}
        disabled={archived}
        className="min-w-0 flex-1 text-left disabled:cursor-default"
      >
        <span className="block truncate text-[13.5px] font-bold text-app-text">
          {pkg.name}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-app-text-secondary">
          {packageSubLine(pkg)}
        </span>
        <span className="mt-1.5 inline-flex">
          <span
            className={clsx(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              archived
                ? "bg-app-surface-muted text-app-text-muted"
                : "bg-app-success-bg text-app-success",
            )}
          >
            {archived ? "Archived" : "Active"}
          </span>
        </span>
      </button>

      {archived ? (
        <button
          type="button"
          onClick={onRestore}
          disabled={busy}
          className="shrink-0 rounded-full border border-app-border bg-app-surface px-3 py-1.5 text-[11px] font-bold text-app-text-secondary transition hover:bg-app-hover disabled:opacity-50"
        >
          Restore
        </button>
      ) : (
        <div className="relative">
          <button
            type="button"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            disabled={busy}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-app-text-muted hover:bg-app-hover disabled:opacity-50"
          >
            <EllipsisVertical className="h-4 w-4" aria-hidden />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={close} aria-hidden />
              <div
                role="menu"
                className="absolute right-0 top-9 z-30 w-44 overflow-hidden rounded-xl border border-app-border bg-app-surface p-1 shadow-lg"
              >
                {menuItems.map((it) => {
                  const Icon = it.icon;
                  return (
                    <button
                      key={it.label}
                      type="button"
                      role="menuitem"
                      onClick={() => run(it.onClick)}
                      className={clsx(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium transition",
                        it.danger
                          ? "mt-1 border-t border-app-border text-app-error hover:bg-app-error-bg"
                          : "text-app-text hover:bg-app-hover",
                      )}
                    >
                      <Icon
                        className={clsx(
                          "h-4 w-4 shrink-0",
                          it.danger
                            ? "text-app-error"
                            : "text-app-text-secondary",
                        )}
                        aria-hidden
                      />
                      {it.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
