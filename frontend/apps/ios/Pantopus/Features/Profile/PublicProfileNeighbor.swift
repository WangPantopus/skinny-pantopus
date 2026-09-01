//
//  PublicProfileNeighbor.swift
//  Pantopus
//
//  B.2 (A10.5) — canonical neighbor profile layout. The neighbor-side
//  (Local) public profile renders this bespoke stack instead of the
//  shared centered `ProfileHeader` + `StatsTabsBody`:
//
//    profile_hero (left-aligned 72pt avatar + verify check + identity
//    chip + "Neighbor since …" kicker) → 3-up stat strip (degrades to
//    — / 0 / New for fresh neighbors) → segmented tabs (About · Reviews ·
//    Verifications · Posts) → tab body → sticky Message / Connect bar.
//
//  The shared `ProfileHeader` / `StatsTabsBody` / `ProfileTab` are reused
//  by Business + Audience profiles, so the A10.5 rework lives here in the
//  Profile feature rather than mutating those shells. Persona profiles
//  keep the existing shared layout.
//

import SwiftUI

// swiftlint:disable file_length

// MARK: - Models

/// Identity pillar treatment for the hero chip. `fresh` is the
/// new-verified-neighbor variant (amber "Verified · New here").
public enum NeighborIdentity: String, Sendable, Hashable {
    case personal, home, business, fresh

    var label: String {
        switch self {
        case .personal: "Personal · Verified"
        case .home: "Home · Verified"
        case .business: "Business · Verified"
        case .fresh: "Verified · New here"
        }
    }

    var foreground: Color {
        switch self {
        case .personal: Theme.Color.personal
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        case .fresh: Theme.Color.warning
        }
    }

    var background: Color {
        switch self {
        case .personal: Theme.Color.personalBg
        case .home: Theme.Color.homeBg
        case .business: Theme.Color.businessBg
        case .fresh: Theme.Color.warningBg
        }
    }
}

/// One cell in the 3-up stat strip.
public struct NeighborStat: Sendable, Hashable, Identifiable {
    public let id: String
    public let value: String
    public let label: String
    public let icon: PantopusIcon?
    public let valueColor: Color
    public let iconColor: Color

    public init(
        id: String,
        value: String,
        label: String,
        icon: PantopusIcon? = nil,
        valueColor: Color = Theme.Color.appText,
        iconColor: Color = Theme.Color.appTextSecondary
    ) {
        self.id = id
        self.value = value
        self.label = label
        self.icon = icon
        self.valueColor = valueColor
        self.iconColor = iconColor
    }
}

/// One row in the verification ledger.
public struct NeighborVerification: Sendable, Hashable, Identifiable {
    public enum Tile: Sendable, Hashable { case primary, success }
    public enum Trailing: Sendable, Hashable {
        case check
        case status(String)
    }

    public let id: String
    public let icon: PantopusIcon
    public let label: String
    public let meta: String
    public let tile: Tile
    public let trailing: Trailing

    public init(
        id: String,
        icon: PantopusIcon,
        label: String,
        meta: String,
        tile: Tile = .primary,
        trailing: Trailing = .check
    ) {
        self.id = id
        self.icon = icon
        self.label = label
        self.meta = meta
        self.tile = tile
        self.trailing = trailing
    }
}

/// Mutual-neighbors strip payload (social proof when reviews are absent).
public struct NeighborMutuals: Sendable, Hashable {
    public let count: Int
    public let names: String
    public let initials: [String]

    public init(count: Int, names: String, initials: [String]) {
        self.count = count
        self.names = names
        self.initials = initials
    }
}

/// Welcome-prompt card payload (break-the-ice CTA for new neighbors).
public struct NeighborWelcome: Sendable, Hashable {
    public let title: String
    public let body: String

    public init(title: String, body: String) {
        self.title = title
        self.body = body
    }
}

/// Tab identifier for the neighbor profile body.
public enum NeighborProfileTab: String, Sendable, CaseIterable, Identifiable {
    case about, reviews, verifications, posts

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .about: "About"
        case .reviews: "Reviews"
        case .verifications: "Verifications"
        case .posts: "Posts"
        }
    }
}

/// Hero payload for the A10.5 neighbor header.
public struct NeighborHero: Sendable, Hashable {
    public let name: String
    public let locality: String?
    public let avatarURL: URL?
    public let isVerified: Bool
    public let identity: NeighborIdentity
    public let kicker: String?

    public init(
        name: String,
        locality: String?,
        avatarURL: URL?,
        isVerified: Bool,
        identity: NeighborIdentity,
        kicker: String?
    ) {
        self.name = name
        self.locality = locality
        self.avatarURL = avatarURL
        self.isVerified = isVerified
        self.identity = identity
        self.kicker = kicker
    }

    var initials: String {
        Self.initials(from: name)
    }

    static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2).compactMap(\.first)
        return parts.map(String.init).joined().uppercased()
    }
}

/// Full hydrated content for the A10.5 neighbor profile.
public struct NeighborProfileContent: Sendable, Hashable {
    public let hero: NeighborHero
    public let stats: [NeighborStat]
    public let bio: String?
    public let skills: [String]
    public let verifications: [NeighborVerification]
    public let reviews: [ProfileReviewCard]
    public let reviewCount: Int
    public let mutuals: NeighborMutuals?
    public let welcome: NeighborWelcome?
    public let posts: [PublicProfilePost]
    public let isNewNeighbor: Bool
    public let primaryCtaLabel: String

    public init(
        hero: NeighborHero,
        stats: [NeighborStat],
        bio: String?,
        skills: [String],
        verifications: [NeighborVerification],
        reviews: [ProfileReviewCard],
        reviewCount: Int,
        mutuals: NeighborMutuals? = nil,
        welcome: NeighborWelcome? = nil,
        posts: [PublicProfilePost] = [],
        isNewNeighbor: Bool,
        primaryCtaLabel: String
    ) {
        self.hero = hero
        self.stats = stats
        self.bio = bio
        self.skills = skills
        self.verifications = verifications
        self.reviews = reviews
        self.reviewCount = reviewCount
        self.mutuals = mutuals
        self.welcome = welcome
        self.posts = posts
        self.isNewNeighbor = isNewNeighbor
        self.primaryCtaLabel = primaryCtaLabel
    }

    /// Tabs with the Reviews count pill.
    var tabs: [(tab: NeighborProfileTab, count: Int?)] {
        [
            (.about, nil),
            (.reviews, reviewCount),
            (.verifications, nil),
            (.posts, nil)
        ]
    }
}

// MARK: - Layout

/// Bespoke A10.5 neighbor profile layout. Reuses `ContentDetailTopBar`
/// for the chrome but lays out flush full-bleed white strips (hero, stat
/// strip, tab bar) to match the design — `ContentDetailShell`'s built-in
/// slot spacing would break that continuity.
@MainActor
struct NeighborProfileLayout: View {
    let content: NeighborProfileContent
    @Binding var selectedTab: NeighborProfileTab
    let connectState: PublicProfileActionState
    /// Existing viewer↔profile edge from `GET /api/users/:id/relationship`.
    /// Drives the Connect button's label + whether it renders at all.
    var connection: ProfileConnection = .none
    let onBack: @MainActor () -> Void
    let onMessage: @MainActor () -> Void
    let onConnect: @MainActor () -> Void
    let onReport: @MainActor () -> Void
    let onBlock: @MainActor () -> Void
    let onOverflow: @MainActor () -> Void

    var body: some View {
        ZStack(alignment: .bottom) {
            VStack(spacing: Spacing.s0) {
                ContentDetailTopBar(
                    title: nil,
                    onBack: onBack,
                    action: ContentDetailTopBarAction(
                        icon: .moreHorizontal,
                        accessibilityLabel: "More actions"
                    ) { Task { @MainActor in onOverflow() } }
                )
                ScrollView {
                    VStack(spacing: Spacing.s0) {
                        NeighborHeroCard(hero: content.hero)
                        NeighborStatStrip(stats: content.stats)
                        NeighborTabBar(tabs: content.tabs, selected: $selectedTab)
                        tabContent
                            .padding(.horizontal, Spacing.s4)
                            .padding(.top, Spacing.s3)
                        NeighborReportBlockRow(onReport: onReport, onBlock: onBlock)
                            .padding(.top, Spacing.s4)
                            .padding(.bottom, 120)
                    }
                }
                .background(Theme.Color.appBg)
            }
            NeighborActionBar(
                primaryLabel: content.primaryCtaLabel,
                connectState: connectState,
                connection: connection,
                onMessage: onMessage,
                onConnect: onConnect
            )
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("publicProfileNeighbor")
    }

    @ViewBuilder private var tabContent: some View {
        switch selectedTab {
        case .about: aboutTab
        case .reviews: reviewsTab
        case .verifications: verificationsTab
        case .posts: postsTab
        }
    }

    // MARK: About

    private var aboutTab: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            NeighborSectionTitle("Bio")
            Text(content.bio ?? "No bio yet")
                .font(.system(size: PantopusTextStyle.body.size))
                .foregroundStyle(content.bio == nil ? Theme.Color.appTextSecondary : Theme.Color.appTextStrong)
                .lineSpacing(4)
                .frame(maxWidth: .infinity, alignment: .leading)

            if !content.skills.isEmpty {
                NeighborSectionTitle("Helps with")
                NeighborSkillChips(skills: content.skills)
            }

            NeighborSectionTitle("Verifications")
            NeighborVerificationLedger(items: content.verifications)

            if let featured = content.reviews.first {
                NeighborSectionTitle("Featured review", action: "See all \(content.reviewCount)")
                NeighborReviewCard(card: featured)
            }
        }
    }

    // MARK: Reviews

    @ViewBuilder private var reviewsTab: some View {
        if content.reviews.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                NeighborReviewsEmptyCard(name: content.hero.name)
                    .padding(.top, Spacing.s3)

                NeighborSectionTitle("What we can vouch for")
                NeighborVerificationLedger(items: content.verifications)

                if let mutuals = content.mutuals {
                    NeighborSectionTitle("Neighbors in common", action: "See all")
                    NeighborMutualsStrip(mutuals: mutuals)
                }

                if let welcome = content.welcome {
                    NeighborWelcomeCard(welcome: welcome)
                        .padding(.top, Spacing.s3)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                ForEach(content.reviews) { NeighborReviewCard(card: $0) }
            }
            .padding(.top, Spacing.s2)
        }
    }

    // MARK: Verifications

    private var verificationsTab: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            NeighborSectionTitle("Verified attributes")
            NeighborVerificationLedger(items: content.verifications)
        }
    }

    // MARK: Posts

    @ViewBuilder private var postsTab: some View {
        if content.posts.isEmpty {
            EmptyState(
                icon: .messageCircle,
                headline: "No posts yet",
                subcopy: "Neighborhood posts from \(content.hero.name) will appear here."
            )
            .frame(minHeight: 200)
        } else {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                ForEach(content.posts) { PublicProfileLocalPostCard(post: $0) }
            }
            .padding(.top, Spacing.s2)
        }
    }
}

// MARK: - Hero card

@MainActor
struct NeighborHeroCard: View {
    let hero: NeighborHero

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            NeighborAvatar(initials: hero.initials, size: 72, isVerified: hero.isVerified)
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text(hero.name)
                    .font(.system(size: PantopusTextStyle.h3.size, weight: .bold))
                    .tracking(-0.4)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(2)
                    .accessibilityAddTraits(.isHeader)
                if let locality = hero.locality, !locality.isEmpty {
                    HStack(spacing: Spacing.s1) {
                        Icon(.mapPin, size: 11, color: Theme.Color.appTextSecondary)
                        Text(locality)
                            .font(.system(size: PantopusTextStyle.caption.size))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    .padding(.top, 2)
                }
                HStack(spacing: Spacing.s1) {
                    NeighborIdentityChip(identity: hero.identity)
                    if let kicker = hero.kicker {
                        NeighborKickerChip(text: kicker)
                    }
                }
                .padding(.top, Spacing.s2)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s4)
        .padding(.bottom, Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("publicProfileNeighborHero")
    }
}

@MainActor
struct NeighborAvatar: View {
    let initials: String
    let size: CGFloat
    var isVerified: Bool = false
    var tint: Color = Theme.Color.primary600

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Circle()
                .fill(tint)
                .frame(width: size, height: size)
                .overlay(
                    Text(initials)
                        .font(.system(size: size * 0.4, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                )
            if isVerified {
                // A10.5 — sky-blue verification check (the shared
                // VerifiedBadge is green; the neighbor hero uses primary).
                let badge = size >= 64 ? CGFloat(22) : CGFloat(16)
                ZStack {
                    Circle().fill(Theme.Color.primary600)
                    Icon(.check, size: badge * 0.58, strokeWidth: 3, color: Theme.Color.appTextInverse)
                }
                .frame(width: badge, height: badge)
                .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                .offset(x: 2, y: 2)
            }
        }
        .accessibilityHidden(true)
    }
}

@MainActor
private struct NeighborIdentityChip: View {
    let identity: NeighborIdentity

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.shieldCheck, size: 11, color: identity.foreground)
            Text(identity.label)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(identity.foreground)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, Spacing.s1)
        .background(identity.background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .accessibilityElement()
        .accessibilityLabel(identity.label)
        .accessibilityIdentifier("publicProfileNeighborIdentityChip")
    }
}

@MainActor
private struct NeighborKickerChip: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(Theme.Color.appTextStrong)
            .padding(.horizontal, 9)
            .padding(.vertical, Spacing.s1)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
            .accessibilityIdentifier("publicProfileNeighborKicker")
    }
}

// MARK: - Stat strip

@MainActor
struct NeighborStatStrip: View {
    let stats: [NeighborStat]

    var body: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(Array(stats.enumerated()), id: \.element.id) { index, stat in
                if index > 0 {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(width: 1, height: 32)
                }
                VStack(spacing: 2) {
                    HStack(spacing: 3) {
                        if let icon = stat.icon {
                            Icon(icon, size: 12, color: stat.iconColor)
                        }
                        Text(stat.value)
                            .font(.system(size: PantopusTextStyle.body.size, weight: .bold))
                            .tracking(-0.3)
                            .foregroundStyle(stat.valueColor)
                    }
                    Text(stat.label.uppercased())
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(0.4)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.s3)
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(stat.value) \(stat.label)")
            }
        }
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("publicProfileNeighborStats")
    }
}

// MARK: - Tab bar

@MainActor
struct NeighborTabBar: View {
    let tabs: [(tab: NeighborProfileTab, count: Int?)]
    @Binding var selected: NeighborProfileTab

    var body: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(tabs, id: \.tab) { entry in
                let isActive = entry.tab == selected
                Button { selected = entry.tab } label: {
                    VStack(spacing: Spacing.s0) {
                        HStack(spacing: 5) {
                            Text(entry.tab.label)
                                .font(.system(size: 12.5, weight: isActive ? .bold : .semibold))
                                .foregroundStyle(isActive ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
                            if let count = entry.count {
                                Text("\(count)")
                                    .font(.system(size: 10.5, weight: .bold))
                                    .foregroundStyle(isActive ? Theme.Color.primary600 : Theme.Color.appTextMuted)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 1)
                                    .background(isActive ? Theme.Color.primary50 : Theme.Color.appSurfaceSunken)
                                    .clipShape(Capsule())
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.s3)
                        Rectangle()
                            .fill(isActive ? Theme.Color.primary600 : Color.clear)
                            .frame(height: 2)
                    }
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("publicProfileNeighborTab.\(entry.tab.rawValue)")
                .accessibilityLabel(entry.tab.label)
                .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("publicProfileNeighborTabBar")
    }
}

// MARK: - Section title

@MainActor
struct NeighborSectionTitle: View {
    let text: String
    let action: String?

    init(_ text: String, action: String? = nil) {
        self.text = text
        self.action = action
    }

    var body: some View {
        HStack {
            Text(text.uppercased())
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
            if let action {
                Text(action)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
            }
        }
        .padding(.top, Spacing.s4)
        .padding(.bottom, Spacing.s2)
        .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - Verification ledger

@MainActor
struct NeighborVerificationLedger: View {
    let items: [NeighborVerification]

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                HStack(spacing: Spacing.s3) {
                    Icon(item.icon, size: 14, color: tileForeground(item.tile))
                        .frame(width: 28, height: 28)
                        .background(tileBackground(item.tile))
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    VStack(alignment: .leading, spacing: 1) {
                        Text(item.label)
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        Text(item.meta)
                            .font(.system(size: 10.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    Spacer(minLength: Spacing.s0)
                    trailing(item.trailing)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, 10)
                if index < items.count - 1 {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                        .padding(.leading, 50)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("publicProfileNeighborLedger")
    }

    @ViewBuilder private func trailing(_ trailing: NeighborVerification.Trailing) -> some View {
        switch trailing {
        case .check:
            Icon(.check, size: 12, color: Theme.Color.appTextInverse)
                .frame(width: 16, height: 16)
                .background(Theme.Color.success)
                .clipShape(Circle())
                .accessibilityLabel("Verified")
        case let .status(text):
            Text(text)
                .font(.system(size: 10.5))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
    }

    private func tileForeground(_ tile: NeighborVerification.Tile) -> Color {
        switch tile {
        case .primary: Theme.Color.primary600
        case .success: Theme.Color.success
        }
    }

    private func tileBackground(_ tile: NeighborVerification.Tile) -> Color {
        switch tile {
        case .primary: Theme.Color.primary50
        case .success: Theme.Color.successBg
        }
    }
}

// MARK: - Skill chips

@MainActor
struct NeighborSkillChips: View {
    let skills: [String]

    var body: some View {
        FlowLayoutNeighbor(spacing: Spacing.s1) {
            ForEach(skills, id: \.self) { skill in
                Text(skill)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
            }
        }
        .accessibilityIdentifier("publicProfileNeighborSkills")
    }
}

// MARK: - Review card

@MainActor
struct NeighborReviewCard: View {
    let card: ProfileReviewCard

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                NeighborAvatar(initials: NeighborHero.initials(from: card.reviewerName), size: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text(card.reviewerName)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(card.timestamp)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                HStack(spacing: 2) {
                    ForEach(0..<5) { idx in
                        Icon(.star, size: 12, color: idx < card.rating ? Theme.Color.warning : Theme.Color.appTextMuted)
                    }
                }
            }
            if !card.body.isEmpty {
                Text(card.body)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineSpacing(3)
                    .padding(.leading, Spacing.s2)
                    .overlay(alignment: .leading) {
                        Rectangle().fill(Theme.Color.primary200).frame(width: 2)
                    }
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(card.reviewerName), \(card.rating) star review, \(card.timestamp)")
    }
}

// MARK: - Reviews empty card

@MainActor
struct NeighborReviewsEmptyCard: View {
    let name: String

    var body: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.sparkles, size: 22, color: Theme.Color.primary600)
                .frame(width: 48, height: 48)
                .background(Theme.Color.primary50)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            Text("No reviews yet")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("\(firstName) verified recently. Reviews show up after the first hire, recommendation, or marketplace deal.")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s5)
        .padding(.horizontal, Spacing.s4)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("publicProfileNeighborReviewsEmpty")
    }

    private var firstName: String {
        name.split(separator: " ").first.map(String.init) ?? name
    }
}

// MARK: - Mutual neighbors strip

@MainActor
struct NeighborMutualsStrip: View {
    let mutuals: NeighborMutuals

    var body: some View {
        HStack(spacing: Spacing.s3) {
            HStack(spacing: -8) {
                ForEach(Array(mutuals.initials.prefix(4).enumerated()), id: \.offset) { _, initials in
                    NeighborAvatar(initials: initials, size: 28)
                        .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                }
            }
            VStack(alignment: .leading, spacing: 1) {
                Text("\(mutuals.count) mutual \(mutuals.count == 1 ? "neighbor" : "neighbors")")
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(mutuals.names)
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s0)
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(mutuals.count) mutual neighbors: \(mutuals.names)")
        .accessibilityIdentifier("publicProfileNeighborMutuals")
    }
}

// MARK: - Welcome prompt

@MainActor
struct NeighborWelcomeCard: View {
    let welcome: NeighborWelcome

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            Icon(.hand, size: 16, color: Theme.Color.appTextInverse)
                .frame(width: 32, height: 32)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(welcome.title)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.primary700)
                Text(welcome.body)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineSpacing(2)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.primary50)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.primary200, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("publicProfileNeighborWelcome")
    }
}

// MARK: - Report / block row

@MainActor
struct NeighborReportBlockRow: View {
    let onReport: @MainActor () -> Void
    let onBlock: @MainActor () -> Void

    var body: some View {
        HStack(spacing: Spacing.s5) {
            Button(action: onReport) {
                HStack(spacing: Spacing.s1) {
                    Icon(.flag, size: 11, color: Theme.Color.appTextMuted)
                    Text("Report")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("publicProfileNeighborReport")
            Button(action: onBlock) {
                HStack(spacing: Spacing.s1) {
                    Icon(.ban, size: 11, color: Theme.Color.appTextMuted)
                    Text("Block")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("publicProfileNeighborBlock")
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Sticky action bar

@MainActor
struct NeighborActionBar: View {
    let primaryLabel: String
    let connectState: PublicProfileActionState
    /// Existing viewer↔profile edge. `blocked` hides the Connect button
    /// entirely (RN drops the whole action row), `pending_sent` renders it
    /// inert, and the rest each get their own label.
    var connection: ProfileConnection = .none
    let onMessage: @MainActor () -> Void
    let onConnect: @MainActor () -> Void

    /// Tapping is inert while a request is outstanding or in flight —
    /// RN's `disabled={actionLoading || connectionState === 'pending_sent'}`.
    private var isConnectDisabled: Bool {
        connectState == .inFlight || !connection.isActionable
    }

    private var connectIcon: PantopusIcon {
        switch connection {
        case .connected: .check
        case .pendingSent: .clock
        default: .userPlus
        }
    }

    var body: some View {
        HStack(spacing: Spacing.s2) {
            if connection != .blocked {
                connectButton
            }

            Button(action: onMessage) {
                HStack(spacing: Spacing.s1) {
                    Icon(.messageCircle, size: 16, color: Theme.Color.appTextInverse)
                    Text(primaryLabel)
                        .font(.system(size: PantopusTextStyle.small.size, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .pantopusShadow(.primary)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("publicProfileMessageCta")
            .accessibilityLabel(primaryLabel)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s5)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface.opacity(0.98))
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    private var connectButton: some View {
        Button(action: onConnect) {
            HStack(spacing: Spacing.s1) {
                Icon(connectIcon, size: 16, color: Theme.Color.appText)
                Text(connection.label)
                    .font(.system(size: PantopusTextStyle.small.size, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(isConnectDisabled)
        .opacity(isConnectDisabled ? 0.7 : 1)
        .accessibilityIdentifier("publicProfileConnectCta")
        .accessibilityLabel(connection.accessibilityLabel)
    }
}

// MARK: - Flow layout

/// Minimal wrapping flow layout for the skill chip row.
private struct FlowLayoutNeighbor: Layout {
    let spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let width = proposal.width ?? 0
        var x: CGFloat = 0
        var rowHeight: CGFloat = 0
        var total: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > width {
                total += rowHeight + spacing
                x = size.width + spacing
                rowHeight = size.height
            } else {
                x += size.width + spacing
                rowHeight = max(rowHeight, size.height)
            }
        }
        total += rowHeight
        return CGSize(width: width, height: total)
    }

    func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
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
