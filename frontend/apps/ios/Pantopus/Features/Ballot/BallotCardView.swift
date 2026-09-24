//
//  BallotCardView.swift
//  Pantopus
//
//  Place — "Your ballot" (Board: Place: Your ballot card, and the proposed
//  P0 states board). Measured from the canvas: a white card, 1pt border,
//  radius 20, padding 16, rows 14 apart (12 in the compact states); the
//  34pt home-green tile; 15 semibold title over a 12.5 subtitle; the
//  "N days" pill; the deadline timeline; the 44pt primary button
//  (radius 12); the sunken links well (radius 14); the 12pt source line.
//
//  Every sentence comes from the server (`civic_election`, `ballot_p0`).
//  This view lays it out and draws nothing it wasn't given.
//

import SwiftUI

/// The card frame the Ballot cards share (the Place card surface, radius 20).
struct BallotCardFrame: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(Spacing.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous)
                    .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.04), radius: 3, x: 0, y: 1)
    }
}

extension View {
    func ballotCardFrame() -> some View {
        modifier(BallotCardFrame())
    }
}

struct BallotCardView: View {
    let card: BallotSummary
    /// The section envelope's `as_of`.
    var asOf: String?
    var onOpenGovernments: (() -> Void)?

    private var roomy: Bool {
        (card.phase == .inSeason && card.coverage == .supported) || card.phase == .electionDay
    }

    var body: some View {
        VStack(alignment: .leading, spacing: roomy ? 14 : Spacing.s3) {
            BallotCardHeader(title: card.title, subtitle: card.subtitle, chip: card.chip)
            if let line = card.line {
                Text(line)
                    .font(.system(size: 15, weight: .medium))
                    .lineSpacing(3)
                    .foregroundStyle(Theme.Color.appText)
            }
            if card.phase == .inSeason, card.coverage == .supported, let today = card.today, !card.deadlines.isEmpty {
                BallotTimelineView(deadlines: card.deadlines, today: today)
            }
            if let notice = card.electionDayNotice {
                BallotNoticeWell(lead: notice.lead, detail: notice.detail)
            }
            if let text = card.howItWorks {
                BallotBodyText(text: text)
            }
            if let note = card.note {
                BallotBodyText(text: note)
            }
            if let action = card.primaryAction, action.kind == "governments", let onOpenGovernments {
                BallotPrimaryButton(label: action.label, height: 44, action: onOpenGovernments)
                    .accessibilityIdentifier("place.ballot.governments")
            }
            BallotLinksWell(links: card.officialLinks)
            if let source = sourceText {
                Text(source)
                    .font(Theme.Font.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .ballotCardFrame()
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("place.ballot.card")
    }

    private var sourceText: String? {
        guard let line = card.sourceLine else { return nil }
        guard let date = BallotFormat.asOfDate(asOf) else { return line }
        return "\(line) · as of \(date)"
    }
}

struct BallotCardHeader: View {
    let title: String
    let subtitle: String?
    let chip: String?

    var body: some View {
        HStack(spacing: 10) {
            BallotTile()
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if let chip {
                Text(chip)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(Theme.Color.appSurfaceSunken))
            }
        }
    }
}

struct BallotBodyText: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 13.5))
            .lineSpacing(3)
            .foregroundStyle(Theme.Color.appTextStrong)
            .fixedSize(horizontal: false, vertical: true)
    }
}

struct BallotPrimaryButton: View {
    let label: String
    let height: CGFloat
    var fontSize: CGFloat = 15
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: fontSize, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(maxWidth: .infinity, minHeight: height)
                .background(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .fill(Theme.Color.primary700)
                )
        }
        .buttonStyle(.plain)
    }
}

/// The needs-action well: warning ink on the warning background, radius 14.
struct BallotNoticeWell: View {
    let lead: String
    let detail: String?
    var radius: CGFloat = 14
    var verticalPadding: CGFloat = 10
    var horizontalPadding: CGFloat = Spacing.s3

    var body: some View {
        HStack(spacing: 10) {
            Icon(.calendar, size: 18, strokeWidth: 2, color: Theme.Color.warning)
            message
                .font(.system(size: 13.5))
                .lineSpacing(3)
                .foregroundStyle(Theme.Color.warning)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, verticalPadding)
        .padding(.horizontal, horizontalPadding)
        .background(
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(Theme.Color.warningBg)
        )
    }

    /// The bold lead, then the detail, as one run of text.
    private var message: Text {
        let detailText = detail.flatMap { $0.isEmpty ? nil : $0 }
        if lead.isEmpty { return Text(detailText ?? "") }
        let leadText = Text(lead).fontWeight(.semibold)
        guard let detailText else { return leadText }
        return leadText + Text(" \(detailText)")
    }
}

struct BallotLinksWell: View {
    let links: [BallotOfficialLink]
    @Environment(\.openURL) private var openURL

    var body: some View {
        if !links.isEmpty {
            VStack(spacing: Spacing.s0) {
                ForEach(Array(links.enumerated()), id: \.offset) { index, link in
                    Button {
                        if let url = URL(string: link.url) { openURL(url) }
                    } label: {
                        row(link)
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Opens the official site")
                    if index < links.count - 1 {
                        Rectangle()
                            .fill(Theme.Color.appBorder)
                            .frame(height: 1)
                    }
                }
            }
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
            )
        }
    }

    private func row(_ link: BallotOfficialLink) -> some View {
        HStack(spacing: Spacing.s2) {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text(link.label)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                Text(link.owner)
                    .font(Theme.Font.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Icon(.externalLink, size: 16, strokeWidth: 2, color: Theme.Color.appTextSecondary)
        }
        .padding(Spacing.s3)
        .contentShape(Rectangle())
    }
}

enum BallotFormat {
    /// "32 days left." / "1 day left." / "Last day."
    static func daysLeft(_ n: Int) -> String {
        if n <= 0 { return "Last day." }
        return "\(n) \(n == 1 ? "day" : "days") left."
    }

    /// Reference data is dated, never timed: "Sep 24" from its `as_of`.
    static func asOfDate(_ asOf: String?) -> String? {
        guard let asOf, asOf.count >= 10 else { return nil }
        let day = BallotTimelineLayout.monthDay(String(asOf.prefix(10)))
        return day == String(asOf.prefix(10)) ? nil : day
    }
}
