//
//  PublicProfileChrome.swift
//  Pantopus
//
//  P6.5 — Persona vs Local chrome components for the Public Profile
//  screen. Lives in the Profile feature folder because the components
//  are screen-private (no other surface reuses them today). Includes:
//
//  - `PublicProfileBanner`: flat 100pt banner tinted per kind.
//  - `PublicProfileBroadcastCard`: persona broadcast with the visibility
//    chip and the optional "Subscribe to unlock" paywall overlay.
//  - `PublicProfileLocalPostCard`: Pulse-style neighborhood post with
//    the optional intent chip.
//
//  All colors come from the token set — never raw hex.
//

// swiftlint:disable file_length

import SwiftUI

// MARK: - Banner

/// Kind-tinted hero band above the identity block. P8.6 adopts the
/// shared `BeaconBanner` primitive (120pt identity-tinted gradient with
/// the signature diagonal stripes) for the A21 public Beacon profiles:
/// Persona → `.personal` (sky), Local → `.home` (green).
@MainActor
struct PublicProfileBanner: View {
    let kind: PublicProfileKind

    var body: some View {
        BeaconBanner(identity: bannerIdentity) { EmptyView() }
            .accessibilityIdentifier(
                kind == .persona
                    ? "publicProfilePersonaBanner"
                    : "publicProfileLocalBanner"
            )
    }

    private var bannerIdentity: BeaconIdentity {
        switch kind {
        case .persona: .personal
        case .local: .home
        }
    }
}

// MARK: - Persona broadcast card

/// Persona-broadcast card surface with visibility chip + locked-paywall
/// overlay. The card mirrors the design's `BroadcastCard`: meta row
/// (timeAgo + visibility), body, optional reactions/replies footer. When
/// `post.isLocked` is true, the body is suppressed visually and an
/// overlay invites the visitor to subscribe to the gating tier.
@MainActor
struct PublicProfileBroadcastCard: View {
    let post: PublicProfilePost
    let onUnlock: @MainActor () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            metaRow
            if post.isLocked {
                lockedContent
            } else {
                Text(post.body)
                    .font(.system(size: PantopusTextStyle.small.size))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
                reactionsRow
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("publicProfileBroadcastCard_\(post.id)")
        .accessibilityLabel(accessibilitySummary)
    }

    private var metaRow: some View {
        HStack(spacing: Spacing.s2) {
            Text(post.timeAgo)
                .font(.system(size: PantopusTextStyle.caption.size))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Text("·")
                .font(.system(size: PantopusTextStyle.caption.size))
                .foregroundStyle(Theme.Color.appTextMuted)
            if let visibility = post.visibility {
                VisibilityChip(visibility: visibility)
            }
            Spacer(minLength: Spacing.s0)
        }
    }

    private var reactionsRow: some View {
        HStack(spacing: Spacing.s3) {
            HStack(spacing: Spacing.s1) {
                Icon(.heart, size: 13, color: Theme.Color.appTextSecondary)
                Text("\(post.reactions)")
                    .font(.system(size: PantopusTextStyle.caption.size))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            HStack(spacing: Spacing.s1) {
                Icon(.messageCircle, size: 13, color: Theme.Color.appTextSecondary)
                Text("\(post.replies)")
                    .font(.system(size: PantopusTextStyle.caption.size))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
            Icon(.bookmark, size: 13, color: Theme.Color.appTextSecondary)
        }
        .padding(.top, Spacing.s1)
    }

    /// Locked broadcast body — paywall surface that swaps out the body
    /// text + reactions row for a tinted "Subscribe to unlock" CTA.
    private var lockedContent: some View {
        VStack(spacing: Spacing.s2) {
            ZStack {
                Circle()
                    .fill(Theme.Color.warningBg)
                    .frame(width: 40, height: 40)
                Icon(.lock, size: 18, color: Theme.Color.warning)
            }
            Text("Subscribe to \(unlockTierLabel) to unlock")
                .font(.system(size: PantopusTextStyle.small.size, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Button(action: onUnlock) {
                Text("Subscribe to unlock")
                    .font(.system(size: PantopusTextStyle.caption.size, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s4)
                    .frame(minHeight: 32)
                    .background(Theme.Color.warning)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("publicProfileBroadcastUnlock_\(post.id)")
            .accessibilityLabel("Subscribe to unlock \(unlockTierLabel) broadcast")
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s3)
        .padding(.horizontal, Spacing.s4)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var unlockTierLabel: String {
        switch post.visibility ?? .bronze {
        case .free: "Free"
        case .bronze: "Bronze"
        case .silver: "Silver"
        case .gold: "Gold"
        }
    }

    private var accessibilitySummary: String {
        let visibilityPart = post.visibility.map { " (\($0.rawValue))" } ?? ""
        if post.isLocked {
            return "Locked broadcast\(visibilityPart). \(post.timeAgo). Subscribe to unlock."
        }
        return "Broadcast\(visibilityPart). \(post.body). \(post.timeAgo). \(post.reactions) reactions, \(post.replies) replies."
    }
}

@MainActor
private struct VisibilityChip: View {
    let visibility: PublicProfilePost.Visibility

    var body: some View {
        HStack(spacing: 3) {
            Icon(icon, size: 10, color: foreground)
            Text(label)
                .font(.system(size: 10, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(foreground)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 2)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }

    private var label: String {
        switch visibility {
        case .free: "FREE"
        case .bronze: "BRONZE+"
        case .silver: "SILVER+"
        case .gold: "GOLD+"
        }
    }

    private var icon: PantopusIcon {
        switch visibility {
        case .free: .globe
        default: .lock
        }
    }

    private var foreground: Color {
        switch visibility {
        case .free: Theme.Color.success
        default: Theme.Color.warning
        }
    }

    private var background: Color {
        switch visibility {
        case .free: Theme.Color.successBg
        default: Theme.Color.warningBg
        }
    }
}

// MARK: - Local Pulse-style post card

/// Local-post card surface — Pulse styling without tier chips or
/// paywall. Renders meta row (timeAgo · locality · intent chip), body,
/// reactions/replies/share row.
@MainActor
struct PublicProfileLocalPostCard: View {
    let post: PublicProfilePost

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            metaRow
            Text(post.body)
                .font(.system(size: PantopusTextStyle.small.size))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(3)
                .multilineTextAlignment(.leading)
            reactionsRow
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("publicProfileLocalPostCard_\(post.id)")
        .accessibilityLabel(accessibilitySummary)
    }

    private var metaRow: some View {
        HStack(spacing: Spacing.s2) {
            Text(post.timeAgo)
                .font(.system(size: PantopusTextStyle.caption.size))
                .foregroundStyle(Theme.Color.appTextSecondary)
            if let locality = post.locality, !locality.isEmpty {
                Text("·")
                    .font(.system(size: PantopusTextStyle.caption.size))
                    .foregroundStyle(Theme.Color.appTextMuted)
                HStack(spacing: 3) {
                    Icon(.mapPin, size: 11, color: Theme.Color.appTextSecondary)
                    Text(locality)
                        .font(.system(size: PantopusTextStyle.caption.size))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer(minLength: Spacing.s0)
            if let intent = post.intent {
                IntentChip(intent: intent)
            }
        }
    }

    private var reactionsRow: some View {
        HStack(spacing: Spacing.s3) {
            HStack(spacing: Spacing.s1) {
                Icon(.lightbulb, size: 13, color: Theme.Color.appTextSecondary)
                Text("\(post.reactions)")
                    .font(.system(size: PantopusTextStyle.caption.size))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            HStack(spacing: Spacing.s1) {
                Icon(.messageCircle, size: 13, color: Theme.Color.appTextSecondary)
                Text("\(post.replies)")
                    .font(.system(size: PantopusTextStyle.caption.size))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
            Icon(.share, size: 13, color: Theme.Color.appTextSecondary)
        }
        .padding(.top, Spacing.s1)
    }

    private var accessibilitySummary: String {
        let intentPart = post.intent.map { " \($0.rawValue) post." } ?? " Post."
        let localityPart = post.locality.map { " in \($0)." } ?? ""
        return "\(intentPart)\(localityPart) \(post.body). \(post.timeAgo). \(post.reactions) reactions, \(post.replies) replies."
    }
}

@MainActor
private struct IntentChip: View {
    let intent: PublicProfilePost.Intent

    var body: some View {
        HStack(spacing: 3) {
            Icon(icon, size: 10, color: foreground)
            Text(label)
                .font(.system(size: 10, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(foreground)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 2)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }

    private var label: String {
        switch intent {
        case .offer: "OFFER"
        case .alert: "ALERT"
        case .event: "EVENT"
        case .ask: "ASK"
        }
    }

    private var icon: PantopusIcon {
        switch intent {
        case .offer: .hand
        case .alert: .alertTriangle
        case .event: .calendar
        case .ask: .helpCircle
        }
    }

    private var foreground: Color {
        switch intent {
        case .offer: Theme.Color.home
        case .alert: Theme.Color.warning
        case .event: Theme.Color.personal
        case .ask: Theme.Color.primary700
        }
    }

    private var background: Color {
        switch intent {
        case .offer: Theme.Color.homeBg
        case .alert: Theme.Color.warningBg
        case .event: Theme.Color.personalBg
        case .ask: Theme.Color.primary50
        }
    }
}

// MARK: - Posts feed wrapper

/// Container that renders either persona broadcasts or local posts
/// beneath the identity block. P8.6 swaps the previous single-line empty
/// caption for the full `EmptyState` card the design pins: a 72pt
/// identity-tinted disc + icon + headline + body + a primary CTA wired
/// to the kind's first-touch action (Follow for personas, Send a message
/// for locals).
@MainActor
struct PublicProfilePostsFeed: View {
    let kind: PublicProfileKind
    let posts: [PublicProfilePost]
    let onUnlock: @MainActor (PublicProfilePost) -> Void
    /// Kind-appropriate first-touch action behind the empty-state CTA —
    /// the host wires this to `follow()` (persona) or open-messages
    /// (local). Defaults to a no-op so previews / tests can opt out.
    var onEmptyCTA: @MainActor () -> Void = {}
    /// A21.2 — the profile owner's display name, so the Local empty state
    /// can name the neighbour ("… — Priya just moved in."). `nil` falls
    /// back to the un-personalised copy.
    var localName: String?

    var body: some View {
        if posts.isEmpty {
            emptyState
                .padding(.horizontal, Spacing.s4)
        } else {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Text(headerLabel)
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(0.6)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .textCase(.uppercase)
                    .accessibilityAddTraits(.isHeader)

                ForEach(posts) { post in
                    switch kind {
                    case .persona:
                        PublicProfileBroadcastCard(post: post) {
                            onUnlock(post)
                        }
                    case .local:
                        PublicProfileLocalPostCard(post: post)
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
    }

    // MARK: Empty state

    private var emptyState: some View {
        VStack(spacing: Spacing.s0) {
            ZStack {
                Circle()
                    .fill(emptyDiscColor)
                    .frame(width: 72, height: 72)
                Icon(emptyIcon, size: 32, strokeWidth: 1.6, color: emptyAccentColor)
            }
            .padding(.bottom, 18)

            Text(emptyHeadline)
                .font(.system(size: 17, weight: .bold))
                .tracking(-0.2)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)

            Text(emptyBody)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(2)
                .frame(maxWidth: 260)
                .padding(.top, Spacing.s2)

            Button(action: onEmptyCTA) {
                HStack(spacing: 6) {
                    Icon(emptyCTAIcon, size: 14, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                    Text(emptyCTALabel)
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s4)
                .frame(height: 40)
                .background(emptyAccentColor)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(.top, Spacing.s4)
            .accessibilityLabel(emptyCTALabel)
            .accessibilityIdentifier("publicProfilePostsEmptyCTA")
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s12)
        .padding(.bottom, Spacing.s5)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("publicProfilePostsEmpty")
    }

    private var headerLabel: String {
        kind == .persona ? "Recent broadcasts" : "Recent posts"
    }

    // MARK: Empty-state palette + copy (per kind)

    private var emptyDiscColor: Color {
        kind == .persona ? Theme.Color.primary50 : Theme.Color.homeBg
    }

    private var emptyAccentColor: Color {
        kind == .persona ? Theme.Color.primary600 : Theme.Color.home
    }

    private var emptyIcon: PantopusIcon {
        kind == .persona ? .radioTower : .home
    }

    private var emptyHeadline: String {
        kind == .persona ? "No broadcasts yet" : "Quiet for now"
    }

    /// A21.2 names the neighbour when we know them ("No posts yet — Priya
    /// just moved in. …"); without a name we fall back to the neutral
    /// sentence rather than printing an empty gap.
    private var emptyBody: String {
        if kind == .persona {
            return "Be the first to follow — you'll get a ping the moment they go live."
        }
        guard let first = Self.firstName(localName) else {
            return "No posts yet — say hi or send a message to break the ice."
        }
        return "No posts yet — \(first) just moved in. Say hi or send a message to break the ice."
    }

    /// First word of a display name, or `nil` when there isn't one.
    static func firstName(_ name: String?) -> String? {
        guard let name else { return nil }
        let first = name.split(separator: " ").first.map(String.init) ?? name
        return first.isEmpty ? nil : first
    }

    private var emptyCTALabel: String {
        kind == .persona ? "Follow" : "Send a message"
    }

    private var emptyCTAIcon: PantopusIcon {
        kind == .persona ? .plus : .messageSquare
    }
}

// MARK: - A21.2 Local tab strip

/// Underline-active tab strip for the Local Beacon profile archetype
/// (Posts · About · Portfolio · Gigs · Reviews). Mirrors the design's
/// `TabStrip` — and the persona `BeaconProfileTabStrip` — so both
/// archetypes read identically. Scrolls horizontally so the marketplace
/// tabs survive the larger dynamic-type sizes.
@MainActor
struct LocalProfileTabStrip: View {
    let postCount: Int?
    /// Server-side review total, badged on the Reviews tab the way
    /// `postCount` badges Posts. `nil` hides the badge.
    var reviewCount: Int?
    let selected: LocalProfileTab
    let onSelect: @MainActor (LocalProfileTab) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s6) {
                ForEach(LocalProfileTab.allCases) { tab in
                    let isActive = tab == selected
                    Button {
                        onSelect(tab)
                    } label: {
                        VStack(spacing: Spacing.s2) {
                            HStack(spacing: Spacing.s1) {
                                Text(tab.label)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(isActive ? Theme.Color.primary700 : Theme.Color.appTextSecondary)
                                if let count = badgeCount(for: tab) {
                                    Text("\(count)")
                                        .font(.system(size: 10.5))
                                        .foregroundStyle(Theme.Color.appTextMuted)
                                }
                            }
                            Rectangle()
                                .fill(isActive ? Theme.Color.primary600 : Color.clear)
                                .frame(height: 2)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("publicProfileLocalTab_\(tab.rawValue)")
                    .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
                }
                Spacer(minLength: Spacing.s0)
            }
        }
        .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(height: 1)
        }
        .accessibilityIdentifier("publicProfileLocalTabStrip")
    }

    private func badgeCount(for tab: LocalProfileTab) -> Int? {
        switch tab {
        case .posts: postCount
        case .reviews: reviewCount
        default: nil
        }
    }
}

// MARK: - A21.2 Local About tab

/// About tab of the Local Beacon profile. Carries the neighbourhood
/// substance the older four-tab neighbour layout spread across
/// About / Reviews / Verifications, so nothing is lost when the designed
/// two-tab archetype takes over.
@MainActor
struct LocalProfileAboutSection: View {
    let content: NeighborProfileContent

    var body: some View {
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

            reviews

            if let mutuals = content.mutuals {
                NeighborSectionTitle("Neighbors in common")
                NeighborMutualsStrip(mutuals: mutuals)
            }

            if let welcome = content.welcome {
                NeighborWelcomeCard(welcome: welcome)
                    .padding(.top, Spacing.s3)
            }
        }
        .padding(.bottom, Spacing.s5)
        .accessibilityIdentifier("publicProfileLocalAbout")
    }

    @ViewBuilder private var reviews: some View {
        if content.reviews.isEmpty {
            NeighborSectionTitle("Reviews")
            NeighborReviewsEmptyCard(name: content.hero.name)
        } else {
            NeighborSectionTitle("Reviews", action: "\(content.reviewCount)")
            VStack(alignment: .leading, spacing: Spacing.s3) {
                ForEach(content.reviews) { NeighborReviewCard(card: $0) }
            }
        }
    }
}
