//
//  StatsTabsBody.swift
//  Pantopus
//
//  `stats_tabs` slot for the Public profile detail. Raised stats strip
//  overlapping the header → action button row → About/Reviews/Gigs/
//  Portfolio tab strip → tab content panel.
//
//  With `profileUserId`, the Reviews / Gigs / Portfolio panels mount the
//  live sections in `Features/Profile/Tabs/ProfileTabsSections.swift`,
//  backed by `GET /api/reviews/user/:userId` (`reviews.js:149`),
//  `GET /api/gigs?user_id=…` (`gigs.js:2089`) and
//  `GET /api/files/portfolio[/:userId]` (`files.js:489` / `:526`).
//  Without an id the body keeps the caller-supplied static content and
//  hides Portfolio, since there is nothing to fetch.
//
// swiftlint:disable multiple_closures_with_trailing_closure

import SwiftUI

/// One cell in the raised stats strip.
public struct ProfileStatCell: Sendable, Hashable, Identifiable {
    public let id: String
    public let value: String
    public let label: String

    public init(id: String, value: String, label: String) {
        self.id = id
        self.value = value
        self.label = label
    }
}

/// Tab identifier for `StatsTabsBody`.
public enum ProfileTab: String, Sendable, CaseIterable, Identifiable {
    case about, reviews, gigs, portfolio

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .about: "About"
        case .reviews: "Reviews"
        case .gigs: "Gigs"
        case .portfolio: "Portfolio"
        }
    }
}

/// Review row passed into the Reviews tab body.
public struct ProfileReviewCard: Sendable, Hashable, Identifiable {
    public let id: String
    public let reviewerName: String
    public let reviewerAvatarURL: URL?
    public let rating: Int
    public let body: String
    public let timestamp: String

    public init(
        id: String,
        reviewerName: String,
        reviewerAvatarURL: URL?,
        rating: Int,
        body: String,
        timestamp: String
    ) {
        self.id = id
        self.reviewerName = reviewerName
        self.reviewerAvatarURL = reviewerAvatarURL
        self.rating = max(0, min(5, rating))
        self.body = body
        self.timestamp = timestamp
    }
}

/// `StatsTabsBody` content payload bundling all dynamic surfaces.
public struct StatsTabsContent: Sendable, Hashable {
    public let stats: [ProfileStatCell]
    public let bio: String?
    public let skills: [String]
    public let reviews: [ProfileReviewCard]

    public init(
        stats: [ProfileStatCell],
        bio: String?,
        skills: [String],
        reviews: [ProfileReviewCard]
    ) {
        self.stats = stats
        self.bio = bio
        self.skills = skills
        self.reviews = reviews
    }
}

/// Stats strip + action row + tab strip + tab body. Caller owns the
/// selected-tab binding so navigation events stay external.
///
/// P6.5: `showActionRow` lets callers suppress the inline Message /
/// Connect / overflow row when the host screen renders kind-aware CTAs
/// in a sticky footer instead (Public profile · Persona vs Local).
@MainActor
public struct StatsTabsBody: View {
    private let content: StatsTabsContent
    @Binding private var selectedTab: ProfileTab
    private let showStats: Bool
    private let showActionRow: Bool
    private let profileUserId: String?
    private let isOwnProfile: Bool
    private let onMessage: @MainActor () -> Void
    private let onConnect: @MainActor () -> Void
    private let onOverflow: @MainActor () -> Void
    private let onOpenGig: @MainActor (String) -> Void
    private let onOpenReviewer: @MainActor (String) -> Void

    public init(
        content: StatsTabsContent,
        selectedTab: Binding<ProfileTab>,
        showStats: Bool = true,
        showActionRow: Bool = true,
        profileUserId: String? = nil,
        isOwnProfile: Bool = false,
        onMessage: @escaping @MainActor () -> Void = {},
        onConnect: @escaping @MainActor () -> Void = {},
        onOverflow: @escaping @MainActor () -> Void = {},
        onOpenGig: @escaping @MainActor (String) -> Void = { _ in },
        onOpenReviewer: @escaping @MainActor (String) -> Void = { _ in }
    ) {
        self.content = content
        _selectedTab = selectedTab
        self.showStats = showStats
        self.showActionRow = showActionRow
        self.profileUserId = profileUserId
        self.isOwnProfile = isOwnProfile
        self.onMessage = onMessage
        self.onConnect = onConnect
        self.onOverflow = onOverflow
        self.onOpenGig = onOpenGig
        self.onOpenReviewer = onOpenReviewer
    }

    /// Portfolio only exists once the host knows *whose* profile this is —
    /// there is no static portfolio payload to fall back on.
    private var visibleTabs: [ProfileTab] {
        profileUserId == nil
            ? [.about, .reviews, .gigs]
            : ProfileTab.allCases
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            // P8.6 — the A21 Beacon profile relocates the stat row into
            // the identity block; `showStats: false` suppresses the
            // raised strip so it isn't rendered twice.
            if showStats {
                statsStrip
                    .padding(.horizontal, Spacing.s4)
                    .offset(y: -16) // overlap the header per FrameProfile spec
                    .padding(.bottom, -16)
            }

            if showActionRow {
                actionRow.padding(.horizontal, Spacing.s4)
            }

            tabStrip.padding(.horizontal, Spacing.s4)

            Group {
                switch selectedTab {
                case .about: aboutTabContent
                case .reviews: reviewsTabContent
                case .gigs: gigsTabContent
                case .portfolio: portfolioTabContent
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
    }

    private var statsStrip: some View {
        HStack(alignment: .center, spacing: Spacing.s2) {
            ForEach(content.stats) { stat in
                VStack(spacing: 2) {
                    Text(stat.value)
                        .font(.system(size: PantopusTextStyle.h3.size, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(stat.label.uppercased())
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(0.5)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, Spacing.s3)
        .padding(.horizontal, Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .pantopusShadow(.sm)
        .accessibilityElement(children: .combine)
    }

    private var actionRow: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: { onMessage() }) {
                Text("Message")
                    .font(.system(size: PantopusTextStyle.small.size, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(maxWidth: .infinity, minHeight: 42)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Message")

            Button(action: { onConnect() }) {
                Text("Connect")
                    .font(.system(size: PantopusTextStyle.small.size, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, minHeight: 42)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Connect")

            Button(action: { onOverflow() }) {
                Icon(.moreHorizontal, size: 20, color: Theme.Color.appText)
                    .frame(width: 42, height: 42)
                    .background(Theme.Color.appSurface)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Theme.Color.appBorder, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("More actions")
        }
    }

    private var tabStrip: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(visibleTabs) { tab in
                Button {
                    selectedTab = tab
                } label: {
                    VStack(spacing: Spacing.s1) {
                        Text(tab.label)
                            .font(.system(size: PantopusTextStyle.small.size, weight: tab == selectedTab ? .semibold : .regular))
                            .foregroundStyle(
                                tab == selectedTab
                                    ? Theme.Color.primary600
                                    : Theme.Color.appTextSecondary
                            )
                        Rectangle()
                            .fill(tab == selectedTab ? Theme.Color.primary600 : Color.clear)
                            .frame(height: 2)
                    }
                    .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.label)
                .accessibilityAddTraits(
                    tab == selectedTab ? [.isButton, .isSelected] : .isButton
                )
            }
        }
    }

    private var aboutTabContent: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if let bio = content.bio, !bio.isEmpty {
                Text(bio)
                    .font(.system(size: PantopusTextStyle.body.size))
                    .foregroundStyle(Theme.Color.appText)
                    .lineSpacing(4)
            } else {
                Text("No bio yet")
                    .font(.system(size: PantopusTextStyle.small.size))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            if !content.skills.isEmpty {
                Text("Skills")
                    .font(.system(size: PantopusTextStyle.caption.size, weight: .semibold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .textCase(.uppercase)
                FlowingChips(items: content.skills)
            }
        }
    }

    /// Live `GET /api/reviews/user/:userId` panel — summary header, the
    /// worker | poster | all filter and the media viewer. Falls back to
    /// the caller-supplied cards when no profile id is threaded.
    @ViewBuilder private var reviewsTabContent: some View {
        if let profileUserId {
            ProfileGigReviewsSection(userId: profileUserId, onOpenReviewer: onOpenReviewer)
        } else if content.reviews.isEmpty {
            EmptyState(
                icon: .star,
                headline: "No reviews yet",
                subcopy: "Reviews appear here after completed gigs."
            )
            .frame(minHeight: 200)
        } else {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                ForEach(content.reviews) { card in
                    ReviewCardView(card: card)
                }
            }
        }
    }

    /// Live `GET /api/gigs?user_id=…` panel; rows deep-link into gig
    /// detail through the host's route stack.
    @ViewBuilder private var gigsTabContent: some View {
        if let profileUserId {
            ProfileGigsSection(userId: profileUserId, onOpenGig: onOpenGig)
        } else {
            EmptyState(
                icon: .hammer,
                headline: "No recent gigs",
                subcopy: "Recent gigs from this user will appear here."
            )
            .frame(minHeight: 200)
        }
    }

    /// Live `GET /api/files/portfolio[/:userId]` panel. `isOwnProfile`
    /// unlocks the add sheet and the per-card delete confirm.
    @ViewBuilder private var portfolioTabContent: some View {
        if let profileUserId {
            ProfilePortfolioSection(userId: profileUserId, isOwnProfile: isOwnProfile)
        } else {
            EmptyState(
                icon: .image,
                headline: "No portfolio yet",
                subcopy: "Portfolio work from this user will appear here."
            )
            .frame(minHeight: 200)
        }
    }
}

// MARK: - Sub-views

private struct FlowingChips: View {
    let items: [String]

    var body: some View {
        // Naive horizontal flow wraps on overflow via StatsTabsFlowLayout.
        StatsTabsFlowLayout(spacing: Spacing.s2) {
            ForEach(items, id: \.self) { item in
                Text(item)
                    .font(.system(size: PantopusTextStyle.caption.size, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary700)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, 6)
                    .background(Theme.Color.primary100)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
            }
        }
    }
}

/// Minimal flow layout — wraps children to the next row when they
/// overflow. Used for the skills chip row.
private struct StatsTabsFlowLayout: Layout {
    let spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let width = proposal.width ?? 0
        var rowWidth: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if rowWidth + size.width > width {
                totalHeight += rowHeight + spacing
                rowWidth = size.width + spacing
                rowHeight = size.height
            } else {
                rowWidth += size.width + spacing
                rowHeight = max(rowHeight, size.height)
            }
        }
        totalHeight += rowHeight
        return CGSize(width: width, height: totalHeight)
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal _: ProposedViewSize,
        subviews: Subviews,
        cache _: inout ()
    ) {
        var x: CGFloat = bounds.minX
        var y: CGFloat = bounds.minY
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

private struct ReviewCardView: View {
    let card: ProfileReviewCard

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                AvatarWithIdentityRing(
                    name: card.reviewerName,
                    imageURL: card.reviewerAvatarURL,
                    identity: .personal,
                    ringProgress: 1,
                    size: 40
                )
                VStack(alignment: .leading, spacing: 2) {
                    Text(card.reviewerName)
                        .font(.system(size: PantopusTextStyle.small.size, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    HStack(spacing: 2) {
                        ForEach(0..<5) { idx in
                            Icon(
                                .star,
                                size: 12,
                                color: idx < card.rating ? Theme.Color.warning : Theme.Color.appTextMuted
                            )
                        }
                    }
                }
                Spacer()
                Text(card.timestamp)
                    .font(.system(size: PantopusTextStyle.caption.size))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            if !card.body.isEmpty {
                Text(card.body)
                    .font(.system(size: PantopusTextStyle.small.size))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineSpacing(3)
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .pantopusShadow(.sm)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(card.reviewerName), \(card.rating) star review, \(card.timestamp)")
    }
}

// MARK: - Preview

#Preview("Populated") {
    @Previewable @State var selected: ProfileTab = .about
    StatsTabsBody(
        content: StatsTabsContent(
            stats: [
                ProfileStatCell(id: "reviews", value: "12", label: "Reviews"),
                ProfileStatCell(id: "rating", value: "4.9", label: "Rating"),
                ProfileStatCell(id: "gigs", value: "8", label: "Gigs")
            ],
            bio: "Cambridge transplant. I post about local food, ask for handy help, share neighborhood updates.",
            skills: ["Carpentry", "Spanish", "Coffee snob", "JS / TS"],
            reviews: [
                ProfileReviewCard(
                    id: "1",
                    reviewerName: "Sam Lee",
                    reviewerAvatarURL: nil,
                    rating: 5,
                    body: "Great help with my move. Would book again.",
                    timestamp: "2 days ago"
                )
            ]
        ),
        selectedTab: $selected
    )
    .padding(.vertical, Spacing.s5)
    .background(Theme.Color.appBg)
}
