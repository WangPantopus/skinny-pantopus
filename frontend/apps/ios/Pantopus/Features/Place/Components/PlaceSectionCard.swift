//
//  PlaceSectionCard.swift
//  Pantopus
//
//  THE SECTION-CARD ATOM — ported 1:1 from `place-components.jsx`
//  `SectionCard`. One card per intelligence section; the `state` maps
//  straight off the section envelope:
//    ready/partial → .loaded · stale → .stale · unavailable → .unavailable
//    error → .error · (fetch in flight) → .loading · empty data → .empty
//
//  Two layouts: stacked (default) and `inline` — the compact
//  single-line reading used by the "Today" group.
//

import SwiftUI

/// Render state for a section card (see envelope mapping above).
enum PlaceSectionCardState: Equatable {
    case loading
    case loaded
    case empty
    case unavailable
    case stale
    case error
}

struct PlaceSectionCard: View {
    var icon: PantopusIcon = .wind
    var title: String
    /// Short freshness line, e.g. "9:12 AM" — hidden while loading.
    var asOf: String?
    var state: PlaceSectionCardState = .loaded
    /// Main reading, e.g. "62° and clear".
    var value: String?
    var caption: String?
    var chip: PlaceChipModel?
    /// Small colored dot before the inline value (status reading).
    var statusDot: Color?
    var sparkline: Bool = false
    /// Renders as the value, sky tap-through (e.g. "Set up your plan").
    var actionLabel: String?
    /// Compact single-line layout (denser rhythm, Today group).
    var inline: Bool = false
    var compact: Bool = false
    var onTap: (() -> Void)?
    var onAction: (() -> Void)?
    var onRetry: (() -> Void)?

    private var tileTone: PlaceIconTile.Tone {
        state == .unavailable || state == .empty ? .muted : .home
    }

    var body: some View {
        Group {
            if inline, state == .loaded || state == .stale {
                inlineBody
            } else {
                stackedBody
            }
        }
        .contentShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .onTapGesture { onTap?() }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("place.section.\(title)")
    }

    /// ── INLINE: compact single-line reading ──
    private var inlineBody: some View {
        HStack(spacing: 11) {
            PlaceIconTile(icon: icon, tone: tileTone, size: 32)
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .kerning(-0.15)
                .foregroundStyle(Theme.Color.appText)
                .layoutPriority(1)
            HStack(spacing: 7) {
                if let chip {
                    PlaceChip(model: chip)
                } else if let actionLabel {
                    Text(actionLabel)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary600)
                        .lineLimit(1)
                } else if let value {
                    HStack(spacing: 6) {
                        if let statusDot {
                            Circle().fill(statusDot).frame(width: 8, height: 8)
                        }
                        Text(value)
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(Theme.Color.appText)
                            .multilineTextAlignment(.trailing)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
            PlaceChevron()
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 14)
        .placeCard()
    }

    /// ── STACKED: header + state body ──
    private var stackedBody: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
                .padding(.bottom, state == .loading || state == .error ? 12 : 11)
            body(for: state)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(compact ? 14 : 16)
        .placeCard()
    }

    private var header: some View {
        HStack(spacing: 11) {
            PlaceIconTile(icon: icon, tone: tileTone)
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .kerning(-0.15)
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let asOf, state != .loading {
                HStack(spacing: 5) {
                    if state == .stale {
                        Icon(.refreshCw, size: 13, strokeWidth: 2, color: Theme.Color.warning)
                    }
                    Text(asOf)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(state == .stale ? Theme.Color.warning : Theme.Color.appTextMuted)
                        .lineLimit(1)
                }
            }
            if state != .loading {
                PlaceChevron()
            }
        }
    }

    @ViewBuilder
    private func body(for state: PlaceSectionCardState) -> some View {
        switch state {
        case .loading:
            VStack(alignment: .leading, spacing: 9) {
                PlaceSkeleton(widthFraction: 0.62, height: 15)
                PlaceSkeleton(widthFraction: 0.84, height: 12)
            }
            .padding(.top, 2)

        case .empty:
            VStack(alignment: .leading, spacing: 3) {
                Text("Nothing here yet")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(caption ?? "We'll show readings once a sensor reports near you.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }

        case .unavailable:
            VStack(alignment: .leading, spacing: 3) {
                Text("Not available for your area yet.")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(caption ?? "Coverage is expanding. Check back later.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }

        case .error:
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 7) {
                    Icon(.cloudOff, size: 16, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                    Text("Couldn't load this")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
                PlaceTextButton(title: "Try again", arrow: false) { onRetry?() }
            }

        case .loaded, .stale:
            HStack(alignment: sparkline ? .bottom : .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 0) {
                    if let actionLabel {
                        PlaceTextButton(title: actionLabel) { onAction?() }
                    } else if let value {
                        Text(value)
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(Theme.Color.appText)
                            .lineSpacing(2)
                    }
                    if let chip {
                        PlaceChip(model: chip)
                            .padding(.top, 8)
                    }
                    if let caption {
                        Text(caption)
                            .font(.system(size: 12.5))
                            .foregroundStyle(Theme.Color.appTextMuted)
                            .padding(.top, 6)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if sparkline {
                    PlaceSparkline()
                }
            }
        }
    }
}

// MARK: - Previews

#Preview("Section card states") {
    ScrollView {
        VStack(spacing: Spacing.s2) {
            PlaceSectionCard(
                icon: .wind,
                title: "Air quality",
                asOf: "9:00 AM",
                state: .loaded,
                value: "AQI 38 — good",
                caption: "AirNow · EPA",
                chip: PlaceChipModel(tone: .success, text: "Good", icon: .check)
            )
            PlaceSectionCard(icon: .home, title: "Your home", state: .loaded, value: "Built 1979 · 1,840 sqft · ~$612k", sparkline: true)
            PlaceSectionCard(icon: .wind, title: "Air quality", state: .loading)
            PlaceSectionCard(icon: .droplets, title: "Water", state: .empty)
            PlaceSectionCard(icon: .landmark, title: "Civic", state: .unavailable)
            PlaceSectionCard(icon: .wind, title: "Air quality", asOf: "2h ago", state: .stale, value: "AQI 41 — good")
            PlaceSectionCard(icon: .wind, title: "Air quality", state: .error)
            PlaceGroupLabel(text: "Inline (Today rhythm)")
            PlaceSectionCard(icon: .sun, title: "Weather", state: .loaded, value: "62° and clear", inline: true)
            PlaceSectionCard(
                icon: .bell,
                title: "Alerts",
                state: .loaded,
                chip: PlaceChipModel(tone: .warning, text: "Wind advisory", icon: .wind),
                inline: true
            )
            PlaceSectionCard(icon: .shieldCheck, title: "Emergency plan", state: .loaded, actionLabel: "Set up your plan", inline: true)
        }
        .padding(Spacing.s4)
    }
    .background(Theme.Color.appBg)
}
