"use client";

// C9 — Embed / inline booking widget settings (web-only). Configures an embed
// type (inline / popup / floating), appearance, and a copyable snippet that
// points at THIS stream's bare iframe target /book/[slug]/embed (script variant
// uses the loader at <origin>/embed.js). A live preview reflects edits. The slug
// comes from GET /booking-page; the pillar drives the default brand color while
// all functional chrome stays sky.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Globe,
  LayoutTemplate,
  Palette,
  PanelBottom,
  RefreshCw,
  SquareMousePointer,
  Video,
} from "lucide-react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { scheduling } from "@pantopus/api";
import type { BookingPage } from "@pantopus/types";
import { APP_WEB_URL, copyToClipboard } from "@pantopus/utils";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import { pillarForOwner } from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import ErrorState from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/toast-store";
import { Card, Chips, Field, Segmented, TextInput, Toggle } from "./controls";
import {
  buildEmbedSnippet,
  type CalendarLayout,
  type EmbedType,
  type SnippetKind,
} from "./logic";

const PILLAR_HEX: Record<"personal" | "home" | "business", string> = {
  personal: "#0284C7",
  home: "#16A34A",
  business: "#7C3AED",
};
const SWATCHES = ["#0284C7", "#16A34A", "#7C3AED", "#111827", "#EA580C"];
const LOADER_SRC = `${APP_WEB_URL}/embed.js`;

export default function EmbedSnippetBuilder() {
  const owner = useSchedulingOwner();
  const pillar = pillarForOwner(owner.ownerType);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [page, setPage] = useState<BookingPage | null>(null);

  const [type, setType] = useState<EmbedType>("inline");
  const [snippetKind, setSnippetKind] = useState<SnippetKind>("script");
  const [buttonText, setButtonText] = useState("Book a call");
  const [position, setPosition] = useState("inline"); // popup: inline|centered
  const [corner, setCorner] = useState("br"); // floating: br|bl
  const [brandColor, setBrandColor] = useState(PILLAR_HEX[pillar]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [hideHeader, setHideHeader] = useState(false);
  const [layout, setLayout] = useState<CalendarLayout>("month");
  const [copied, setCopied] = useState(false);
  const [showOnPage, setShowOnPage] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    scheduling
      .getBookingPage(owner)
      .then((res) => {
        if (cancelled) return;
        setPage(res.page);
        setBrandColor(PILLAR_HEX[pillar]);
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

  const slug = page?.slug ?? "your-link";

  const snippet = useMemo(
    () =>
      buildEmbedSnippet(
        snippetKind,
        {
          slug,
          type,
          brandColor,
          theme,
          hideHeader,
          layout,
          buttonText,
          position,
          corner,
          pillar,
        },
        { loaderSrc: LOADER_SRC, appWebUrl: APP_WEB_URL },
      ),
    [
      snippetKind,
      slug,
      type,
      brandColor,
      theme,
      hideHeader,
      layout,
      buttonText,
      position,
      corner,
      pillar,
    ],
  );

  const copySnippet = useCallback(async () => {
    const ok = await copyToClipboard(snippet.join("\n"));
    if (ok) {
      setCopied(true);
      toast.success("Snippet copied");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Could not copy the snippet");
    }
  }, [snippet]);

  if (loading) {
    return (
      <div
        className="grid gap-6 lg:grid-cols-2"
        aria-busy="true"
        aria-label="Loading embed settings"
      >
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl border border-app-border bg-app-surface"
            />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-2xl border border-app-border bg-app-surface" />
      </div>
    );
  }
  if (loadError) {
    return (
      <ErrorState
        message={loadError}
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      {/* LEFT — config */}
      <div className="space-y-4">
        <EmbedTypeSegment value={type} onChange={setType} />

        {(type === "popup" || type === "floating") && (
          <Card>
            <CardTitle
              icon={type === "floating" ? PanelBottom : SquareMousePointer}
              sub={
                type === "floating"
                  ? "A pill that follows visitors as they scroll."
                  : "Opens your booking flow in a modal."
              }
            >
              {type === "floating" ? "Floating button" : "Popup button"}
            </CardTitle>
            <Field label="Button text">
              <TextInput value={buttonText} onChange={setButtonText} />
            </Field>
            <Field label={type === "floating" ? "Corner" : "Position"}>
              <Chips
                options={
                  type === "floating"
                    ? [
                        { label: "Bottom right", value: "br" },
                        { label: "Bottom left", value: "bl" },
                      ]
                    : [
                        { label: "Inline", value: "inline" },
                        { label: "Centered", value: "centered" },
                      ]
                }
                value={type === "floating" ? corner : position}
                onChange={type === "floating" ? setCorner : setPosition}
              />
            </Field>
          </Card>
        )}

        {/* Appearance */}
        <Card>
          <CardTitle icon={Palette} sub="Match the widget to your site.">
            Appearance
          </CardTitle>

          <Field label="Brand color">
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Use ${c}`}
                  aria-pressed={brandColor.toLowerCase() === c.toLowerCase()}
                  onClick={() => setBrandColor(c)}
                  className={clsx(
                    "h-7 w-7 rounded-lg border-2 border-white",
                    brandColor.toLowerCase() === c.toLowerCase()
                      ? "ring-2 ring-offset-1"
                      : "ring-1 ring-black/10",
                  )}
                  style={{
                    background: c,
                    ...(brandColor.toLowerCase() === c.toLowerCase()
                      ? ({ "--tw-ring-color": c } as React.CSSProperties)
                      : {}),
                  }}
                />
              ))}
              <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-app-border px-2 font-mono text-xs font-semibold text-app-text">
                <span
                  className="h-4 w-4 rounded"
                  style={{ background: brandColor }}
                />
                {brandColor.toUpperCase()}
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="sr-only"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-app-text-secondary">
              Defaults to your {pillar} color.
            </p>
          </Field>

          <Field label="Theme">
            <Segmented
              options={[
                { label: "Light", value: "light" },
                { label: "Dark", value: "dark" },
              ]}
              value={theme}
              onChange={(v) => setTheme(v as "light" | "dark")}
            />
          </Field>

          <div className="mt-3">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={hideHeader}
                onChange={(e) => setHideHeader(e.target.checked)}
                className="h-4 w-4 rounded border-app-border-strong text-primary-600 focus:ring-primary-600"
              />
              <span className="text-sm font-medium text-app-text">
                Hide page header
              </span>
            </label>
          </div>

          <Field label="Primary button label">
            <TextInput value={buttonText} onChange={setButtonText} />
          </Field>

          <Field label="Calendar layout">
            <Chips
              options={[
                { label: "Month", value: "month" },
                { label: "Week", value: "week" },
              ]}
              value={layout}
              onChange={(v) => setLayout(v as "month" | "week")}
            />
          </Field>
        </Card>

        {/* Snippet */}
        <Card>
          <CardTitle
            icon={Code2}
            sub="Paste this where the widget should appear."
          >
            Embed snippet
          </CardTitle>
          <div className="mb-3">
            <Segmented
              options={[
                { label: "Script", value: "script" },
                { label: "iframe", value: "iframe" },
              ]}
              value={snippetKind}
              onChange={(v) => setSnippetKind(v as SnippetKind)}
            />
          </div>
          <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 font-mono text-xs leading-5 text-slate-100">
            {snippet.map((l, i) => (
              <div
                key={i}
                className={clsx(
                  "whitespace-pre",
                  l.includes("<script") ||
                    l.includes("<div") ||
                    l.includes("<iframe")
                    ? "text-sky-300"
                    : l.trim().startsWith("data-")
                      ? "text-violet-300"
                      : "text-slate-200",
                )}
              >
                {l}
              </div>
            ))}
          </pre>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={copySnippet}
              className={clsx(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white",
                copied
                  ? "bg-app-success"
                  : "bg-primary-600 hover:bg-primary-700",
              )}
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {copied ? "Copied" : "Copy snippet"}
            </button>
            <span className="text-xs text-app-text-secondary">
              {snippetKind === "iframe"
                ? "Works anywhere — no script needed."
                : "Works on any site — Webflow, WordPress, plain HTML."}
            </span>
          </div>
        </Card>

        {/* Where it shows */}
        <Card>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <Globe className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-app-text-strong">
                Show inline on /b/{slug}
              </p>
              <p className="mt-0.5 text-xs text-app-text-secondary">
                Use this on any site, or turn it on for your Pantopus business
                page.
              </p>
            </div>
            <Toggle on={showOnPage} onChange={setShowOnPage} label="Show inline on business page" />
          </div>
        </Card>
      </div>

      {/* RIGHT — live preview */}
      <div className="lg:sticky lg:top-4">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-app-text-muted">
            Live preview
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-app-text-secondary">
            <RefreshCw className="h-3 w-3" aria-hidden />
            Updates as you edit
          </span>
        </div>
        <PreviewPane
          type={type}
          color={brandColor}
          theme={theme}
          hideHeader={hideHeader}
          buttonText={buttonText}
          name={page?.title || "Your page"}
          corner={corner}
        />
      </div>
    </div>
  );
}

// ── pieces ──────────────────────────────────────────────────────

function CardTitle({
  icon: Icon,
  children,
  sub,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-app-text-secondary" aria-hidden />
        <span className="text-sm font-bold text-app-text-strong">
          {children}
        </span>
      </div>
      {sub && (
        <p className="mt-1 text-xs leading-relaxed text-app-text-secondary">
          {sub}
        </p>
      )}
    </div>
  );
}

function EmbedTypeSegment({
  value,
  onChange,
}: {
  value: EmbedType;
  onChange: (t: EmbedType) => void;
}) {
  const opts: Array<{ id: EmbedType; label: string; icon: LucideIcon }> = [
    { id: "inline", label: "Inline", icon: LayoutTemplate },
    { id: "popup", label: "Popup button", icon: SquareMousePointer },
    { id: "floating", label: "Floating button", icon: PanelBottom },
  ];
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-app-border bg-app-surface-sunken p-1">
      {opts.map((o) => {
        const on = o.id === value;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={clsx(
              "flex flex-col items-center gap-1.5 rounded-lg px-2 py-3 text-xs font-semibold transition-colors",
              on
                ? "bg-app-surface text-app-text-strong shadow-sm"
                : "text-app-text-secondary hover:text-app-text",
            )}
          >
            <Icon
              className={clsx("h-5 w-5", on ? "text-primary-600" : "")}
              aria-hidden
            />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function PreviewPane({
  type,
  color,
  theme,
  hideHeader,
  buttonText,
  name,
  corner,
}: {
  type: EmbedType;
  color: string;
  theme: "light" | "dark";
  hideHeader: boolean;
  buttonText: string;
  name: string;
  corner: string;
}) {
  const dark = theme === "dark";
  const surface = dark ? "#0f172a" : "#ffffff";
  const sub = dark ? "#334155" : "#e2e8f0";
  const text = dark ? "#e2e8f0" : "#0f172a";
  const muted = dark ? "#64748b" : "#94a3b8";

  return (
    <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-md">
      {/* browser chrome */}
      <div className="flex h-9 items-center gap-2 border-b border-app-border bg-app-surface-sunken px-3.5">
        <span className="flex gap-1.5">
          {["#f87171", "#fbbf24", "#34d399"].map((c) => (
            <span
              key={c}
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: c }}
            />
          ))}
        </span>
        <span className="ml-1.5 flex h-5 flex-1 items-center gap-1.5 rounded-md border border-app-border bg-app-surface px-2 font-mono text-[10px] text-app-text-muted">
          <Globe className="h-2.5 w-2.5" aria-hidden />
          yoursite.com
        </span>
      </div>

      {/* faux site backdrop */}
      <div
        className="relative min-h-[380px] p-0"
        style={{ background: dark ? "#020617" : "#f8fafc" }}
      >
        <div
          className="flex h-11 items-center gap-2.5 border-b px-4"
          style={{ background: surface, borderColor: sub }}
        >
          <span className="h-5 w-5 rounded" style={{ background: muted }} />
          <span className="h-2 w-20 rounded" style={{ background: sub }} />
        </div>

        {type === "inline" && (
          <div
            className="mx-auto my-5 max-w-[420px] overflow-hidden rounded-2xl border shadow"
            style={{ background: surface, borderColor: sub }}
          >
            {!hideHeader && (
              <div
                className="flex items-center gap-2.5 border-b p-3.5"
                style={{ borderColor: sub }}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: color }}
                >
                  {name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <div className="text-sm font-bold" style={{ color: text }}>
                    {name}
                  </div>
                  <div className="text-[11px]" style={{ color: muted }}>
                    Pick a time that works for you.
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2">
              <div
                className="flex flex-col gap-2 border-r p-3"
                style={{ borderColor: sub }}
              >
                {[
                  { n: "Intro call", d: "30 min" },
                  { n: "Project kickoff", d: "45 min" },
                  { n: "Design review", d: "30 min" },
                ].map((e, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border p-2"
                    style={{
                      borderColor: i === 0 ? color : sub,
                      background: i === 0 ? `${color}1a` : surface,
                    }}
                  >
                    <Video
                      className="h-3.5 w-3.5"
                      style={{ color: i === 0 ? color : muted }}
                      aria-hidden
                    />
                    <div>
                      <div
                        className="text-[11px] font-semibold"
                        style={{ color: text }}
                      >
                        {e.n}
                      </div>
                      <div className="text-[9px]" style={{ color: muted }}>
                        {e.d}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <MiniCalendar color={color} text={text} muted={muted} />
            </div>
            <div className="p-3 pt-0">
              <div
                className="mt-1 rounded-lg py-2 text-center text-xs font-bold text-white"
                style={{ background: color }}
              >
                {buttonText}
              </div>
            </div>
          </div>
        )}

        {type === "popup" && (
          <div className="flex min-h-[330px] flex-col items-center justify-center gap-4 px-10">
            <span className="h-3 w-40 rounded" style={{ background: sub }} />
            <span className="h-2 w-56 rounded" style={{ background: sub }} />
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg"
              style={{ background: color }}
            >
              <Calendar className="h-4 w-4" aria-hidden />
              {buttonText}
            </button>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border bg-app-surface px-3 py-1 text-[11px] font-semibold text-app-text-secondary"
              style={{ borderColor: sub }}
            >
              <SquareMousePointer className="h-3 w-3" aria-hidden />
              Opens a booking modal
            </span>
          </div>
        )}

        {type === "floating" && (
          <div className="relative min-h-[330px] p-7">
            <div className="flex max-w-[360px] flex-col gap-2.5">
              <span className="h-3 w-44 rounded" style={{ background: sub }} />
              {[100, 96, 88, 92].map((w, i) => (
                <span
                  key={i}
                  className="h-2 rounded"
                  style={{ width: `${w}%`, background: sub }}
                />
              ))}
            </div>
            <button
              type="button"
              className={clsx(
                "absolute inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-xl",
                corner === "bl" ? "bottom-5 left-5" : "bottom-5 right-5",
              )}
              style={{ background: color }}
            >
              <Calendar className="h-4 w-4" aria-hidden />
              {buttonText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniCalendar({
  color,
  text,
  muted,
}: {
  color: string;
  text: string;
  muted: string;
}) {
  const avail = [15, 16, 17, 18, 19, 22, 23, 24];
  return (
    <div className="p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-bold" style={{ color: text }}>
          June
        </span>
        <span className="flex gap-1">
          <ChevronLeft
            className="h-3 w-3"
            style={{ color: muted }}
            aria-hidden
          />
          <ChevronRight
            className="h-3 w-3"
            style={{ color: muted }}
            aria-hidden
          />
        </span>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div
            key={i}
            className="text-center text-[8px] font-bold"
            style={{ color: muted }}
          >
            {d}
          </div>
        ))}
        {Array.from({ length: 30 }).map((_, i) => {
          const d = i + 1;
          const isAvail = avail.includes(d);
          const sel = d === 17;
          return (
            <div
              key={i}
              className="rounded-full py-0.5 text-center text-[9px]"
              style={{
                background: sel ? color : "transparent",
                color: sel ? "#fff" : isAvail ? text : muted,
                fontWeight: sel ? 700 : isAvail ? 600 : 400,
              }}
            >
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}
