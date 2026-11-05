//
//  CrewDayParts.swift
//  Pantopus
//
//  The pieces every Crew Day screen is built from (build kit 01-spec.md,
//  boards `Main`, `Price`, `Review`, `CrewDay`): cards in the Plans card
//  shape, the service tag, the crew row, the lock line, check rows and
//  status chips. Plans' type ramp and buttons; tokens only.
//

import SwiftUI

/// A white card with 20 pt corners and a hairline border.
struct CrewDayCard<Content: View>: View {
    var padding: CGFloat = Spacing.s4
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(padding)
        .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }
}

/// A card's or a group's heading ("How it works for you").
struct CrewDaySectionTitle: View {
    let text: String

    var body: some View {
        Text(text)
            .planFont(.h4)
            .foregroundStyle(Theme.Color.appText)
            .accessibilityAddTraits(.isHeader)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// The service on a home-green tile ("Gutter cleaning").
struct CrewDayServiceTag: View {
    let service: String?

    var body: some View {
        HStack(spacing: Spacing.s2) {
            CrewDayTile(size: 28)
            Text(CrewDayService(rawValue: service ?? "")?.label ?? "Crew Day")
                .planFont(.label)
                .foregroundStyle(Theme.Color.home)
        }
    }
}

/// The crew: an initial on business violet, the name, "Insured and
/// registered" when Pantopus verified it, and its reviews.
struct CrewDayCrewRow: View {
    let crew: CrewDayCrewDTO

    var body: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                Circle().fill(Theme.Color.businessBg)
                Text(String(crew.name.prefix(1)).uppercased())
                    .planFont(.bodyStrong)
                    .foregroundStyle(Theme.Color.business)
            }
            .frame(width: 40, height: 40)
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(crew.name)
                    .planFont(.bodyStrong)
                    .foregroundStyle(Theme.Color.appText)
                if crew.verified == true {
                    PlanVerifiedLabel(text: "Insured and registered")
                }
                if let rating = crew.rating, rating.count >= 1 {
                    Text(Self.ratingLine(rating))
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
    }

    /// "4.9 · 27 reviews from homes it served".
    static func ratingLine(_ rating: CrewDayCrewDTO.Rating) -> String {
        let reviews = rating.count == 1 ? "1 review" : "\(rating.count) reviews"
        return "\(String(format: "%.1f", rating.average)) · \(reviews) from homes it served"
    }
}

/// "Visible to your crew and Pantopus." with the lock.
struct CrewDayLockLine: View {
    let text: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
            Icon(.lock, size: 14, color: Theme.Color.appTextSecondary)
            Text(text)
                .planFont(.footnote)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// An included item or a promise, after a green check.
struct CrewDayCheckRow: View {
    let text: String
    var icon: PantopusIcon = .check
    var tint: Color = Theme.Color.success

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
            Icon(icon, size: 16, color: tint)
            Text(text)
                .planFont(.body)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// A row with an icon tile, a title and a line ("Your home, your own price").
struct CrewDayPromiseRow: View {
    let icon: PantopusIcon
    let title: String
    let line: String

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Theme.Color.homeBg)
                .frame(width: 36, height: 36)
                .overlay(Icon(icon, size: 18, color: Theme.Color.home))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                Text(line)
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
    }
}

/// A small status chip ("Open", "Waiting for approval", "Paid out").
struct CrewDayChip: View {
    enum Tone { case neutral, good, waiting, bad, business, info }

    let text: String
    var tone: Tone = .neutral

    var body: some View {
        Text(text)
            .planFont(.chip)
            .foregroundStyle(ink)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 3)
            .background(Capsule().fill(fill))
            .lineLimit(1)
    }

    private var ink: Color {
        switch tone {
        case .neutral: Theme.Color.appTextSecondary
        case .good: Theme.Color.success
        case .waiting: Theme.Color.warningDeep
        case .bad: Theme.Color.error
        case .business: Theme.Color.business
        case .info: Theme.Color.info
        }
    }

    private var fill: Color {
        switch tone {
        case .neutral: Theme.Color.appSurfaceSunken
        case .good: Theme.Color.successBg
        case .waiting: Theme.Color.warningBg
        case .bad: Theme.Color.errorBg
        case .business: Theme.Color.businessBg
        case .info: Theme.Color.infoBg
        }
    }
}

/// A full-width error line under a form or a footer button.
struct CrewDayErrorText: View {
    let text: String
    var identifier = "crewDayError"

    var body: some View {
        Text(text)
            .planFont(.footnote)
            .foregroundStyle(Theme.Color.error)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity)
            .accessibilityIdentifier(identifier)
    }
}

/// The sticky footer every Crew Day screen puts its one primary action in.
struct CrewDayFooter<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(spacing: Spacing.s2) {
            content()
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s2)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Divider().overlay(Theme.Color.appBorder) }
    }
}

/// The loading and error states of a Crew Day page: a skeleton in the
/// page's shape, and what failed with Retry.
struct CrewDayLoadingView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            ForEach(0..<3, id: \.self) { _ in FeedSkeletonCard() }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .accessibilityIdentifier("crewDayLoading")
    }
}

struct CrewDayErrorView: View {
    let message: String
    let retry: @MainActor () async -> Void

    var body: some View {
        EmptyState(
            icon: .alertCircle,
            headline: "Couldn't load this Crew Day",
            subcopy: message,
            cta: EmptyState.CTA(title: "Try again") { await retry() }
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("crewDayLoadError")
    }
}

/// A Crew Day page's read: loading, loaded, or failed with a sentence.
enum CrewDayLoad<Value: Sendable> {
    case loading
    case loaded(Value)
    case failed(String)

    var value: Value? {
        if case let .loaded(value) = self { return value }
        return nil
    }
}
