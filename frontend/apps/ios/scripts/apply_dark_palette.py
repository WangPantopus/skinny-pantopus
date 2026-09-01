#!/usr/bin/env python3
"""Apply Pantopus dark-appearance values to the asset-catalog colorsets.

Each colorset already ships a `luminosity: dark` slot whose components are a
copy of the light (universal) slot. This script rewrites *only* that dark slot
for the tokens listed in DARK below, leaving the light slot byte-for-byte
untouched. Tokens not listed keep dark == light on purpose (saturated brand /
category accents and skeuomorphic "paper" tokens read fine on a dark canvas).

Run from frontend/apps/ios:  python3 scripts/apply_dark_palette.py
"""

from __future__ import annotations

import json
import pathlib

ASSETS = pathlib.Path(__file__).resolve().parent.parent / "Pantopus/Resources/Assets.xcassets/Colors"

# Token (Group/Name as used in Color("Group/Name")) -> dark hex.
# Light values stay as authored; only these dark slots change.
DARK: dict[str, str] = {
    # --- Neutrals: the core inversion ------------------------------------
    "Neutral/AppBg": "#0d1117",
    "Neutral/AppSurface": "#161b22",
    "Neutral/AppSurfaceRaised": "#1c2230",
    "Neutral/AppSurfaceSunken": "#0b0e13",
    "Neutral/AppSurfaceMuted": "#12161d",
    "Neutral/AppBorder": "#2b313b",
    "Neutral/AppBorderStrong": "#3b424e",
    "Neutral/AppBorderSubtle": "#21262e",
    "Neutral/AppText": "#e6edf3",
    "Neutral/AppTextStrong": "#c9d1d9",
    "Neutral/AppTextSecondary": "#9aa4b2",
    "Neutral/AppTextMuted": "#6e7681",
    # AppTextInverse stays white — it labels colored fills (primary CTAs).
    "Neutral/AppHover": "#21262e",
    # PaperCream intentionally unchanged (skeuomorphic paper stock).

    # --- Primary: pale tints invert; saturated stops stay ----------------
    "Primary/Primary25": "#0c1722",
    "Primary/Primary50": "#0e1d2b",
    "Primary/Primary100": "#122a3d",
    "Primary/Primary200": "#1c3c52",

    # --- Semantic: bases stay; soft bg/light tints go dark-tinted --------
    "Semantic/SuccessBg": "#0f1f17",
    "Semantic/SuccessLight": "#163a2a",
    "Semantic/WarningBg": "#241d0e",
    "Semantic/WarningLight": "#3a2f12",
    "Semantic/ErrorBg": "#2a1416",
    "Semantic/ErrorLight": "#3d1d1f",
    "Semantic/InfoBg": "#0e1d2b",
    "Semantic/InfoLight": "#1c3c52",

    # --- Identity: pillar accents stay; bg tints go dark -----------------
    "Identity/PersonalBg": "#122036",
    "Identity/HomeBg": "#102a1c",
    "Identity/BusinessBg": "#221833",
    "Identity/WarmAmberBg": "#2a2110",
    "Identity/MagicBg": "#1d1733",
    "Identity/MagicBgSoft": "#15121f",
    "Identity/MagicBorder": "#2f2747",

    # --- Accent ----------------------------------------------------------
    "Accent/RoseBg": "#2a1418",
    "Accent/Slate": "#cbd5e1",      # foreground on dark needs to lighten
    "Accent/SlateBg": "#1e2530",
    # Rose / Star stay.

    # --- Category: dots stay saturated; only soft bg/border tints move ---
    "Category/RecordsBg": "#12161d",
    "Category/RecordsBorder": "#1e2530",
    "Category/TranslationBg": "#2a1420",
    "Category/UnboxingBg": "#0d211e",
    "Category/UnboxingBorder": "#134e48",
    # Records/RecordsDeep, Translation paper/ink, etc. left as paper-ish.
}


def components(hex_str: str) -> dict[str, str]:
    h = hex_str.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    return {
        "alpha": "1.000",
        "red": f"{r:.3f}",
        "green": f"{g:.3f}",
        "blue": f"{b:.3f}",
    }


def is_dark_slot(entry: dict) -> bool:
    for ap in entry.get("appearances", []):
        if ap.get("appearance") == "luminosity" and ap.get("value") == "dark":
            return True
    return False


def main() -> None:
    changed = 0
    for token, hex_str in DARK.items():
        path = ASSETS / f"{token}.colorset/Contents.json"
        if not path.exists():
            raise SystemExit(f"missing colorset: {path}")
        data = json.loads(path.read_text())
        dark_entries = [e for e in data.get("colors", []) if is_dark_slot(e)]
        if not dark_entries:
            raise SystemExit(f"no dark slot in {path}")
        for e in dark_entries:
            e["color"]["components"] = components(hex_str)
        path.write_text(json.dumps(data, indent=2) + "\n")
        changed += 1
    print(f"updated {changed} colorsets")


if __name__ == "__main__":
    main()
