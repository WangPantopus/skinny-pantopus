// Pure, framework-free helpers for the W4 booking-page surfaces, extracted so the
// stream's logic (slug validity, embed-snippet builder, one-off param builder) is
// unit-testable without rendering React. No app/runtime imports here.

export type EmbedType = "inline" | "popup" | "floating";
export type SnippetKind = "script" | "iframe";
export type EmbedTheme = "light" | "dark";
export type CalendarLayout = "month" | "week";

/** Booking-page slug rule (mirrors the backend check-slug regex). */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

/** Normalize raw handle input as the user types (lowercase, spaces → hyphens). */
export function normalizeSlugInput(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-");
}

// ─── Embed snippet ──────────────────────────────────────────────

export interface EmbedConfig {
  slug: string;
  type: EmbedType;
  brandColor: string;
  theme: EmbedTheme;
  hideHeader: boolean;
  layout: CalendarLayout;
  buttonText: string;
  position: string; // popup: inline | centered
  corner: string; // floating: br | bl
  pillar: string;
}

/** The iframe-target URL the snippet (and live preview) point at. */
export function embedSrc(
  appWebUrl: string,
  config: Pick<
    EmbedConfig,
    "slug" | "theme" | "hideHeader" | "brandColor" | "pillar" | "layout"
  >,
): string {
  const qs = new URLSearchParams({
    theme: config.theme,
    layout: config.layout,
    pillar: config.pillar,
    primary: config.brandColor,
  });
  if (config.hideHeader) qs.set("hideHeader", "1");
  return `${appWebUrl}/book/${encodeURIComponent(config.slug)}/embed?${qs.toString()}`;
}

/** Build the copyable embed snippet (script loader or raw iframe). */
export function buildEmbedSnippet(
  kind: SnippetKind,
  config: EmbedConfig,
  opts: { loaderSrc: string; appWebUrl: string },
): string[] {
  if (kind === "iframe") {
    const src = embedSrc(opts.appWebUrl, config);
    return [
      `<iframe src="${src}"`,
      `  width="100%" height="720" frameborder="0"`,
      `  style="border:0;border-radius:16px"`,
      `  title="Book a time"></iframe>`,
    ];
  }

  const attrs: string[] = [
    `  data-slug="${config.slug}"`,
    `  data-type="${config.type}"`,
    `  data-color="${config.brandColor}"`,
    `  data-theme="${config.theme}"`,
  ];
  if (config.hideHeader) attrs.push(`  data-hide-header="1"`);
  if (config.type === "inline") attrs.push(`  data-layout="${config.layout}"`);
  if (config.type === "popup") {
    attrs.push(`  data-label="${config.buttonText}"`);
    attrs.push(`  data-position="${config.position}"`);
  }
  if (config.type === "floating") {
    attrs.push(`  data-label="${config.buttonText}"`);
    attrs.push(`  data-corner="${config.corner}"`);
  }
  attrs[attrs.length - 1] = `${attrs[attrs.length - 1]}></script>`;
  const lines = [`<script src="${opts.loaderSrc}"`, ...attrs];
  return config.type === "inline"
    ? [`<div id="pantopus-booking"></div>`, ...lines]
    : lines;
}

// ─── One-off link params ────────────────────────────────────────

// Backend enforces an expiry (5 min – 1 year). "1 year" stands in for the
// design's "No expiry" since one-off tokens always carry an expires_at.
export const EXPIRY_OPTIONS = [
  { label: "24 hours", value: String(24 * 60) },
  { label: "7 days", value: String(7 * 24 * 60) },
  { label: "30 days", value: String(30 * 24 * 60) },
  { label: "1 year", value: String(365 * 24 * 60) },
];

export interface OfferedSlotInput {
  /** value of <input type="datetime-local"> (local wall time, no zone). */
  startLocal: string;
}

/**
 * Convert offered-time rows into the API's `offered_slots` shape. Returns
 * undefined when "offer specific times" is off or no valid times were added
 * (the link then uses full availability). Each slot runs `durationMin`.
 */
export function buildOfferedSlots(
  slots: OfferedSlotInput[],
  durationMin: number,
  offerTimes: boolean,
): Array<{ start: string; end: string }> | undefined {
  if (!offerTimes) return undefined;
  const dur = (durationMin || 30) * 60 * 1000;
  const out: Array<{ start: string; end: string }> = [];
  for (const s of slots) {
    if (!s.startLocal) continue;
    const start = new Date(s.startLocal);
    if (Number.isNaN(start.getTime())) continue;
    out.push({
      start: start.toISOString(),
      end: new Date(start.getTime() + dur).toISOString(),
    });
  }
  return out.length ? out : undefined;
}
