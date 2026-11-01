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
            // The card's text chrome is one combined element — the media
            // grid deliberately is NOT inside it. `.combine` flattens its
            // subtree into a single a11y element, which would swallow the
            // tiles' own "Live Photo" / "Photo" labels and collapse the
            // grid into one frame, taking the long-press-to-play gesture
            // and the tap that presents `MediaViewerView` with it.
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
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel(accessibilitySummary)

            // Same grid the Pulse card renders (`PulsePostCard.swift:222`),
            // so a `live_photo` slot keeps its yellow LIVE dot, long-press
            // playback, and the viewer's LIVE replay pill. No paywall guard
            // here on purpose: a locked broadcast projects to empty media in
            // `BeaconProfileViewModel.project`, which is the one place that
            // decision belongs.
            if !post.media.isEmpty {
                PostMediaGridView(
                    items: post.media,
                    style: .compact,
                    accessibilityID: "beaconBroadcastMedia_\(post.id)"
                )
            }

            if !post.isLocked {
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
        .accessibilityElement(children: .contain)
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
        // The counts are already spoken by `accessibilitySummary`; before
        // the media grid moved out of the combined element this row was
        // folded into that same label, so hiding it keeps VoiceOver from
        // re-reading the bare "8" / "14" as standalone elements.
        .accessibilityHidden(true)
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
                    .background(Theme.Color.warningSolid)
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
            // Combine narrowed to the text chrome for the same reason as
            // `PublicProfileBroadcastCard` — the grid below has to keep its
            // own a11y elements and its own long-press / tap gestures.
            VStack(alignment: .leading, spacing: Spacing.s2) {
                metaRow
                Text(post.body)
                    .font(.system(size: PantopusTextStyle.small.size))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel(accessibilitySummary)

            if !post.media.isEmpty {
                PostMediaGridView(
                    items: post.media,
                    style: .compact,
                    accessibilityID: "beaconLocalPostMedia_\(post.id)"
                )
            }

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
        .accessibilityElement(children: .contain)
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
        // Counts already ride `accessibilitySummary` — see the broadcast
        // card's reactions row.
        .accessibilityHidden(true)
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
/// for locals). When the Local posts couldn't load, the same card says so
/// and offers Try again.
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
    /// can name the neighbour ("No posts yet from Priya. …"). `nil` falls
    /// back to the un-personalised copy.
    var localName: String?
    /// `true` when the posts couldn't load: the card says so and offers
    /// Try again instead of presenting the feed as empty.
    var loadFailed = false
    var onRetry: @MainActor () -> Void = {}
    /// `true` when the viewer blocked this neighbour: a block hides both
    /// people's posts, so the card says so and invites nothing.
    var hiddenByBlock = false
    /// Your own profile: the empty state offers no "Say hi" (nobody
    /// messages themselves).
    var isOwnProfile = false
    /// Joined in the last 14 days: an empty list says "<name> just joined".
    var joinedRecently = false
    /// The first read of the posts is still out: skeleton cards, not "No posts yet".
    var isLoading = false
    /// Your own profile shows only your latest few, then "See all".
    var maxCards: Int?
    /// The Local profile's posts as Pulse cards (photos, video, links,
    /// Helpful, Save, Repost, the post menu). Nil keeps the plain cards.
    var pulseCards: ProfilePostCardsModel?
    /// Opens a card's post page, as a tap on a Pulse card does.
    var onOpenPost: @MainActor (String) -> Void = { _ in }

    var body: some View {
        if kind == .local, isLoading, isEmpty, !hiddenByBlock {
            VStack(spacing: Spacing.s3) {
                FeedSkeletonCard(withTitle: true)
                FeedSkeletonCard()
            }
            .padding(.horizontal, Spacing.s5)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Loading posts")
            .accessibilityIdentifier("publicProfilePostsLoading")
        } else if kind == .local, hiddenByBlock || isEmpty {
            localEmptyCard
                .padding(.horizontal, Spacing.s5)
        } else if hiddenByBlock || isEmpty {
            emptyState
                .padding(.horizontal, Spacing.s4)
        } else if kind == .local, let pulseCards {
            pulseFeed(pulseCards)
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

    private var isEmpty: Bool {
        if kind == .local, let pulseCards { return pulseCards.cards.isEmpty }
        return posts.isEmpty
    }

    /// Full-width rows as in Pulse: the same card, its controls, and the
    /// same post page behind a tap.
    private func pulseFeed(_ model: ProfilePostCardsModel) -> some View {
        // The Posts tab above names the list, so no "Recent posts" label.
        VStack(alignment: .leading, spacing: Spacing.s0) {
            LazyVStack(spacing: Spacing.s0) {
                ForEach(Array(model.cards.prefix(maxCards ?? model.cards.count))) { card in
                    pulseCard(card, model: model)
                }
            }
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(Theme.Color.appBorderSubtle)
                    .frame(height: 1)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("publicProfilePulsePosts")
    }

    /// One post with the controls the Pulse feed gives it.
    private func pulseCard(_ card: PulsePostCardContent, model: ProfilePostCardsModel) -> PulsePostCard {
        let postId = card.id
        let react: @MainActor () -> Void = { Task { await model.tapReaction(postId: postId) } }
        let save: @MainActor () -> Void = { Task { await model.toggleSave(postId: postId) } }
        let repost: @MainActor () -> Void = { Task { await model.toggleRepost(postId: postId) } }
        let rsvp: (@MainActor () -> Void)? = card.attendees == nil ? nil : react
        var options: (@MainActor () -> Void)?
        if model.hasOptions(card) {
            options = { model.overflowPostId = postId }
        }
        let open = onOpenPost
        return PulsePostCard(
            content: card,
            onTap: { open(postId) },
            onPrimaryReaction: react,
            onRSVP: rsvp,
            onOverflow: options,
            onToggleSave: save,
            onToggleRepost: repost
        )
    }

    // MARK: Empty state

    /// A person's empty or unavailable posts (`NewNeighbor.dc.html`): a card
    /// that says why, with "Say hi" when a hello is the useful next step.
    private var localEmptyCard: some View {
        VStack(spacing: Spacing.s0) {
            ZStack {
                Circle()
                    .fill(localTone.disc)
                    .frame(width: 56, height: 56)
                Icon(localTone.icon, size: 26, color: localTone.accent)
            }
            .accessibilityHidden(true)
            Text(localHeadline)
                .scaledFont(17, weight: .semibold)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
                .accessibilityAddTraits(.isHeader)
            Text(localBody)
                .scaledFont(15)
                .foregroundStyle(Theme.Color.appTextMuted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 300)
                .padding(.top, 6)
            if let cta = localCTA {
                Button(action: cta.action) {
                    HStack(spacing: Spacing.s2) {
                        Icon(cta.icon, size: 17, strokeWidth: 2.25, color: Theme.Color.appText)
                        Text(cta.title)
                            .scaledFont(16, weight: .semibold)
                            .foregroundStyle(Theme.Color.appText)
                    }
                    .padding(.horizontal, Spacing.s5)
                    .frame(minHeight: 44)
                    .overlay(Capsule().strokeBorder(Theme.Color.appBorderStrong, lineWidth: 1))
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .padding(.top, 18)
                .accessibilityIdentifier(loadFailed ? "publicProfilePostsRetry" : "publicProfilePostsEmptyCTA")
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .padding(.horizontal, Spacing.s6)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(emptyStateIdentifier)
    }

    /// The empty card's disc color, glyph color and glyph.
    private struct EmptyTone {
        let disc: Color
        let accent: Color
        let icon: PantopusIcon
    }

    /// The empty card's button.
    private struct EmptyAction {
        let title: String
        let icon: PantopusIcon
        let action: @MainActor () -> Void
    }

    private var localTone: EmptyTone {
        if loadFailed { return EmptyTone(disc: Theme.Color.appSurfaceSunken, accent: Theme.Color.appTextSecondary, icon: .alertCircle) }
        if showsHiddenByBlock { return EmptyTone(disc: Theme.Color.appSurfaceSunken, accent: Theme.Color.appTextSecondary, icon: .eyeOff) }
        return EmptyTone(disc: Theme.Color.homeBg, accent: Theme.Color.home, icon: isOwnProfile ? .pencil : .hand)
    }

    private var localHeadline: String {
        if loadFailed { return "Couldn't load posts" }
        if showsHiddenByBlock { return "Posts hidden" }
        if isOwnProfile { return "You haven't posted yet" }
        if joinedRecently, let first = Self.firstName(localName) { return "\(first) just joined" }
        return "No posts yet"
    }

    private var localBody: String {
        let first = Self.firstName(localName)
        if loadFailed { return "Check your connection and try again." }
        if showsHiddenByBlock {
            return "You blocked \(first ?? "this person"). Neither of you sees the other's posts while the block is on."
        }
        if isOwnProfile { return "Your posts show up here, the way neighbors see them." }
        if joinedRecently { return "No posts yet. A quick hello goes a long way." }
        return "\(first ?? "They") hasn't posted yet. A quick hello goes a long way."
    }

    /// Try again after a failed read; Say hi otherwise, except on your own
    /// profile and for someone you blocked.
    private var localCTA: EmptyAction? {
        if loadFailed { return EmptyAction(title: "Try again", icon: .refreshCw, action: onRetry) }
        if showsHiddenByBlock || isOwnProfile { return nil }
        return EmptyAction(title: "Say hi", icon: .messageSquare, action: onEmptyCTA)
    }

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

            if !showsHiddenByBlock {
                emptyCTAButton
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s12)
        .padding(.bottom, Spacing.s5)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(emptyStateIdentifier)
    }

    private var emptyCTAButton: some View {
        Button(action: loadFailed ? onRetry : onEmptyCTA) {
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
        .accessibilityIdentifier(loadFailed ? "publicProfilePostsRetry" : "publicProfilePostsEmptyCTA")
    }

    /// A Local profile the viewer blocked (a failed load still says so first).
    private var showsHiddenByBlock: Bool {
        hiddenByBlock && !loadFailed && kind == .local
    }

    private var emptyStateIdentifier: String {
        if loadFailed { return "publicProfilePostsFailed" }
        return showsHiddenByBlock ? "publicProfilePostsHidden" : "publicProfilePostsEmpty"
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
        if loadFailed { return .alertCircle }
        if showsHiddenByBlock { return .eyeOff }
        return kind == .persona ? .radioTower : .home
    }

    private var emptyHeadline: String {
        if loadFailed { return "Couldn't load posts" }
        if showsHiddenByBlock { return "Posts hidden" }
        return kind == .persona ? "No broadcasts yet" : "Quiet for now"
    }

    /// A21.2 names the neighbour when we know them ("No posts yet from
    /// Priya. …"); without a name we fall back to the neutral sentence
    /// rather than printing an empty gap. Nothing says when they moved in:
    /// the profile doesn't know.
    private var emptyBody: String {
        if loadFailed {
            return "Check your connection and try again."
        }
        if kind == .persona {
            return "Be the first to follow — you'll get a ping the moment they go live."
        }
        if showsHiddenByBlock {
            return "You blocked \(Self.firstName(localName) ?? "this person"). "
                + "Neither of you sees the other's posts while the block is on."
        }
        guard let first = Self.firstName(localName) else {
            return "No posts yet — say hi or send a message to break the ice."
        }
        return "No posts yet from \(first). Say hi or send a message to break the ice."
    }

    /// First word of a display name, or `nil` when there isn't one.
    static func firstName(_ name: String?) -> String? {
        guard let name else { return nil }
        let first = name.split(separator: " ").first.map(String.init) ?? name
        return first.isEmpty ? nil : first
    }

    private var emptyCTALabel: String {
        if loadFailed { return "Try again" }
        return kind == .persona ? "Follow" : "Send a message"
    }

    private var emptyCTAIcon: PantopusIcon {
        if loadFailed { return .refreshCw }
        return kind == .persona ? .plus : .messageSquare
    }
}

// MARK: - Profile tab strip

/// Posts | About (| Work) under a person's header (`Main.dc.html`): 44 pt
/// tabs with the post count beside Posts and a 2 pt line under the chosen
/// one. Scrolls sideways when the larger text sizes need the room.
@MainActor
struct LocalProfileTabStrip: View {
    let tabs: [LocalProfileTab]
    /// The posts shown, beside Posts; nil leaves it off.
    let postCount: Int?
    let selected: LocalProfileTab
    let onSelect: @MainActor (LocalProfileTab) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 28) {
                ForEach(tabs) { tab in
                    tabButton(tab, isActive: tab == selected)
                }
            }
        }
        .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
        .background(alignment: .bottom) {
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(height: 1)
        }
        .accessibilityIdentifier("publicProfileLocalTabStrip")
    }

    private func tabButton(_ tab: LocalProfileTab, isActive: Bool) -> some View {
        let count = tab == .posts ? postCount.map(Self.countLabel) : nil
        return Button {
            onSelect(tab)
        } label: {
            HStack(spacing: 6) {
                Text(tab.label)
                    .scaledFont(16, weight: .semibold)
                    .foregroundStyle(isActive ? Theme.Color.appText : Theme.Color.appTextMuted)
                if let count {
                    Text(count)
                        .scaledFont(16, weight: .medium)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            .padding(.vertical, Spacing.s2)
            .frame(minHeight: 44)
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(isActive ? Theme.Color.primaryInk : Color.clear)
                    .frame(height: 2)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(count.map { "\(tab.label), \($0)" } ?? tab.label)
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("publicProfileLocalTab_\(tab.rawValue)")
    }

    /// The person's posts read stops at 50, so a full page says "50+".
    private static func countLabel(_ count: Int) -> String {
        count >= 50 ? "50+" : "\(count)"
    }
}
