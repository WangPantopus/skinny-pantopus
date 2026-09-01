//
//  TypeDatesCard.swift
//  Pantopus
//
//  A10.9 — "The train" overline + card. The icon tile carries the
//  archetype glyph in homeBg, the title + date strip read across the
//  top, the `Open` / `Covered` pill anchors the trailing end, and a
//  sky-gradient progress bar + contributor strip pin the bottom of the
//  card.
//

import SwiftUI

@MainActor
public struct TypeDatesCard: View {
    private let content: TypeDatesCardContent

    public init(content: TypeDatesCardContent) {
        self.content = content
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            header
            progressBlock
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .pantopusShadow(.sm)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityHeadline)
        .accessibilityIdentifier("supportTrainTypeDatesCard")
    }

    private var header: some View {
        HStack(spacing: Spacing.s3) {
            iconTile

            VStack(alignment: .leading, spacing: 2) {
                Text(content.title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Text(metaLine)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            statusPill
        }
    }

    private var iconTile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(Theme.Color.homeBg)
            Icon(kindIcon, size: 19, strokeWidth: 2, color: Theme.Color.homeDark)
        }
        .frame(width: 38, height: 38)
        .accessibilityHidden(true)
    }

    private var statusPill: some View {
        Text(content.isFullyCovered ? "Covered" : "Open")
            .font(.system(size: 10.5, weight: .bold))
            .textCase(.uppercase)
            .foregroundStyle(content.isFullyCovered ? Theme.Color.success : Theme.Color.primary700)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 3)
            .background(content.isFullyCovered ? Theme.Color.successBg : Theme.Color.primary50)
            .clipShape(Capsule())
    }

    private var progressBlock: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .firstTextBaseline) {
                progressLabel
                Spacer(minLength: Spacing.s2)
                Text("\(content.percentCovered)%")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(content.isFullyCovered ? Theme.Color.success : Theme.Color.primary700)
                    .monospacedDigit()
            }
            progressBar
            contributorStrip
        }
    }

    private var progressLabel: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text("\(content.slotsFilled)")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .monospacedDigit()
            Text("of \(content.slotsTotal) slots covered")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(content.slotsFilled) of \(content.slotsTotal) slots covered")
    }

    private var progressBar: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Theme.Color.appSurfaceSunken)
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: progressGradient,
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: proxy.size.width * progressFraction)
            }
        }
        .frame(height: 7)
        .accessibilityHidden(true)
    }

    private var contributorStrip: some View {
        HStack(spacing: Spacing.s2) {
            ZStack(alignment: .leading) {
                ForEach(Array(content.contributors.prefix(4).enumerated()), id: \.element.id) { index, bubble in
                    contributorDisc(bubble)
                        .offset(x: CGFloat(index) * 15)
                }
                if content.extraCount > 0 {
                    extraDisc
                        .offset(x: CGFloat(min(content.contributors.count, 4)) * 15)
                }
            }
            .frame(
                width: contributorRowWidth,
                height: 22,
                alignment: .leading
            )

            Text(contributorHelperLine)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private func contributorDisc(_ bubble: ContributorBubble) -> some View {
        ZStack {
            Circle().fill(tone(for: bubble.tone))
            Text(bubble.initials)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
        }
        .frame(width: 22, height: 22)
        .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
    }

    private var extraDisc: some View {
        ZStack {
            Circle().fill(Theme.Color.appSurfaceSunken)
            Text("+\(content.extraCount)")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .frame(width: 22, height: 22)
        .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
    }

    private var contributorRowWidth: CGFloat {
        let count = min(content.contributors.count, 4) + (content.extraCount > 0 ? 1 : 0)
        guard count > 0 else { return 0 }
        return CGFloat(count - 1) * 15 + 22
    }

    private var contributorHelperLine: String {
        content.isFullyCovered ? "All neighbors confirmed" : "\(content.slotsFilled) neighbors signed up"
    }

    private var metaLine: String {
        if content.daysLeft <= 0 {
            return content.dateRange
        }
        return "\(content.dateRange) · \(content.daysLeft) days left"
    }

    private var progressGradient: [Color] {
        if content.isFullyCovered {
            return [Theme.Color.success, Theme.Color.home]
        }
        return [Theme.Color.primary500, Theme.Color.primary600]
    }

    private var progressFraction: CGFloat {
        let total = Double(max(content.slotsTotal, 1))
        let filled = Double(content.slotsFilled)
        return CGFloat(max(0, min(1, filled / total)))
    }

    private var kindIcon: PantopusIcon {
        switch content.kind {
        case .meals: .utensils
        case .rides: .navigation
        case .childcare: .baby
        case .petcare: .pawPrint
        case .errands: .shoppingBag
        case .visits: .heart
        case .generic: .handCoins
        }
    }

    private var accessibilityHeadline: String {
        "\(content.title). \(metaLine). \(content.slotsFilled) of \(content.slotsTotal) slots covered."
    }

    private func tone(for tone: ContributorBubble.ContributorTone) -> Color {
        switch tone {
        case .warning: Theme.Color.warning
        case .primary: Theme.Color.primary500
        case .business: Theme.Color.business
        case .success: Theme.Color.success
        case .error: Theme.Color.error
        case .personal: Theme.Color.personal
        }
    }
}

#Preview("Populated") {
    TypeDatesCard(
        content: TypeDatesCardContent(
            kind: .meals,
            title: "Meal train · dinner for 4",
            dateRange: "Mon Nov 24 → Sun Dec 22",
            daysLeft: 20,
            slotsFilled: 12,
            slotsTotal: 21,
            contributors: [
                ContributorBubble(id: "sk", initials: "SK", tone: .warning),
                ContributorBubble(id: "tp", initials: "TP", tone: .primary),
                ContributorBubble(id: "mo", initials: "MO", tone: .business),
                ContributorBubble(id: "rj", initials: "RJ", tone: .success)
            ],
            extraCount: 8
        )
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}

#Preview("Covered") {
    TypeDatesCard(
        content: TypeDatesCardContent(
            kind: .meals,
            title: "Meal train · dinner for 4",
            dateRange: "Mon Nov 24 → Sun Dec 22",
            daysLeft: 20,
            slotsFilled: 21,
            slotsTotal: 21,
            contributors: [
                ContributorBubble(id: "sk", initials: "SK", tone: .warning),
                ContributorBubble(id: "tp", initials: "TP", tone: .primary),
                ContributorBubble(id: "mo", initials: "MO", tone: .business),
                ContributorBubble(id: "rj", initials: "RJ", tone: .success)
            ],
            extraCount: 17
        )
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
