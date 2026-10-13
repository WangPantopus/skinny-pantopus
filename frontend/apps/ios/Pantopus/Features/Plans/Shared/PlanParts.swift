//
//  PlanParts.swift
//  Pantopus
//
//  Nearby Plans board P2 parts: the kind tile and swatch, the type tag,
//  the privacy sentences (scope line and scope chip), the slot meter, the
//  avatar and the host row. Status chips are the shared `StatusChip`.
//

import SwiftUI

/// The 44 pt kind tile: the kind's tint with its glyph (rows, cards).
struct PlanTile: View {
    let kind: PlanKind
    var size: CGFloat = 44
    var glyph: CGFloat = 22

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.3, style: .continuous)
            .fill(kind.tint)
            .frame(width: size, height: size)
            .overlay(Icon(kind.icon, size: glyph, color: kind.color))
            .accessibilityHidden(true)
    }
}

/// The small solid swatch: the kind's color with the pin-ink glyph (chips, tags).
struct PlanSwatch: View {
    let kind: PlanKind
    var size: CGFloat = 22
    var glyph: CGFloat = 13

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.32, style: .continuous)
            .fill(kind.color)
            .frame(width: size, height: size)
            .overlay(Icon(kind.icon, size: glyph, strokeWidth: 2.2, color: Theme.Color.categoryPlanPinInk))
            .accessibilityHidden(true)
    }
}

/// "Watch party" on its tint, with the swatch.
struct PlanTypeTag: View {
    let kind: PlanKind

    var body: some View {
        HStack(spacing: 7) {
            PlanSwatch(kind: kind)
            Text(kind.title)
                .planFont(.label)
                .foregroundStyle(Theme.Color.appText)
        }
        .padding(.leading, Spacing.s1)
        .padding(.trailing, Spacing.s3)
        .frame(minHeight: 30)
        .background(Capsule().fill(kind.tint))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(kind.spokenTitle)
    }
}

/// A privacy promise as a sentence with the lock, next to what it protects.
struct PlanScopeLine: View {
    let text: String
    var icon: PantopusIcon = .lock

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Icon(icon, size: 16, color: Theme.Color.appTextSecondary)
                .alignmentGuide(.firstTextBaseline) { $0[.bottom] - 3 }
            Text(text)
                .planFont(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// The glass pill over a map: "Area only until you're in".
struct PlanScopeChip: View {
    let text: String

    var body: some View {
        HStack(spacing: 6) {
            Icon(.lock, size: 14, color: Theme.Color.appTextStrong)
            Text(text)
                .planFont(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineLimit(1)
        }
        .padding(.horizontal, 10)
        .frame(minHeight: 28)
        .background(Capsule().fill(.regularMaterial))
        .shadow(color: .black.opacity(0.12), radius: 5, x: 0, y: 2)
        .accessibilityElement(children: .combine)
    }
}

/// One segment per spot; the guest's own party in sky once they're in.
/// Over 12 spots it is one continuous bar.
struct PlanSlotMeter: View {
    let spots: Int
    let filled: Int
    var mine = 0

    var body: some View {
        Group {
            if spots > 12 {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Theme.Color.appSurfaceSunken)
                            .overlay(Capsule().stroke(Theme.Color.appBorderStrong, lineWidth: 1))
                        Capsule().fill(Theme.Color.successSolid)
                            .frame(width: geo.size.width * fraction)
                    }
                }
            } else {
                HStack(spacing: Spacing.s1) {
                    ForEach(0..<max(spots, 1), id: \.self) { index in
                        segment(index)
                    }
                }
            }
        }
        .frame(height: 8)
        .accessibilityHidden(true)
    }

    private var fraction: CGFloat {
        guard spots > 0 else { return 0 }
        return min(1, CGFloat(filled + mine) / CGFloat(spots))
    }

    @ViewBuilder
    private func segment(_ index: Int) -> some View {
        let shape = RoundedRectangle(cornerRadius: 3, style: .continuous)
        if index < filled {
            shape.fill(Theme.Color.successSolid)
        } else if index < filled + mine {
            shape.fill(Theme.Color.primary600)
        } else {
            shape.fill(Theme.Color.appSurfaceSunken)
                .overlay(shape.stroke(Theme.Color.appBorderStrong, lineWidth: 1))
        }
    }
}

/// A person's initial on a soft disc (or their photo).
struct PlanAvatar: View {
    let name: String
    var url: String?
    var size: CGFloat = 40

    var body: some View {
        let colors = Self.palette(for: name)
        ZStack {
            Circle().fill(colors.background)
            Text(String(name.prefix(1)).uppercased())
                .font(.system(size: size * 0.38, weight: .bold))
                .foregroundStyle(colors.ink)
            if let url, let link = URL(string: url) {
                CachedAsyncImage(url: link) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.clear
                }
                .clipShape(Circle())
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    /// The five soft avatar colors of board P2, picked by name.
    static func palette(for name: String) -> (background: Color, ink: Color) {
        let options: [(Color, Color)] = [
            (Theme.Color.magicBg, Theme.Color.magic),
            (Theme.Color.roseBg, Theme.Color.rose),
            (Theme.Color.successLight, Theme.Color.success),
            (Theme.Color.warningBg, Theme.Color.warning),
            (Theme.Color.primary100, Theme.Color.primary700)
        ]
        let index = name.unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) & 0xFFFF } % options.count
        return options[index]
    }
}

/// "Verified address" in green with the shield.
struct PlanVerifiedLabel: View {
    var text = "Verified address"

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.shieldCheck, size: 14, color: Theme.Color.success)
            Text(text)
                .planFont(.label)
                .foregroundStyle(Theme.Color.success)
        }
    }
}

/// The host: first name and last initial, the verified badge, plans hosted
/// and mutual connections. No ratings.
struct PlanHostRow: View {
    let host: PlanHostDTO
    var kind: PlanKind = .watchParty
    var showsChevron = false

    var body: some View {
        HStack(spacing: Spacing.s3) {
            PlanAvatar(name: host.displayName, url: host.avatarUrl)
            VStack(alignment: .leading, spacing: 2) {
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: Spacing.s2) { name
                        badge
                    }
                    VStack(alignment: .leading, spacing: 2) { name
                        badge
                    }
                }
                if let facts {
                    Text(facts)
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if showsChevron {
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var name: some View {
        Text(host.displayName)
            .planFont(.bodyStrong)
            .foregroundStyle(Theme.Color.appText)
    }

    @ViewBuilder private var badge: some View {
        if host.verifiedAddress { PlanVerifiedLabel() }
    }

    /// "Hosted 3 plans · 2 mutual connections" ("2 playdates" for a playdate host).
    private var facts: String? {
        var parts: [String] = []
        if kind == .playdate, let hosted = host.kindHosted, hosted > 0 {
            parts.append("Hosted \(hosted) playdate\(hosted == 1 ? "" : "s")")
        } else if let hosted = host.plansHosted, hosted > 0 {
            parts.append("Hosted \(hosted) plan\(hosted == 1 ? "" : "s")")
        }
        if let mutual = host.mutualConnections, mutual > 0 {
            parts.append("\(mutual) mutual connection\(mutual == 1 ? "" : "s")")
        }
        if parts.isEmpty { return "New to hosting" }
        return parts.joined(separator: " · ")
    }
}

/// "5 going · 3 spots left" over the slot meter, with an optional trailing note.
struct PlanSpotsBlock: View {
    let card: PlanCardDTO
    var trailing: String?
    var mine = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                (Text(goingText).fontWeight(.semibold) + Text(" · \(leftText)").foregroundColor(Theme.Color.appTextSecondary))
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s2)
                if let trailing {
                    Text(trailing)
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.trailing)
                }
            }
            PlanSlotMeter(spots: card.spots, filled: max(0, card.goingCount - mine), mine: mine)
        }
        .accessibilityElement(children: .combine)
    }

    private var goingText: String {
        if card.kind == .playdate { return "\(card.goingCount) famil\(card.goingCount == 1 ? "y" : "ies") going" }
        return "\(card.goingCount) going"
    }

    private var leftText: String {
        if card.isFull { return "full" }
        return "\(card.spotsLeft) spot\(card.spotsLeft == 1 ? "" : "s") left"
    }
}
