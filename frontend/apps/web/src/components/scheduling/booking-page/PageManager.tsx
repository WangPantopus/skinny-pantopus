"use client";

// C1 — Booking link / public page management, with the H16 empty/zero-state.
// Wires GET/PUT /booking-page, PUT /booking-page/slug (+ check-slug debounce),
// POST /booking-page/reset-slug, and the live/paused/draft status actions. The
// Services card lists the owner's event types and toggles their public
// visibility. Copy / Share / QR open the local C3 ShareSheet. Owner context +
// pillar theming come from the W0 SchedulingOwner; functional chrome stays sky,
// pillar accent only on overlines/dots.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CalendarPlus,
  Camera,
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  CreditCard,
  Link2,
  ListChecks,
  MapPin,
  Phone,
  QrCode,
  RotateCcw,
  Share2,
  TriangleAlert,
  Video,
} from "lucide-react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { scheduling } from "@pantopus/api";
import type { BookingPage, EventType } from "@pantopus/types";
import {
  APP_WEB_URL,
  buildBookingPageUrl,
  copyToClipboard,
} from "@pantopus/utils";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import {
  pillarForOwner,
  pillarTokens,
} from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import ErrorState from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/toast-store";
import {
  Card,
  Field,
  Segmented,
  StatusChip,
  TextArea,
  TextInput,
  Toggle,
  ToggleRow,
  WarningNote,
  initialsOf,
  type StatusTone,
} from "./controls";
import ConfirmDialog from "./ConfirmDialog";
import ShareSheet from "./ShareSheet";
import { SLUG_RE, normalizeSlugInput } from "./logic";

const WEB_HOST = APP_WEB_URL.replace(/^https?:\/\//, "");

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

function locationIcon(mode: EventType["location_mode"]): LucideIcon {
  if (mode === "video") return Video;
  if (mode === "phone") return Phone;
  if (mode === "in_person") return MapPin;
  return CalendarClock;
}

function statusToneOf(page: BookingPage): StatusTone {
  if (!page.is_live) return "draft";
  return page.is_paused ? "paused" : "live";
}

export default function PageManager() {
  const owner = useSchedulingOwner();
  const pillar = pillarForOwner(owner.ownerType);
  const tk = pillarTokens(pillar);

  const [page, setPage] = useState<BookingPage | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Editable form state
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [intro, setIntro] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visibility, setVisibility] = useState<"listed" | "unlisted">("listed");
  const [photoOpen, setPhotoOpen] = useState(false);

  // Slug state
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);

  // Action state
  const [saving, setSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [setupRevealed, setSetupRevealed] = useState(false);

  const hydrate = useCallback((p: BookingPage) => {
    setPage(p);
    setTitle(p.title ?? "");
    setTagline(p.tagline ?? "");
    setAvatarUrl(p.avatar_url ?? "");
    setIntro(p.intro ?? "");
    setConfirmation(p.confirmation_message ?? "");
    setVisibility(p.visibility ?? "listed");
    setSlug(p.slug ?? "");
    setSlugStatus("idle");
    setSlugSuggestions([]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      scheduling.getBookingPage(owner),
      scheduling.listEventTypes(owner).catch(() => ({ eventTypes: [] })),
    ])
      .then(([pageRes, etRes]) => {
        if (cancelled) return;
        hydrate(pageRes.page);
        setEventTypes(etRes.eventTypes ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(decodeError(err).message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner.ownerType, owner.ownerId, owner.homeId, reloadKey]);

  // Debounced slug availability check.
  const slugDirty = !!page && slug !== page.slug;
  const checkSeq = useRef(0);
  useEffect(() => {
    if (!page || !slugDirty) {
      setSlugStatus("idle");
      setSlugSuggestions([]);
      return;
    }
    if (!SLUG_RE.test(slug)) {
      setSlugStatus("invalid");
      setSlugSuggestions([]);
      return;
    }
    setSlugStatus("checking");
    const seq = ++checkSeq.current;
    const t = setTimeout(() => {
      scheduling
        .checkSlug(slug, owner)
        .then((res) => {
          if (seq !== checkSeq.current) return;
          if (res.available) {
            setSlugStatus("available");
            setSlugSuggestions([]);
          } else {
            setSlugStatus("taken");
            setSlugSuggestions(res.suggestions ?? []);
          }
        })
        .catch((err) => {
          if (seq !== checkSeq.current) return;
          const d = decodeError(err);
          setSlugStatus("invalid");
          setSlugSuggestions(d.kind === "error" ? [] : []);
        });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, slugDirty, page]);

  const slugBlocked =
    slugDirty && (slugStatus === "taken" || slugStatus === "invalid");

  const dirty = useMemo(() => {
    if (!page) return false;
    return (
      title !== (page.title ?? "") ||
      tagline !== (page.tagline ?? "") ||
      avatarUrl !== (page.avatar_url ?? "") ||
      intro !== (page.intro ?? "") ||
      confirmation !== (page.confirmation_message ?? "") ||
      visibility !== (page.visibility ?? "listed")
    );
  }, [page, title, tagline, avatarUrl, intro, confirmation, visibility]);

  const shareUrl = page ? buildBookingPageUrl(page.slug) : "";
  const isFresh = !!page && !page.is_live && !page.title;
  const showForm = !isFresh || setupRevealed;

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const handleSave = async () => {
    if (!page || saving || slugStatus === "checking" || slugBlocked) return;
    setSaving(true);
    try {
      let next = page;
      if (slugDirty && slugStatus === "available") {
        const res = await scheduling.updateBookingPageSlug(slug, owner);
        next = res.page;
      }
      const res = await scheduling.updateBookingPage(
        {
          title,
          tagline: tagline || null,
          avatar_url: avatarUrl || null,
          intro: intro || null,
          confirmation_message: confirmation || null,
          visibility,
        },
        owner,
      );
      next = res.page;
      hydrate(next);
      flashSaved();
      toast.success("Saved");
    } catch (err) {
      const d = decodeError(err);
      if (
        d.kind === "conflict" ||
        (d.kind === "error" && d.code === "SLUG_TAKEN")
      ) {
        setSlugStatus("taken");
        toast.error("That handle is taken. Try another.");
      } else {
        toast.error(d.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const patchStatus = async (patch: {
    is_live?: boolean;
    is_paused?: boolean;
  }) => {
    if (!page || statusBusy) return;
    setStatusBusy(true);
    try {
      const res = await scheduling.updateBookingPage(patch, owner);
      setPage(res.page);
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setStatusBusy(false);
    }
  };

  const handleReset = async () => {
    if (!page) return;
    setResetting(true);
    try {
      const res = await scheduling.resetSlug(owner);
      hydrate(res.page);
      setConfirmReset(false);
      toast.success("New link generated");
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setResetting(false);
    }
  };

  const toggleService = async (et: EventType, next: boolean) => {
    const prev = eventTypes;
    setEventTypes((list) =>
      list.map((x) =>
        x.id === et.id ? { ...x, visibility: next ? "public" : "secret" } : x,
      ),
    );
    try {
      await scheduling.updateEventType(
        et.id,
        { visibility: next ? "public" : "secret" },
        owner,
      );
    } catch (err) {
      setEventTypes(prev);
      toast.error(decodeError(err).message);
    }
  };

  const toggleListed = async (next: boolean) => {
    const v = next ? "listed" : "unlisted";
    setVisibility(v);
    try {
      const res = await scheduling.updateBookingPage({ visibility: v }, owner);
      setPage(res.page);
    } catch (err) {
      toast.error(decodeError(err).message);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    const ok = await copyToClipboard(shareUrl);
    toast[ok ? "success" : "error"](ok ? "Link copied" : "Could not copy");
  };

  // ── Loading / error ──────────────────────────────────────────
  if (loading) return <PageSkeleton />;
  if (loadError)
    return (
      <ErrorState
        message={loadError}
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    );
  if (!page) return null;

  const tone = statusToneOf(page);
  const visibleServices = eventTypes.filter((e) => e.visibility === "public");
  const noServices = eventTypes.length === 0 || visibleServices.length === 0;
  const saveLabel = slugBlocked
    ? "Fix your link to save"
    : page.is_live
      ? "Save changes"
      : "Save draft";
  const saveDisabled =
    saving ||
    slugStatus === "checking" ||
    slugBlocked ||
    (!dirty && !slugDirty);

  return (
    <div className="space-y-4 pb-28">
      {/* H16 — zero state */}
      {isFresh && !setupRevealed && (
        <div className="rounded-2xl border border-dashed border-app-border-strong bg-app-surface px-6 py-12 text-center">
          <div
            className={clsx(
              "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl",
              tk.bgSoft,
            )}
          >
            <Link2 className={clsx("h-7 w-7", tk.text)} aria-hidden />
          </div>
          <h2 className="text-lg font-bold text-app-text-strong">
            Create your booking link
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-app-text-secondary">
            Claim a short link, add your details, and turn on what people can
            book. You can share it anywhere.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setSetupRevealed(true)}
              className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Set up booking link
            </button>
            <Link
              href="/app/scheduling/setup"
              className="rounded-lg border border-app-border px-5 py-2.5 text-sm font-semibold text-app-text hover:bg-app-hover"
            >
              Guided setup
            </Link>
          </div>
        </div>
      )}

      {showForm && (
        <>
          {/* Status */}
          <Card overline="Status" pillar={pillar}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <StatusChip tone={tone} />
                <p className="mt-2 text-xs leading-snug text-app-text-secondary">
                  {tone === "live"
                    ? "Anyone with this link can book you."
                    : tone === "paused"
                      ? "Page is paused. People see a short note and cannot book."
                      : "Not published yet. Finish setup, then publish to go live."}
                </p>
              </div>
              {page.is_live ? (
                <Toggle
                  on={!page.is_paused}
                  disabled={statusBusy}
                  label="Accepting bookings"
                  onChange={(next) => patchStatus({ is_paused: !next })}
                />
              ) : (
                <button
                  type="button"
                  disabled={statusBusy}
                  onClick={() =>
                    patchStatus({ is_live: true, is_paused: false })
                  }
                  className="shrink-0 rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  Publish
                </button>
              )}
            </div>
          </Card>

          {/* Slug */}
          <Card overline="Your link" pillar={pillar}>
            <div
              className={clsx(
                "flex items-stretch overflow-hidden rounded-lg border bg-app-surface",
                slugStatus === "taken" || slugStatus === "invalid"
                  ? "border-app-error ring-2 ring-app-error/15"
                  : "border-app-border",
              )}
            >
              <span className="flex items-center whitespace-nowrap py-2.5 pl-3 font-mono text-[13px] text-app-text-muted">
                {WEB_HOST}/book/
              </span>
              <input
                aria-label="Booking link handle"
                value={slug}
                onChange={(e) => setSlug(normalizeSlugInput(e.target.value))}
                className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 font-mono text-[13px] font-semibold text-app-text-strong focus:outline-none"
              />
            </div>

            {slugStatus === "checking" && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-app-text-secondary">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-app-border-strong border-t-app-text-secondary" />
                Checking availability…
              </p>
            )}
            {slugStatus === "available" && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-app-success">
                <CircleCheck className="h-3.5 w-3.5" aria-hidden />
                {slugDirty ? "Available" : "This is your current link"}
              </p>
            )}
            {slugStatus === "invalid" && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-app-error">
                <CircleAlert className="h-3.5 w-3.5" aria-hidden />
                Use 3–50 letters, numbers, or hyphens.
              </p>
            )}
            {slugStatus === "taken" && (
              <>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-app-error">
                  <CircleAlert className="h-3.5 w-3.5" aria-hidden />
                  That handle is taken. Try another.
                </p>
                {slugSuggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {slugSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSlug(s)}
                        className="rounded-full border border-app-border bg-app-surface px-3 py-1.5 font-mono text-xs font-semibold text-app-text hover:bg-app-hover"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-app-text-muted hover:text-app-error"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reset link
            </button>
          </Card>

          {/* Page header */}
          <Card overline="Page header" pillar={pillar}>
            <div className="flex items-center gap-3">
              <Avatar pillar={pillar} url={avatarUrl} name={title} />
              <button
                type="button"
                onClick={() => setPhotoOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700"
              >
                <Camera className="h-4 w-4" aria-hidden />
                {photoOpen ? "Hide" : "Change photo"}
              </button>
            </div>
            {photoOpen && (
              <Field label="Photo URL" hint="Paste a link to an image.">
                <TextInput
                  value={avatarUrl}
                  onChange={setAvatarUrl}
                  placeholder="https://…"
                />
              </Field>
            )}
            <Field label="Display name">
              <TextInput
                value={title}
                onChange={setTitle}
                placeholder="Your name"
              />
            </Field>
            <Field label="Tagline">
              <TextInput
                value={tagline}
                onChange={setTagline}
                placeholder="One short line"
              />
            </Field>
          </Card>

          {/* Services */}
          <Card overline="Services people can book" pillar={pillar}>
            {noServices && (
              <WarningNote>
                <TriangleAlert
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  aria-hidden
                />
                {eventTypes.length === 0
                  ? "Add a service so people can book a time with you."
                  : "Turn on at least one service so people can book."}
              </WarningNote>
            )}
            {eventTypes.length === 0 ? (
              <Link
                href="/app/scheduling/event-types"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700"
              >
                <CalendarPlus className="h-4 w-4" aria-hidden />
                Add a service
              </Link>
            ) : (
              <div className={clsx(noServices && "mt-2")}>
                {eventTypes.map((et, i) => (
                  <ToggleRow
                    key={et.id}
                    icon={locationIcon(et.location_mode)}
                    label={et.name}
                    sub={`${et.default_duration} min`}
                    on={et.visibility === "public"}
                    onChange={(next) => toggleService(et, next)}
                    last={i === eventTypes.length - 1}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* Intro & confirmation */}
          <Card overline="Intro & confirmation" pillar={pillar}>
            <Field label="Intro message" hint="Shown at the top of your page.">
              <TextArea
                value={intro}
                onChange={setIntro}
                placeholder="Pick a time that works and I'll send a calendar invite."
              />
            </Field>
            <Field
              label="Confirmation message"
              hint="Shown after someone books."
            >
              <TextArea
                value={confirmation}
                onChange={setConfirmation}
                placeholder="Thanks for booking. You'll get a reminder a day before."
              />
            </Field>
          </Card>

          {/* Visibility */}
          <Card overline="Visibility" pillar={pillar}>
            <Segmented
              options={[
                { label: "Listed", value: "listed" },
                { label: "Link-only", value: "unlisted" },
              ]}
              value={visibility}
              onChange={(v) => setVisibility(v as "listed" | "unlisted")}
            />
            <p className="mt-2 text-xs leading-snug text-app-text-secondary">
              {visibility === "listed"
                ? "Shown on your Pantopus profile and in search."
                : "Only people with the link can find your page."}
            </p>
          </Card>

          {/* Links */}
          <Card pillar={pillar}>
            <LinkRowOut
              icon={ListChecks}
              label="Intake questions"
              value="Per service"
              href="/app/scheduling/event-types"
            />
            <LinkRowOut
              icon={CreditCard}
              label="Connect Stripe to take paid bookings"
              href="/app/scheduling/payments"
              last
            />
          </Card>

          {/* Footer actions */}
          <div className="flex gap-2">
            <FooterButton icon={Copy} label="Copy link" onClick={copyLink} />
            <FooterButton
              icon={Share2}
              label="Share"
              onClick={() => setShareOpen(true)}
            />
            <FooterButton
              icon={QrCode}
              label="View QR"
              onClick={() => setShareOpen(true)}
            />
          </div>
        </>
      )}

      {/* Sticky save bar */}
      {showForm && (
        <div className="sticky bottom-0 -mx-4 mt-4 border-t border-app-border bg-app-surface/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveDisabled}
            className={clsx(
              "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors",
              saveDisabled
                ? "cursor-not-allowed bg-app-surface-sunken text-app-text-muted"
                : "bg-primary-600 text-white hover:bg-primary-700",
            )}
          >
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Saving
              </>
            ) : (
              saveLabel
            )}
          </button>
        </div>
      )}

      {/* Saved toast (in-page confirmation alongside the global toast) */}
      {saved && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-app-text-strong px-4 py-2 text-sm font-semibold text-app-text-inverse shadow-lg">
          <Check className="h-4 w-4 text-app-success" aria-hidden />
          Saved
        </div>
      )}

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={shareUrl}
        pillar={pillar}
        draft={!page.is_live}
        onTurnOn={() => {
          patchStatus({ is_live: true, is_paused: false });
          setShareOpen(false);
        }}
        listed={visibility === "listed"}
        onToggleListed={toggleListed}
        onRegenerate={handleReset}
      />

      <ConfirmDialog
        open={confirmReset}
        icon={RotateCcw}
        title="Reset this link?"
        body="A new link is generated and the old one stops working. Anyone using it will need the new one."
        confirmLabel="Reset link"
        busy={resetting}
        onConfirm={handleReset}
        onCancel={() => {
          if (!resetting) setConfirmReset(false);
        }}
      />
    </div>
  );
}

// ── Small pieces ────────────────────────────────────────────────

function Avatar({
  pillar,
  url,
  name,
}: {
  pillar: "personal" | "home" | "business";
  url?: string;
  name?: string;
}) {
  const grad =
    pillar === "business"
      ? "linear-gradient(135deg,#a78bfa,#7c3aed)"
      : pillar === "home"
        ? "linear-gradient(135deg,#4ade80,#16a34a)"
        : "linear-gradient(135deg,#38bdf8,#0284c7)";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow"
      style={{ background: grad }}
    >
      {initialsOf(name)}
    </div>
  );
}

function FooterButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-app-border bg-app-surface px-3 py-2.5 text-xs font-semibold text-app-text hover:bg-app-hover"
    >
      <Icon className="h-4 w-4 text-primary-600" aria-hidden />
      {label}
    </button>
  );
}

function LinkRowOut({
  icon: Icon,
  label,
  value,
  href,
  last,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  href: string;
  last?: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-3 py-3",
        !last && "border-b border-app-border",
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-secondary">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold text-app-text-strong">
        {label}
      </span>
      {value && (
        <span className="text-xs text-app-text-secondary">{value}</span>
      )}
    </Link>
  );
}

function PageSkeleton() {
  return (
    <div
      className="space-y-4"
      aria-busy="true"
      aria-label="Loading booking page"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-app-border bg-app-surface p-4"
        >
          <div className="h-3 w-24 animate-pulse rounded bg-app-surface-muted" />
          <div className="mt-3 h-10 w-full animate-pulse rounded-lg bg-app-surface-muted" />
        </div>
      ))}
    </div>
  );
}
