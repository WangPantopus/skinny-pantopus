#!/usr/bin/env bash
#
# verify-tokens.sh — fail the build if feature code uses a raw literal
# for any value that has a design-system token.
#
# Catches the three regression categories the P7.* audits cleaned up:
#   1. Hex color literals in feature code outside the documented palette
#      modules (Color(red:…), Color(hex:…), Color(0x…), UIColor(red:…),
#      #colorLiteral).
#   2. On-scale spacing literals where Spacing.s* should be used —
#      .padding(N), .padding(.<edge>, N), spacing: N kwarg in any
#      layout constructor (Stack / LazyGrid / GridItem / FlowLayout /
#      .safeAreaInset), Spacer(minLength: N).
#   3. On-scale radius literals where Radii.<name> should be used —
#      cornerRadius: N kwarg (RoundedRectangle, Shimmer, etc.),
#      <edge>Radius: N (UnevenRoundedRectangle).
#
# Off-scale literals are NOT flagged — they're explicit design decisions
# logged in docs/token-drift-{color,spacing,radii}.md.
#

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FEATURES="$ROOT/Pantopus/Features"
COMPONENTS="$ROOT/Pantopus/Core/Design/Components"
APP="$ROOT/Pantopus/App"

# Token files themselves are exempt from every rule.
EXCLUDE_DESIGN=( --exclude-dir='_Internal' )

status=0

# --- 1. Hex color literals (with palette-module exemptions) ---------------
#
# Palette files exist to centralise bespoke per-category swatches the
# design pack ships without tokens — see docs/token-drift-color.md
# "DESIGN REVIEW" section for the full rationale. Each entry below is
# a file where the literals ARE the file's purpose; touching them needs
# a design call, not a CI rule. Keep this list short — every addition
# is a hex-literal escape hatch.
HEX_EXEMPT=(
  "Core/Design/Components/ConfettiSpray.swift"
  "Core/Design/Components/Shimmer.swift"
  "Features/CeremonialMailOpen/CeremonialMailOpenContent.swift"
  "Features/CeremonialMailOpen/CeremonialMailOpenView.swift"
  "Features/Compose/ListingCompose/ListingComposePhotoStep.swift"
  "Features/Compose/ListingCompose/SuggestionsBanner.swift"
  "Features/Gigs/GigsCategory.swift"
  "Features/Homes/AccessCodes/AccessCategoryPalette.swift"
  "Features/Homes/Bills/UtilityCategoryPalette.swift"
  "Features/Homes/Calendar/CalendarEventCategory.swift"
  "Features/Homes/Documents/DocumentCategoryPalette.swift"
  "Features/Homes/Documents/DocumentFileTypePalette.swift"
  "Features/Homes/Emergency/EmergencyCategoryPalette.swift"
  "Features/Homes/Maintenance/MaintenanceCategoryPalette.swift"
  "Features/Homes/Packages/CourierPalette.swift"
  "Features/Homes/Polls/PollKindPalette.swift"
  "Features/Homes/Tasks/HouseholdTaskCategoryPalette.swift"
  "Features/IdentityCenter/IdentityCenterContent.swift"
  "Features/Mailbox/MailDay/MailDayContent.swift"
  "Features/Mailbox/MailDay/Components/MailboxEmptyHero.swift"
  "Features/Mailbox/MailDay/Components/UndoCountdown.swift"
  "Features/Mailbox/Stamps/StampsContent.swift"
  "Features/Mailbox/MailDetail/Components/CertifiedStampBadge.swift"
  "Features/Mailbox/MailDetail/Components/CombinedSenderCarrierCard.swift"
  "Features/Mailbox/MailboxMap/MailboxSpotKind.swift"
  "Features/Marketplace/MarketplaceContent.swift"
  "Features/Membership/MembershipDetailContent.swift"
  "Features/Shared/MailItemDetail/MailItemDetailShell.swift"
  "Features/Shared/MapListHybrid/MapListHybridPreview.swift"
  "Features/Wallet/Components/WalletPalette.swift"
)
HEX_EXCLUDE_ARGS=()
for f in "${HEX_EXEMPT[@]}"; do
  HEX_EXCLUDE_ARGS+=( --exclude="${f##*/}" )
done

hex_violations=$(grep -rnE "Color\(red:|Color\(hex:|Color\(0x|UIColor\(red:|#colorLiteral" \
  "$FEATURES" "$COMPONENTS" "$APP" \
  --include='*.swift' "${EXCLUDE_DESIGN[@]}" "${HEX_EXCLUDE_ARGS[@]}" 2>/dev/null || true)

if [[ -n "$hex_violations" ]]; then
  echo "✗ verify-tokens: feature code must use Theme.Color.<token> instead of a hex literal:" >&2
  echo "$hex_violations" >&2
  echo "" >&2
  echo "  If this is a new bespoke palette module, add the file to HEX_EXEMPT in this script and surface to design review." >&2
  status=1
fi

# --- 2. On-scale spacing literals --------------------------------------
#
# Allowed token values: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
SPACING_VALS='0|4|8|12|16|20|24|32|40|48|64'
spacing_patterns=(
  "\\.padding\\(($SPACING_VALS)\\)"
  "\\.padding\\(\\.(horizontal|vertical|top|bottom|leading|trailing),[[:space:]]*($SPACING_VALS)\\)"
  "\\bspacing:[[:space:]]*($SPACING_VALS)([,)])"
  "Spacer\\(minLength:[[:space:]]*($SPACING_VALS)\\)"
)
spacing_combined=$(IFS='|'; echo "${spacing_patterns[*]}")
spacing_violations=$(grep -rnE "$spacing_combined" \
  "$FEATURES" "$COMPONENTS" "$APP" \
  --include='*.swift' "${EXCLUDE_DESIGN[@]}" 2>/dev/null || true)

if [[ -n "$spacing_violations" ]]; then
  echo "✗ verify-tokens: feature code must use Spacing.s<N> for on-scale layout spacing:" >&2
  echo "$spacing_violations" >&2
  echo "" >&2
  echo "  Mapping: 0→Spacing.s0  4→s1  8→s2  12→s3  16→s4  20→s5  24→s6  32→s8  40→s10  48→s12  64→s16" >&2
  status=1
fi

# --- 3. On-scale radius literals ---------------------------------------
#
# Allowed token values: 4 (xs), 6 (sm), 8 (md), 12 (lg), 16 (xl),
# 20 (xl2), 24 (xl3), 9999 (pill).
RADII_VALS='4|6|8|12|16|20|24|9999'
radii_patterns=(
  # `cornerRadius:` kwarg — RoundedRectangle, Shimmer, custom components.
  "\\bcornerRadius:[[:space:]]*($RADII_VALS)(\\b|[,)])"
  # Deprecated SwiftUI view-modifier form `.cornerRadius(N)`.
  "\\.cornerRadius\\(($RADII_VALS)\\)"
  # UnevenRoundedRectangle per-corner kwargs.
  "\\b(topLeading|topTrailing|bottomLeading|bottomTrailing)Radius:[[:space:]]*($RADII_VALS)(\\b|[,)])"
)
radii_combined=$(IFS='|'; echo "${radii_patterns[*]}")
radii_violations=$(grep -rnE "$radii_combined" \
  "$FEATURES" "$COMPONENTS" "$APP" \
  --include='*.swift' "${EXCLUDE_DESIGN[@]}" 2>/dev/null || true)

if [[ -n "$radii_violations" ]]; then
  echo "✗ verify-tokens: feature code must use Radii.<name> for on-scale corner radii:" >&2
  echo "$radii_violations" >&2
  echo "" >&2
  echo "  Mapping: 4→Radii.xs  6→sm  8→md  12→lg  16→xl  20→xl2  24→xl3  9999→pill" >&2
  status=1
fi

# --- 4. Typography: exact-scale .font(.system(...)) -------------------
#
# Reject only EXACT on-scale (size, weight) pairs — what P7.4 Pass 2
# cleaned up. Off-scale combinations (e.g. 14/.bold, 11/.bold, 9/.bold,
# 13/.semibold, non-integer 11.5/12.5/etc.) are explicit design choices
# documented in docs/token-drift-typography.md and stay in code untouched
# until design decides to extend the scale or snap them to canonical.
#
# (11, .semibold) is INTENTIONALLY NOT FLAGGED — Pass 2 skipped it
# because .pantopusTextStyle(.overline) ALSO applies UPPERCASE + 0.06em
# tracking. Auto-replacing would mutate rendering. Manual review per
# call site.
typography_pairs=(
  "size: 30, weight: \.bold"
  "size: 24, weight: \.semibold"
  "size: 20, weight: \.semibold"
  "size: 16, weight: \.regular"
  "size: 14, weight: \.regular"
  "size: 12, weight: \.regular"
)
typography_with_weight=$(IFS='|'; echo "${typography_pairs[*]}")
# Also catch the no-weight default-regular forms for body/small/caption.
typography_no_weight="size: (16|14|12)\\)"

typography_violations=$(grep -rnE "\\.font\\(\\.system\\(($typography_with_weight|$typography_no_weight)\\)" \
  "$FEATURES" "$COMPONENTS" "$APP" \
  --include='*.swift' "${EXCLUDE_DESIGN[@]}" 2>/dev/null || true)

if [[ -n "$typography_violations" ]]; then
  echo "✗ verify-tokens: feature code must use .pantopusTextStyle(.<role>) for exact-scale typography:" >&2
  echo "$typography_violations" >&2
  echo "" >&2
  echo "  Mapping: 30/.bold→.h1  24/.semibold→.h2  20/.semibold→.h3  16/.regular→.body  14/.regular→.small  12/.regular→.caption" >&2
  echo "  (no-weight forms default to .regular: size: 16→.body  size: 14→.small  size: 12→.caption)" >&2
  status=1
fi

if [[ "$status" -eq 0 ]]; then
  echo "✓ verify-tokens: no untokenised on-scale literals in feature code."
fi

exit "$status"
