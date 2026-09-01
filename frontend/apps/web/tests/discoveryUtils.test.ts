// W5 Invitee discovery — targeted unit tests for the stream's pure formatting
// helpers (duration/location labels, initials, host-name fallback, location
// icon mapping). These back the C5 landing + C6 slot-picker copy. No network.

import {
  Video,
  Phone,
  MapPin,
  Globe,
  MessageCircleQuestion,
} from "lucide-react";
import {
  durationLabel,
  locationLabel,
  initialsFromName,
  hostNameFrom,
  locationIcon,
} from "@/components/scheduling/public/discovery/discoveryUtils";

describe("durationLabel", () => {
  it("renders sub-hour durations as minutes", () => {
    expect(durationLabel(15)).toBe("15 min");
    expect(durationLabel(30)).toBe("30 min");
    expect(durationLabel(45)).toBe("45 min");
  });

  it("renders whole hours", () => {
    expect(durationLabel(60)).toBe("1 hr");
    expect(durationLabel(120)).toBe("2 hr");
  });

  it("renders hours + minutes", () => {
    expect(durationLabel(90)).toBe("1 hr 30 min");
    expect(durationLabel(75)).toBe("1 hr 15 min");
  });

  it("returns empty string for invalid input", () => {
    expect(durationLabel(0)).toBe("");
    expect(durationLabel(-5)).toBe("");
    expect(durationLabel(NaN)).toBe("");
  });
});

describe("locationLabel", () => {
  it("labels the fixed modes", () => {
    expect(locationLabel("video", null)).toBe("Video call");
    expect(locationLabel("phone", null)).toBe("Phone");
    expect(locationLabel("ask", null)).toBe("They'll ask you");
  });

  it("prefers the detail for in-person / custom, with sensible fallbacks", () => {
    expect(locationLabel("in_person", "Suite 200")).toBe("Suite 200");
    expect(locationLabel("in_person", null)).toBe("In person");
    expect(locationLabel("in_person", "   ")).toBe("In person");
    expect(locationLabel("custom", "Zoom Pro")).toBe("Zoom Pro");
    expect(locationLabel("custom", null)).toBe("Details to follow");
  });
});

describe("initialsFromName", () => {
  it("takes up to two initials, uppercased", () => {
    expect(initialsFromName("Maria Kessler")).toBe("MK");
    expect(initialsFromName("maria")).toBe("M");
    expect(initialsFromName("Northside Studio Team")).toBe("NS");
  });

  it("falls back to ? for empty input", () => {
    expect(initialsFromName("")).toBe("?");
    expect(initialsFromName("   ")).toBe("?");
    expect(initialsFromName(null)).toBe("?");
    expect(initialsFromName(undefined)).toBe("?");
  });
});

describe("hostNameFrom", () => {
  it("returns the trimmed title when present", () => {
    expect(hostNameFrom("Maria Kessler")).toBe("Maria Kessler");
    expect(hostNameFrom("  Elm Park Garden  ")).toBe("Elm Park Garden");
  });

  it("falls back when missing/blank", () => {
    expect(hostNameFrom(null)).toBe("this host");
    expect(hostNameFrom("")).toBe("this host");
    expect(hostNameFrom("   ")).toBe("this host");
    expect(hostNameFrom(null, "a Pantopus host")).toBe("a Pantopus host");
  });
});

describe("locationIcon", () => {
  it("maps each mode to its Lucide glyph", () => {
    expect(locationIcon("video")).toBe(Video);
    expect(locationIcon("phone")).toBe(Phone);
    expect(locationIcon("in_person")).toBe(MapPin);
    expect(locationIcon("ask")).toBe(MessageCircleQuestion);
    expect(locationIcon("custom")).toBe(Globe);
  });
});
