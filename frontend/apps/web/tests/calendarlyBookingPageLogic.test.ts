/**
 * W4 — Calendarly booking-page / embed stream logic.
 *
 * Targeted unit tests for the pure helpers behind C1 (slug rules), C4 (one-off
 * param builder), and C9 (embed snippet builder). No React / network — just the
 * param builders + validators this stream owns.
 */

import {
  EXPIRY_OPTIONS,
  buildEmbedSnippet,
  buildOfferedSlots,
  embedSrc,
  isValidSlug,
  normalizeSlugInput,
  type EmbedConfig,
} from "@/components/scheduling/booking-page/logic";

const baseConfig: EmbedConfig = {
  slug: "northside-studio",
  type: "inline",
  brandColor: "#7C3AED",
  theme: "light",
  hideHeader: false,
  layout: "month",
  buttonText: "Book a call",
  position: "inline",
  corner: "br",
  pillar: "business",
};
const opts = {
  loaderSrc: "https://x.test/embed.js",
  appWebUrl: "https://x.test",
};

describe("slug rules (C1)", () => {
  it("accepts 3–50 lowercase/number/hyphen handles", () => {
    expect(isValidSlug("maria-k")).toBe(true);
    expect(isValidSlug("northside-studio")).toBe(true);
    expect(isValidSlug("abc")).toBe(true);
  });

  it("rejects invalid handles", () => {
    expect(isValidSlug("ab")).toBe(false); // too short
    expect(isValidSlug("-lead")).toBe(false); // leading hyphen
    expect(isValidSlug("trail-")).toBe(false); // trailing hyphen
    expect(isValidSlug("Has Caps")).toBe(false);
    expect(isValidSlug("emoji😀")).toBe(false);
  });

  it("normalizes raw input (lowercase, spaces → hyphens)", () => {
    expect(normalizeSlugInput("Maria K")).toBe("maria-k");
    expect(normalizeSlugInput("  Northside   Studio ")).toBe(
      "-northside-studio-",
    );
  });
});

describe("embed snippet builder (C9)", () => {
  it("builds an inline script snippet with the booking div + data attrs", () => {
    const lines = buildEmbedSnippet("script", baseConfig, opts);
    expect(lines[0]).toBe('<div id="pantopus-booking"></div>');
    expect(lines[1]).toBe('<script src="https://x.test/embed.js"');
    const joined = lines.join("\n");
    expect(joined).toContain('data-slug="northside-studio"');
    expect(joined).toContain('data-type="inline"');
    expect(joined).toContain('data-layout="month"');
    // the tag closes on the last attribute line
    expect(lines[lines.length - 1]).toMatch(/><\/script>$/);
    // inline omits button-only attributes
    expect(joined).not.toContain("data-label");
    expect(joined).not.toContain("data-corner");
  });

  it("includes label + position for popup and label + corner for floating", () => {
    const popup = buildEmbedSnippet(
      "script",
      { ...baseConfig, type: "popup" },
      opts,
    ).join("\n");
    expect(popup).toContain('data-type="popup"');
    expect(popup).toContain('data-label="Book a call"');
    expect(popup).toContain('data-position="inline"');
    expect(popup).not.toContain("pantopus-booking"); // no inline div

    const floating = buildEmbedSnippet(
      "script",
      { ...baseConfig, type: "floating", corner: "bl" },
      opts,
    ).join("\n");
    expect(floating).toContain('data-type="floating"');
    expect(floating).toContain('data-corner="bl"');
  });

  it("adds data-hide-header only when enabled", () => {
    expect(
      buildEmbedSnippet("script", baseConfig, opts).join("\n"),
    ).not.toContain("data-hide-header");
    expect(
      buildEmbedSnippet(
        "script",
        { ...baseConfig, hideHeader: true },
        opts,
      ).join("\n"),
    ).toContain('data-hide-header="1"');
  });

  it("builds an iframe snippet pointing at the bare embed target", () => {
    const lines = buildEmbedSnippet("iframe", baseConfig, opts);
    expect(lines[0]).toContain(
      '<iframe src="https://x.test/book/northside-studio/embed?',
    );
    expect(lines[lines.length - 1]).toMatch(/title="Book a time"><\/iframe>$/);
  });

  it("embedSrc encodes params (brand color, theme, hideHeader)", () => {
    const src = embedSrc("https://x.test", {
      slug: "northside-studio",
      theme: "dark",
      hideHeader: true,
      brandColor: "#7C3AED",
      pillar: "business",
      layout: "week",
    });
    expect(src).toContain("/book/northside-studio/embed?");
    expect(src).toContain("theme=dark");
    expect(src).toContain("layout=week");
    expect(src).toContain("primary=%237C3AED"); // '#' encoded
    expect(src).toContain("hideHeader=1");
  });
});

describe("one-off param builder (C4)", () => {
  it("returns undefined when 'offer specific times' is off", () => {
    expect(
      buildOfferedSlots([{ startLocal: "2026-06-17T09:00" }], 30, false),
    ).toBeUndefined();
  });

  it("returns undefined when no valid times were added", () => {
    expect(buildOfferedSlots([], 30, true)).toBeUndefined();
    expect(
      buildOfferedSlots([{ startLocal: "" }, { startLocal: "nope" }], 30, true),
    ).toBeUndefined();
  });

  it("maps valid rows to {start,end} ISO ranges of the service duration", () => {
    const out = buildOfferedSlots(
      [{ startLocal: "2026-06-17T09:00" }, { startLocal: "2026-06-18T14:00" }],
      45,
      true,
    );
    expect(out).toHaveLength(2);
    for (const slot of out!) {
      expect(() => new Date(slot.start).toISOString()).not.toThrow();
      expect(
        new Date(slot.end).getTime() - new Date(slot.start).getTime(),
      ).toBe(45 * 60 * 1000);
    }
  });

  it("offers the four expiry presets the API accepts (in minutes)", () => {
    expect(EXPIRY_OPTIONS.map((o) => o.value)).toEqual([
      String(24 * 60),
      String(7 * 24 * 60),
      String(30 * 24 * 60),
      String(365 * 24 * 60),
    ]);
  });
});
