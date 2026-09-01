"use client";

// A6 — Home & Business scheduling onboarding. One route, two pillar variants:
//   Home (green):    Members → Combine → Share
//   Business (violet): Link → Service → Team → Confirm → Share
// Reuses the A2 slug field + step rail, recolored per pillar. Persists a first
// event type (assignment mode / approval) + assignees, then takes the page live.

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import {
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  Home as HomeIcon,
  House,
  MessageSquare,
  Plus,
  Share2,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as api from "@pantopus/api";
import { buildBookingPageUrl } from "@pantopus/utils";
import type {
  AssignmentMode,
  EventTypeAssignee,
  EventTypeLocationMode,
  SchedulingOwnerRef,
} from "@pantopus/types";
import { PillarThemeProvider } from "@/components/scheduling/PillarThemeProvider";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import ShareLink from "@/components/scheduling/ShareLink";
import ErrorState from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/toast-store";
import { webFeatureFlags } from "@/lib/featureFlags";
import { useHubOwners } from "./owners";
import StepRail from "./StepRail";
import SlugClaimField, {
  sanitizeSlug,
  type SlugStatus,
} from "./SlugClaimField";
import { Segmented, Toggle } from "./ui";
import { initials } from "./format";

interface MemberView {
  userId: string;
  name: string;
  sub: string;
}

function readMembers(raw: unknown[]): MemberView[] {
  return raw
    .map((m) => {
      const o = (m ?? {}) as Record<string, unknown>;
      const user = (o.user ?? {}) as Record<string, unknown>;
      const userId = String(o.user_id ?? o.userId ?? user.id ?? o.id ?? "");
      const name = String(
        o.name ?? o.display_name ?? o.full_name ?? user.name ?? "Member",
      );
      const sub = String(
        o.role ?? o.relationship ?? o.title ?? o.role_base ?? "Member",
      );
      return { userId, name, sub };
    })
    .filter((m) => m.userId);
}

// ── Shared wizard chrome ──────────────────────────────────────────

function Headline({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-[22px] font-bold tracking-tight text-app-text">
        {title}
      </h2>
      <p className="mt-1.5 text-[13.5px] leading-5 text-app-text-secondary">
        {sub}
      </p>
    </div>
  );
}

function PillarChip({
  pillar,
  icon: Icon,
  label,
}: {
  pillar: Pillar;
  icon: LucideIcon;
  label: string;
}) {
  const tk = pillarTokens(pillar);
  return (
    <span
      className={clsx(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide",
        tk.bgSoft,
        tk.text,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.4} aria-hidden />
      {label}
    </span>
  );
}

function Primary({
  children,
  pillar,
  onClick,
  disabled,
  grow,
  icon: Icon = ArrowRight,
}: {
  children: React.ReactNode;
  pillar: Pillar;
  onClick?: () => void;
  disabled?: boolean;
  grow?: boolean;
  icon?: LucideIcon;
}) {
  const tk = pillarTokens(pillar);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold shadow-sm transition-colors",
        grow ? "flex-[1.5]" : "flex-1",
        disabled
          ? "cursor-not-allowed bg-app-surface-sunken text-app-text-muted shadow-none"
          : clsx(tk.bg, tk.textOn, "hover:opacity-90"),
      )}
    >
      {children}
      {Icon && <Icon className="h-4 w-4" aria-hidden />}
    </button>
  );
}

function Ghost({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface px-4 text-sm font-semibold text-app-text-strong hover:bg-app-hover"
    >
      {children}
    </button>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2.5 pt-1">{children}</div>;
}

/**
 * A12-biz ApproveExplainer card — design BizConfirm: violet-accent 30×30 rounded
 * square + UserCheck icon, full body including "24 hours" text.
 */
function ApproveExplainer({ pillar }: { pillar: Pillar }) {
  const tk = pillarTokens(pillar);
  return (
    <div
      className={clsx(
        "flex items-start gap-3 rounded-xl border p-4",
        tk.border,
        tk.bgSoft,
      )}
    >
      <div
        className={clsx(
          "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg",
          tk.bg,
          tk.textOn,
        )}
      >
        <UserCheck className="h-4 w-4" aria-hidden />
      </div>
      <p className="text-[12px] leading-4 text-app-text-strong">
        Requests land in your queue. The slot is held for 24 hours and the
        client is notified once you confirm.
      </p>
    </div>
  );
}

function ComposedNote({ pillar, body }: { pillar: Pillar; body: string }) {
  const tk = pillarTokens(pillar);
  return (
    <div
      className={clsx(
        "flex items-start gap-2.5 rounded-xl border p-3.5",
        tk.border,
        tk.bgSoft,
      )}
    >
      <div
        className={clsx(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          tk.bg,
          tk.textOn,
        )}
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden />
      </div>
      <p className="text-[12px] leading-4 text-app-text-strong">{body}</p>
    </div>
  );
}

/**
 * A12-biz TeamList — design BizTeam: overline "Team seats" + seat counter,
 * gradient avatars, RoleChip, "Seated · bookable" / "Not seated" sub-labels.
 * Used in place of generic MemberPicker for the Business onboarding team step.
 */
function BizTeamList({
  members,
  selected,
  onToggle,
  pillar,
  inviteHref,
}: {
  members: MemberView[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  pillar: Pillar;
  inviteHref: string;
}) {
  const tk = pillarTokens(pillar);
  const seatedCount = members.filter((m) => selected.has(m.userId)).length;
  const totalCount = members.length;

  // Role label normalization
  const roleLabel = (raw: string): string => {
    const r = raw.toLowerCase();
    if (r.includes("owner")) return "Owner";
    if (r.includes("front")) return "Front desk";
    if (r.includes("stylist")) return "Stylist";
    if (r.includes("admin")) return "Admin";
    return raw || "Member";
  };

  // Gradient avatar colors per index (cycles through a set of nice gradients)
  const GRADS = [
    "linear-gradient(135deg, #a78bfa, #7c3aed)",
    "linear-gradient(135deg, #f472b6, #db2777)",
    "linear-gradient(135deg, #38bdf8, #0284c7)",
    "linear-gradient(135deg, #fbbf24, #d97706)",
    "linear-gradient(135deg, #34d399, #059669)",
    "linear-gradient(135deg, #fb923c, #ea580c)",
  ];

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-app-text-secondary">
          Team seats
        </p>
        <span
          className={clsx(
            "font-mono text-[11px] font-bold tabular-nums",
            tk.text,
          )}
        >
          {seatedCount} of {totalCount} seats used
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-sm">
        {members.map((m, i) => {
          const isSeated = selected.has(m.userId);
          const role = roleLabel(m.sub);
          const isOwner = role === "Owner";
          return (
            <div
              key={m.userId}
              className="flex items-center gap-3 border-b border-app-border px-3.5 py-[11px] last:border-b-0"
            >
              {/* Gradient avatar */}
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: GRADS[i % GRADS.length] }}
              >
                {initials(m.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[14px] font-semibold leading-5 text-app-text">
                    {m.name}
                  </p>
                  {/* RoleChip */}
                  <span
                    className={clsx(
                      "shrink-0 rounded-full px-[7px] py-[2px] text-[9.5px] font-bold uppercase tracking-[0.04em]",
                      isOwner
                        ? clsx(tk.bgSoft, tk.text)
                        : "bg-app-surface-sunken text-app-text-strong",
                    )}
                  >
                    {role}
                  </span>
                </div>
                <p className="mt-0.5 text-[11.5px] text-app-text-secondary">
                  {isSeated ? "Seated · bookable" : "Not seated"}
                </p>
              </div>
              <Toggle
                on={isSeated}
                pillar={pillar}
                onChange={() => onToggle(m.userId)}
                label={m.name}
              />
            </div>
          );
        })}
        <a
          href={inviteHref}
          className="flex items-center gap-3 border-t border-app-border px-3.5 py-[11px] hover:bg-app-hover"
        >
          <span
            className={clsx(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed",
              tk.border,
              tk.bgSoft,
              tk.text,
            )}
          >
            <UserPlus className="h-[17px] w-[17px]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className={clsx("text-[14px] font-bold", tk.text)}>
              Invite teammate
            </p>
          </div>
        </a>
      </div>
    </div>
  );
}

function MemberPicker({
  members,
  selected,
  onToggle,
  pillar,
  inviteHref,
}: {
  members: MemberView[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  pillar: Pillar;
  inviteHref: string;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div className="overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-sm">
      {members.map((m) => (
        <div
          key={m.userId}
          className="flex items-center gap-3 border-b border-app-border px-3.5 py-3 last:border-b-0"
        >
          <span
            className={clsx(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
              tk.bgSoft,
              tk.text,
            )}
          >
            {initials(m.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-app-text">
              {m.name}
            </p>
            <p className="truncate text-[11.5px] text-app-text-secondary">
              {m.sub}
            </p>
          </div>
          <Toggle
            on={selected.has(m.userId)}
            pillar={pillar}
            onChange={() => onToggle(m.userId)}
            label={m.name}
          />
        </div>
      ))}
      <a
        href={inviteHref}
        className="flex items-center gap-3 px-3.5 py-3 hover:bg-app-hover"
      >
        <span
          className={clsx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed",
            tk.border,
            tk.bgSoft,
            tk.text,
          )}
        >
          <UserPlus className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className={clsx("text-sm font-bold", tk.text)}>Invite someone</p>
          <p className="text-[11.5px] text-app-text-secondary">
            Add a member by phone or email
          </p>
        </div>
      </a>
    </div>
  );
}

// ── Variant: Home ─────────────────────────────────────────────────

const HOME_STEPS = [
  { n: 1, label: "Members" },
  { n: 2, label: "Combine" },
  { n: 3, label: "Share" },
];

function HomeOnboarding({
  owner,
  homeId,
}: {
  owner: SchedulingOwnerRef;
  homeId: string;
}) {
  const router = useRouter();
  const pillar: Pillar = "home";
  const [step, setStep] = useState(1);
  const [members, setMembers] = useState<MemberView[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<AssignmentMode>("collective");
  const [slug, setSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ page }, mem] = await Promise.all([
          api.scheduling.getBookingPage(owner),
          api.homeIam
            .getHomeMembers(homeId)
            .catch(() => ({ members: [] as unknown[] })),
        ]);
        if (cancelled) return;
        setSlug(page.slug);
        const list = readMembers(mem.members ?? []);
        setMembers(list);
        setSelected(new Set(list.map((m) => m.userId)));
      } catch (err) {
        if (!cancelled)
          toast.error(decodeError(err).message || "Couldn’t load household");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [owner, homeId]);

  const finish = async () => {
    setSubmitting(true);
    try {
      await api.scheduling.updateBookingPage(
        { is_live: true, is_paused: false },
        owner,
      );
      const { eventType } = await api.scheduling.createEventType(
        {
          name: "Household booking",
          slug: sanitizeSlug(`household-${mode}`),
          durations: [30],
          default_duration: 30,
          location_mode: "video",
          assignment_mode: mode,
          visibility: "public",
        },
        owner,
      );
      const assignees: EventTypeAssignee[] = [...selected].map((id) => ({
        subject_id: id,
        subject_type: "user",
        weight: 1,
        priority: 0,
        is_active: true,
      }));
      if (assignees.length > 0) {
        await api.scheduling
          .updateAssignees(eventType.id, assignees, owner)
          .catch(() => {});
      }
      setStep(3);
    } catch (err) {
      toast.error(decodeError(err).message || "Couldn’t finish setup");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WizardFrame
      pillar={pillar}
      title="Family scheduling"
      step={step}
      total={3}
      onBack={() =>
        step > 1 ? setStep(step - 1) : router.push("/app/scheduling")
      }
    >
      <StepRail
        steps={HOME_STEPS}
        current={step}
        done={step === 3 ? [1, 2, 3] : step === 2 ? [1] : []}
        pillar={pillar}
      />

      {step === 1 && (
        <>
          <PillarChip pillar={pillar} icon={House} label="Home" />
          <Headline
            title="Choose who’s scheduled"
            sub="Pick the household members people can book. Family scheduling uses everyone’s own hours — no one sets times twice."
          />
          {members.length > 0 ? (
            <MemberPicker
              members={members}
              selected={selected}
              onToggle={(id) =>
                setSelected((s) => {
                  const n = new Set(s);
                  if (n.has(id)) n.delete(id);
                  else n.add(id);
                  return n;
                })
              }
              pillar={pillar}
              inviteHref={`/app/homes/${homeId}`}
            />
          ) : (
            <p className="rounded-xl border border-app-border bg-app-surface px-4 py-6 text-center text-sm text-app-text-secondary">
              Just you for now — invite household members any time.
            </p>
          )}
          <Actions>
            <Primary pillar={pillar} onClick={() => setStep(2)}>
              Continue · {selected.size || 1} selected
            </Primary>
          </Actions>
        </>
      )}

      {step === 2 && (
        <>
          <Headline
            title="How should times combine?"
            sub="Choose how members’ availability turns into one set of bookable times."
          />
          <div className="grid grid-cols-2 gap-2.5">
            <ModeTile
              pillar={pillar}
              active={mode === "collective"}
              title="Collective"
              line="Everyone must be free. Times are the overlap of all members."
              icon={Users}
              onClick={() => setMode("collective")}
            />
            <ModeTile
              pillar={pillar}
              active={mode === "round_robin"}
              title="Round-robin"
              line="Whoever’s free gets the booking, assigned by a rule."
              icon={UserCheck}
              onClick={() => setMode("round_robin")}
            />
          </div>
          <ComposedNote
            pillar={pillar}
            body="Times come from each member’s personal availability — you’re not setting hours twice."
          />
          <Actions>
            <Ghost onClick={() => setMode("collective")}>Use defaults</Ghost>
            <Primary
              pillar={pillar}
              onClick={finish}
              disabled={submitting}
              grow
            >
              {submitting ? "Saving…" : "Finish setup"}
            </Primary>
          </Actions>
        </>
      )}

      {step === 3 && (
        <SuccessHero
          pillar={pillar}
          title="Your family link is live"
          sub="Share it and people can book any free member during their own hours. Bookings show up on the family schedule."
          slug={slug}
          primaryLabel="Share link"
          onPrimary={() => router.push("/app/scheduling/booking-page")}
          secondaryLabel="Members"
          secondaryIcon={Users}
          onSecondary={() => router.push(`/app/homes/${homeId}`)}
        />
      )}
    </WizardFrame>
  );
}

// ── Variant: Business ─────────────────────────────────────────────

const BIZ_STEPS = [
  { n: 1, label: "Link" },
  { n: 2, label: "Service" },
  { n: 3, label: "Team" },
  { n: 4, label: "Confirm" },
];

const SERVICES: {
  id: string;
  label: string;
  icon: LucideIcon;
  mode: EventTypeLocationMode;
}[] = [
  { id: "consult", label: "Consultation", icon: MessageSquare, mode: "video" },
  { id: "quote", label: "Quote visit", icon: HomeIcon, mode: "in_person" },
  {
    id: "survey",
    label: "Site survey",
    icon: ClipboardCheck,
    mode: "in_person",
  },
  { id: "service", label: "Service call", icon: Wrench, mode: "in_person" },
];

function BusinessOnboarding({
  owner,
  ownerId,
}: {
  owner: SchedulingOwnerRef;
  ownerId: string;
}) {
  const router = useRouter();
  const pillar: Pillar = "business";
  const paid = webFeatureFlags.schedulingPaid;
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [slug, setSlug] = useState("");
  const [ownedSlug, setOwnedSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [service, setService] = useState("consult");
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState(120);
  const [team, setTeam] = useState<MemberView[]>([]);
  const [seated, setSeated] = useState<Set<string>>(new Set());
  const [confirmMode, setConfirmMode] = useState<"auto" | "approve">("approve");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ page }, t] = await Promise.all([
          api.scheduling.getBookingPage(owner),
          api.businessIam
            .getTeamMembers(ownerId)
            .catch(() => ({ members: [] as unknown[] })),
        ]);
        if (cancelled) return;
        setSlug(page.slug);
        setOwnedSlug(page.slug);
        const list = readMembers(t.members ?? []);
        setTeam(list);
        setSeated(new Set(list.map((m) => m.userId)));
      } catch (err) {
        if (!cancelled)
          toast.error(decodeError(err).message || "Couldn’t load business");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [owner, ownerId]);

  const slugOk =
    slugStatus === "available" || (!!ownedSlug && slug === ownedSlug);

  const finish = async () => {
    setSubmitting(true);
    try {
      if (slug && slug !== ownedSlug) {
        await api.scheduling.updateBookingPageSlug(slug, owner);
        setOwnedSlug(slug);
      }
      await api.scheduling.updateBookingPage(
        { is_live: true, is_paused: false },
        owner,
      );
      const svc = SERVICES.find((s) => s.id === service)!;
      const { eventType } = await api.scheduling.createEventType(
        {
          name: svc.label,
          slug: sanitizeSlug(`${svc.id}-${duration}min`),
          durations: [duration],
          default_duration: duration,
          location_mode: svc.mode,
          requires_approval: confirmMode === "approve",
          visibility: "public",
          ...(paid
            ? { price_cents: Math.max(0, Math.round(price * 100)) }
            : {}),
        },
        owner,
      );
      const assignees: EventTypeAssignee[] = [...seated].map((id) => ({
        subject_id: id,
        subject_type: "user",
        weight: 1,
        priority: 0,
        is_active: true,
      }));
      if (assignees.length > 0) {
        await api.scheduling
          .updateAssignees(eventType.id, assignees, owner)
          .catch(() => {});
      }
      setDone(true);
    } catch (err) {
      toast.error(decodeError(err).message || "Couldn’t finish setup");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <WizardFrame
        pillar={pillar}
        title="Business booking"
        step={4}
        total={4}
        onBack={() => router.push("/app/scheduling")}
      >
        <StepRail
          steps={BIZ_STEPS}
          current={4}
          done={[1, 2, 3, 4]}
          pillar={pillar}
        />
        <SuccessHero
          pillar={pillar}
          title="You’re taking bookings"
          sub="Your link is live with one service and your seated team. You approve each booking before it’s confirmed."
          slug={ownedSlug}
          primaryLabel="Share link"
          onPrimary={() => router.push("/app/scheduling/booking-page")}
          secondaryLabel="Add service"
          secondaryIcon={Plus}
          onSecondary={() => router.push("/app/scheduling/event-types")}
        />
      </WizardFrame>
    );
  }

  return (
    <WizardFrame
      pillar={pillar}
      title="Business booking"
      step={step}
      total={4}
      onBack={() =>
        step > 1 ? setStep(step - 1) : router.push("/app/scheduling")
      }
    >
      <StepRail
        steps={BIZ_STEPS}
        current={step}
        done={Array.from({ length: step - 1 }, (_, i) => i + 1)}
        pillar={pillar}
      />

      {step === 1 && (
        <>
          <PillarChip pillar={pillar} icon={Briefcase} label="Business" />
          <Headline
            title="Claim your business link"
            sub="This is where clients book you. Pick something short — your business name usually works best."
          />
          <SlugClaimField
            owner={owner}
            pillar={pillar}
            value={slug}
            onChange={setSlug}
            onStatusChange={setSlugStatus}
            ownedSlug={ownedSlug}
            label="Your business link"
            availableHint="Clients will book your business here."
          />
          <Actions>
            <Primary
              pillar={pillar}
              disabled={!slugOk}
              onClick={() => setStep(2)}
            >
              Continue · add a service
            </Primary>
          </Actions>
        </>
      )}

      {step === 2 && (
        <>
          <Headline
            title="Add your first service"
            sub="Clients pick a service when they book. Start with one — add more from settings."
          />
          <div className="grid grid-cols-2 gap-2">
            {SERVICES.map((s) => {
              const active = s.id === service;
              const Icon = s.icon;
              const tk = pillarTokens(pillar);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setService(s.id)}
                  className={clsx(
                    "flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors",
                    active
                      ? clsx(tk.border, tk.bgSoft)
                      : "border-app-border bg-app-surface hover:bg-app-hover",
                  )}
                >
                  <span
                    className={clsx(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      active
                        ? clsx(tk.bg, tk.textOn)
                        : "bg-app-surface-sunken text-app-text-strong",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span
                    className={clsx(
                      "text-[12.5px] font-semibold",
                      active ? tk.text : "text-app-text",
                    )}
                  >
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-secondary">
                Duration
              </span>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2.5 text-sm font-semibold text-app-text outline-none focus:ring-2 focus:ring-app-business"
              >
                {[15, 30, 45, 60].map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-secondary">
                Price
              </span>
              <div className="flex items-center gap-1 rounded-lg border border-app-border bg-app-surface px-3 py-2.5">
                <span className="text-sm font-semibold text-app-text-secondary">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full bg-transparent text-sm font-semibold text-app-text outline-none"
                />
              </div>
            </label>
          </div>
          <Actions>
            <Ghost onClick={() => setStep(3)}>Use defaults</Ghost>
            <Primary pillar={pillar} onClick={() => setStep(3)} grow>
              Continue · seat your team
            </Primary>
          </Actions>
        </>
      )}

      {step === 3 && (
        <>
          <Headline
            title="Seat your team"
            sub="Seated teammates can take bookings. Front-desk roles manage the calendar without being booked."
          />
          {team.length > 0 ? (
            <BizTeamList
              members={team}
              selected={seated}
              onToggle={(id) =>
                setSeated((s) => {
                  const n = new Set(s);
                  if (n.has(id)) n.delete(id);
                  else n.add(id);
                  return n;
                })
              }
              pillar={pillar}
              inviteHref={`/app/businesses/${ownerId}`}
            />
          ) : (
            <p className="rounded-xl border border-app-border bg-app-surface px-4 py-6 text-center text-sm text-app-text-secondary">
              Just you for now — invite teammates any time.
            </p>
          )}
          <ComposedNote
            pillar={pillar}
            body="Booking times come from each seated teammate’s personal availability — no one re-enters their hours."
          />
          <Actions>
            <Ghost onClick={() => setStep(4)}>Skip · just me</Ghost>
            <Primary pillar={pillar} onClick={() => setStep(4)} grow>
              Continue
            </Primary>
          </Actions>
        </>
      )}

      {step === 4 && (
        <>
          <Headline
            title="Auto-confirm or approve?"
            sub="Decide what happens when a client picks a time. You can change this any time."
          />
          <Segmented
            pillar={pillar}
            value={confirmMode}
            onChange={(id) => setConfirmMode(id as "auto" | "approve")}
            options={[
              { id: "auto", label: "Auto-confirm bookings", icon: Zap },
              { id: "approve", label: "I approve each one", icon: UserCheck },
            ]}
          />
          {confirmMode === "approve" && (
            <ApproveExplainer pillar={pillar} />
          )}
          <Actions>
            <Primary
              pillar={pillar}
              icon={Check}
              disabled={submitting}
              onClick={finish}
              grow
            >
              {submitting ? "Saving…" : "Finish setup"}
            </Primary>
          </Actions>
        </>
      )}
    </WizardFrame>
  );
}

function ModeTile({
  pillar,
  active,
  title,
  line,
  icon: Icon,
  onClick,
}: {
  pillar: Pillar;
  active: boolean;
  title: string;
  line: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  const tk = pillarTokens(pillar);
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-colors",
        active
          ? clsx(tk.border, tk.bgSoft)
          : "border-app-border bg-app-surface hover:bg-app-hover",
      )}
    >
      <div className="flex items-center justify-between">
        <Icon
          className={clsx("h-6 w-6", active ? tk.text : "text-app-text-muted")}
          aria-hidden
        />
        <span
          className={clsx(
            "flex h-[18px] w-[18px] items-center justify-center rounded-full border",
            active
              ? clsx(tk.bg, "border-transparent")
              : "border-app-border-strong",
          )}
        >
          {active && (
            <Check className="h-3 w-3 text-white" strokeWidth={3} aria-hidden />
          )}
        </span>
      </div>
      <div>
        <p
          className={clsx(
            "text-[13.5px] font-bold",
            active ? tk.text : "text-app-text",
          )}
        >
          {title}
        </p>
        <p className="mt-1 text-[11.5px] leading-4 text-app-text-secondary">
          {line}
        </p>
      </div>
    </button>
  );
}

function SuccessHero({
  pillar,
  title,
  sub,
  slug,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  secondaryIcon: SecondaryIcon,
  onSecondary,
}: {
  pillar: Pillar;
  title: string;
  sub: string;
  slug: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  secondaryIcon: LucideIcon;
  onSecondary: () => void;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div className="flex flex-col items-center pt-2 text-center">
      <div className="relative mb-5 flex h-24 w-24 items-center justify-center">
        <div className={clsx("absolute inset-0 rounded-full", tk.bgSoft)} />
        <div
          className={clsx(
            "absolute inset-[18px] flex items-center justify-center rounded-full shadow-md",
            tk.bg,
          )}
        >
          <Check className="h-8 w-8 text-white" strokeWidth={3} aria-hidden />
        </div>
      </div>
      <h2 className="text-[22px] font-bold tracking-tight text-app-text">
        {title}
      </h2>
      <p className="mt-2 max-w-sm text-[13.5px] leading-5 text-app-text-secondary">
        {sub}
      </p>
      <div className="mt-5 w-full">
        <ShareLink
          url={buildBookingPageUrl(slug)}
          pillar={pillar}
          label="Your booking link"
        />
      </div>
      <div className="mt-5 flex w-full gap-2.5">
        <button
          type="button"
          onClick={onSecondary}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface text-sm font-semibold text-app-text-strong hover:bg-app-hover"
        >
          <SecondaryIcon className="h-4 w-4" aria-hidden />
          {secondaryLabel}
        </button>
        <button
          type="button"
          onClick={onPrimary}
          className={clsx(
            "flex h-12 flex-[1.5] items-center justify-center gap-2 rounded-xl text-sm font-semibold hover:opacity-90",
            tk.bg,
            tk.textOn,
          )}
        >
          <Share2 className="h-4 w-4" aria-hidden />
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}

function WizardFrame({
  pillar,
  title,
  step,
  total,
  onBack,
  children,
}: {
  pillar: Pillar;
  title: string;
  step: number;
  total: number;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <PillarThemeProvider pillar={pillar}>
      <div className="mx-auto max-w-xl">
        <header className="mb-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full text-app-text hover:bg-app-hover"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <h1 className="flex-1 text-lg font-semibold text-app-text">
            {title}
          </h1>
          <span className="text-xs font-semibold text-app-text-secondary">
            {step}/{total}
          </span>
        </header>
        <div className="space-y-5">{children}</div>
      </div>
    </PillarThemeProvider>
  );
}

export default function OnboardingWizard() {
  const router = useRouter();
  const sp = useSearchParams();
  const { owners, loading } = useHubOwners();
  const param = sp?.get("pillar");
  const pillar: Pillar = param === "business" ? "business" : "home";
  const option = owners[pillar];

  const content = useMemo(() => {
    if (pillar === "home") {
      const homeId = option.owner?.homeId;
      if (!homeId) return null;
      return <HomeOnboarding owner={option.owner!} homeId={homeId} />;
    }
    const ownerId = option.owner?.ownerId;
    if (!ownerId) return null;
    return <BusinessOnboarding owner={option.owner!} ownerId={ownerId} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pillar, option.owner?.homeId, option.owner?.ownerId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-xl space-y-4" aria-hidden>
        <div className="h-16 w-full animate-pulse rounded-xl bg-app-surface-sunken" />
        <div className="h-48 w-full animate-pulse rounded-xl bg-app-surface-sunken" />
      </div>
    );
  }

  if (!content) {
    return (
      <ErrorState
        message={`No ${pillar} is available to set up scheduling for.`}
        onRetry={() => router.push("/app/scheduling")}
      />
    );
  }

  return content;
}
