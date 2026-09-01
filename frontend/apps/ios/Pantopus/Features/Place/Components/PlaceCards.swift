//
//  PlaceCards.swift
//  Pantopus
//
//  Composite Place cards ported 1:1 from `place-components.jsx`:
//  LockedCard (tier-gated content), DensityCard (k-anon bucket — text
//  and dots only, NEVER a number), HeroCard ("Today's Pulse" with the
//  inset nudge).
//

import SwiftUI

// MARK: - Locked card (`LockedCard`)

/// Tier-gated section teaser: muted tile, lock glyph, reason + sky CTA.
struct PlaceLockedCard: View {
    var icon: PantopusIcon = .home
    let title: String
    let reason: String
    let cta: String
    var onTap: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 11) {
                PlaceIconTile(icon: icon, tone: .muted)
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .kerning(-0.15)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.lock, size: 16, strokeWidth: 2, color: Theme.Color.appTextMuted)
            }
            .padding(.bottom, 11)
            Text(reason)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.bottom, 10)
            PlaceTextButton(title: cta) { onTap?() }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .placeCard()
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("place.locked.\(title)")
    }
}

// MARK: - Density card (`DensityCard`)

/// Block-density bucket card. Bucket text + dots only — the k-anonymity
/// rule means this card never shows a neighbor count.
struct PlaceDensityCard: View {
    let bucket: PlaceDensityBucket
    /// Server-rendered bucket label; falls back to the design copy.
    var label: String?
    /// The sky CTA under the bucket. Pass nil to hide it (dashboard cards
    /// tap through to the Block detail, so they omit the inline CTA).
    var ctaTitle: String? = "Be one of the first to verify on your block"
    var onTap: (() -> Void)?

    private var dots: Int {
        switch bucket {
        case .none: 0
        case .forming: 1
        case .few: 2
        case .growing: 3
        case .unknown: 0
        }
    }

    private var fallbackLabel: String {
        switch bucket {
        case .forming: "Your block is starting to form"
        case .few: "A few verified homes nearby"
        case .growing: "Growing activity near this area"
        case .none, .unknown: "No activity shown yet"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 11) {
                PlaceIconTile(icon: .users, tone: dots == 0 ? .muted : .home)
                Text("Verified homes nearby")
                    .font(.system(size: 15, weight: .semibold))
                    .kerning(-0.15)
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                PlaceChevron()
            }
            .padding(.bottom, 11)
            HStack(spacing: 10) {
                PlaceDensityDots(level: dots)
                Text(label ?? fallbackLabel)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(dots == 0 ? Theme.Color.appTextSecondary : Theme.Color.appText)
            }
            if let ctaTitle {
                Spacer().frame(height: 11)
                PlaceTextButton(title: ctaTitle) { onTap?() }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .placeCard()
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("place.density")
    }
}

// MARK: - Hero card (`HeroCard` — "Today's Pulse")

/// The dashboard hero. All-clear (green) or alert (amber) framing, with
/// an inset, clearly-tappable secondary nudge.
struct PlaceHeroCard: View {
    enum Variant { case allClear, alert }

    var variant: Variant = .allClear
    /// Top-right chip, e.g. "All clear" / "Air quality".
    let chip: PlaceChipModel
    /// Big icon in the tinted box.
    let heroIcon: PantopusIcon
    /// The one-sentence headline.
    let headline: String
    /// The inset nudge row.
    let nudgeIcon: PantopusIcon
    let nudgeText: String
    var onNudgeTap: (() -> Void)?
    var onTap: (() -> Void)?

    private var isAlert: Bool {
        variant == .alert
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("TODAY'S PULSE")
                    .font(.system(size: 11, weight: .bold))
                    .kerning(0.77)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                PlaceChip(model: chip)
            }
            .padding(.bottom, 13)

            HStack(alignment: .top, spacing: 13) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(isAlert ? Theme.Color.warningBg : Theme.Color.homeBg)
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(isAlert ? Theme.Color.warningLight : Theme.Color.successLight, lineWidth: 1)
                    Icon(heroIcon, size: 22, strokeWidth: 2, color: isAlert ? Theme.Color.warning : Theme.Color.home)
                }
                .frame(width: 42, height: 42)
                Text(headline)
                    .font(.system(size: 17, weight: .semibold))
                    .kerning(-0.2)
                    .lineSpacing(3)
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.bottom, nudgeText.isEmpty ? 0 : 14)

            // The inset nudge is optional — all-clear with nothing to flag
            // renders just the overline + headline (parity with the web hero).
            if !nudgeText.isEmpty {
                Button {
                    onNudgeTap?()
                } label: {
                    HStack(spacing: 10) {
                        Icon(nudgeIcon, size: 17, strokeWidth: 2, color: isAlert ? Theme.Color.warning : Theme.Color.home)
                        Text(nudgeText)
                            .font(.system(size: 13.5))
                            .lineSpacing(2.5)
                            .foregroundStyle(Theme.Color.appTextStrong)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Icon(.chevronRight, size: 17, strokeWidth: 2.25, color: Theme.Color.appTextMuted)
                    }
                    .padding(.vertical, 11)
                    .padding(.horizontal, 12)
                    .background(isAlert ? Theme.Color.warningBg : Theme.Color.appBg)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .strokeBorder(isAlert ? Theme.Color.warningLight : Theme.Color.appBorderSubtle, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 16)
        .padding(.horizontal, 16)
        .padding(.bottom, 14)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
        .shadow(color: Theme.Color.appText.opacity(0.06), radius: 12, x: 0, y: 3)
        .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 1)
        .contentShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .onTapGesture { onTap?() }
        .accessibilityIdentifier("place.hero")
    }
}

// MARK: - Sample content (previews + Phase 3 placeholders)

extension PlaceHeroCard {
    static var sampleAllClear: PlaceHeroCard {
        PlaceHeroCard(
            variant: .allClear,
            chip: PlaceChipModel(tone: .success, text: "All clear", icon: .check),
            heroIcon: .shieldCheck,
            headline: "All clear on your block today. Air is good and there are no active alerts.",
            nudgeIcon: .lightbulb,
            nudgeText: "A heat-pump rebate may apply to your home. Worth a look."
        )
    }

    static var sampleAlert: PlaceHeroCard {
        PlaceHeroCard(
            variant: .alert,
            chip: PlaceChipModel(tone: .warning, text: "Air quality", icon: .wind),
            heroIcon: .wind,
            headline: "Air quality is unhealthy for sensitive groups right now (112).",
            nudgeIcon: .clock,
            nudgeText: "Limit time outdoors this afternoon. It should clear by evening."
        )
    }
}

// MARK: - Previews

#Preview("Composite cards") {
    ScrollView {
        VStack(spacing: Spacing.s3) {
            PlaceHeroCard.sampleAllClear
            PlaceHeroCard.sampleAlert
            PlaceLockedCard(
                icon: .sun,
                title: "Daily conditions",
                reason: "Create a free account to see weather, air quality, and alerts for this address every day.",
                cta: "Create account"
            )
            PlaceDensityCard(bucket: .few)
            PlaceDensityCard(bucket: .none)
        }
        .padding(Spacing.s4)
    }
    .background(Theme.Color.appBg)
}
