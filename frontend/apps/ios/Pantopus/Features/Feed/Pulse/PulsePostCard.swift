//
//  PulsePostCard.swift
//  Pantopus
//
//  One row in the Pulse vertical feed. Header (avatar + meta + intent
//  chip), optional title (Event only), body clamped to 3 lines (2 with
//  a title), intent-shaped reaction strip, optional Event attendee row
//  with RSVP chip. Pure-render view — all state lives upstream.
//

import SwiftUI

// swiftlint:disable file_length

/// Which overflow actions a single Pulse card offers this viewer, and
/// which of them are already applied. Mirrors RN's per-card gating in
/// `src/components/feed/PostCard.tsx:97-101, 382-397, 445-470`.
public struct PulsePostActions: Sendable, Hashable {
    /// Cold-start neighborhood fact — dismissable, never reportable.
    public let isSeeded: Bool
    public let isSaved: Bool
    public let isReposted: Bool
    public let shareCount: Int
    /// `state == "solved"` — renders the inline Solved badge.
    public let isSolved: Bool
    /// Viewer authored this post.
    public let isOwner: Bool
    /// Author-only + Ask post + not already solved.
    public let canMarkSolved: Bool
    /// Place surface only, and never on the viewer's own post.
    public let canFlagNotHelpful: Bool
    /// Author identity to mute — nil when the post has no mutable author
    /// (seeded / system cards).
    public let muteEntityType: FeedMuteEntityType?
    public let muteEntityId: String?
    /// Display name used in the mute row + its confirm copy.
    public let muteEntityName: String
    /// `post_type` fed to `POST /api/posts/mute/topic`.
    public let postType: String?
    /// Human label for the topic being muted ("Deals", "Alerts", …).
    public let topicLabel: String?

    public init(
        isSeeded: Bool = false,
        isSaved: Bool = false,
        isReposted: Bool = false,
        shareCount: Int = 0,
        isSolved: Bool = false,
        isOwner: Bool = false,
        canMarkSolved: Bool = false,
        canFlagNotHelpful: Bool = false,
        muteEntityType: FeedMuteEntityType? = nil,
        muteEntityId: String? = nil,
        muteEntityName: String = "this author",
        postType: String? = nil,
        topicLabel: String? = nil
    ) {
        self.isSeeded = isSeeded
        self.isSaved = isSaved
        self.isReposted = isReposted
        self.shareCount = shareCount
        self.isSolved = isSolved
        self.isOwner = isOwner
        self.canMarkSolved = canMarkSolved
        self.canFlagNotHelpful = canFlagNotHelpful
        self.muteEntityType = muteEntityType
        self.muteEntityId = muteEntityId
        self.muteEntityName = muteEntityName
        self.postType = postType
        self.topicLabel = topicLabel
    }

    /// Report is offered to everyone except the author (RN
    /// `PostCard.tsx:507`).
    public var canReport: Bool {
        !isOwner && !isSeeded
    }

    /// Delete is author-only (RN `PostCard.tsx:516`).
    public var canDelete: Bool {
        isOwner && !isSeeded
    }

    /// Muting needs a resolvable entity and never applies to your own post.
    public var canMuteAuthor: Bool {
        !isOwner && !isSeeded && muteEntityType != nil && muteEntityId != nil
    }

    /// Topic mute needs a concrete post type.
    public var canMuteTopic: Bool {
        !isSeeded && !(postType ?? "").isEmpty
    }
}

/// VM-prepared content for a single Pulse card.
public struct PulsePostCardContent: Sendable, Hashable, Identifiable {
    public let id: String
    public let authorName: String
    public let authorInitials: String
    public let authorVerified: Bool
    public let avatarTint: FeedAvatarTint
    public let meta: String
    public let intent: PulseIntent
    public let title: String?
    public let body: String
    public let reactions: [PulseReaction]
    public let attendees: PulseAttendeeStrip?
    public let userHasReacted: Bool
    public let media: [PostMediaItem]
    /// Number of comments — shown beside the Reply affordance.
    public let commentCount: Int
    /// Overflow-menu capability set for this viewer.
    public let actions: PulsePostActions

    /// Still-image URLs — kept for call sites (and tests) that only care
    /// about what the card displays, not the attachment kinds.
    public var mediaURLs: [URL] {
        media.map(\.url)
    }

    public init(
        id: String,
        authorName: String,
        authorInitials: String,
        authorVerified: Bool,
        avatarTint: FeedAvatarTint = .sky,
        meta: String,
        intent: PulseIntent,
        title: String?,
        body: String,
        reactions: [PulseReaction],
        attendees: PulseAttendeeStrip?,
        userHasReacted: Bool,
        media: [PostMediaItem] = [],
        commentCount: Int = 0,
        actions: PulsePostActions = PulsePostActions()
    ) {
        self.id = id
        self.authorName = authorName
        self.authorInitials = authorInitials
        self.authorVerified = authorVerified
        self.avatarTint = avatarTint
        self.meta = meta
        self.intent = intent
        self.title = title
        self.body = body
        self.reactions = reactions
        self.attendees = attendees
        self.userHasReacted = userHasReacted
        self.media = media
        self.commentCount = commentCount
        self.actions = actions
    }
}

/// Event card attendee strip — stacked avatars + going count + RSVP CTA.
public struct PulseAttendeeStrip: Sendable, Hashable {
    public let avatars: [String]
    public let goingCount: Int
    public let userIsGoing: Bool

    public init(avatars: [String], goingCount: Int, userIsGoing: Bool) {
        self.avatars = avatars
        self.goingCount = goingCount
        self.userIsGoing = userIsGoing
    }
}

/// Pulse post card — entirely render-only; tap dispatch is parent-controlled.
public struct PulsePostCard: View {
    private let content: PulsePostCardContent
    private let onTap: @MainActor () -> Void
    private let onPrimaryReaction: @MainActor () -> Void
    private let onRSVP: (@MainActor () -> Void)?
    /// Opens the card's overflow menu (save / repost / share / hide /
    /// mute / report / delete). `nil` hides the affordance.
    private let onOverflow: (@MainActor () -> Void)?
    /// Dismisses a cold-start seeded fact. `nil` hides the affordance.
    private let onDismissSeeded: (@MainActor () -> Void)?
    /// Bookmark toggle in the engagement strip. `nil` hides the affordance.
    private let onToggleSave: (@MainActor () -> Void)?
    /// Repost toggle in the engagement strip. `nil` hides the affordance.
    private let onToggleRepost: (@MainActor () -> Void)?

    public init(
        content: PulsePostCardContent,
        onTap: @escaping @MainActor () -> Void,
        onPrimaryReaction: @escaping @MainActor () -> Void,
        onRSVP: (@MainActor () -> Void)? = nil,
        onOverflow: (@MainActor () -> Void)? = nil,
        onDismissSeeded: (@MainActor () -> Void)? = nil,
        onToggleSave: (@MainActor () -> Void)? = nil,
        onToggleRepost: (@MainActor () -> Void)? = nil
    ) {
        self.content = content
        self.onTap = onTap
        self.onPrimaryReaction = onPrimaryReaction
        self.onRSVP = onRSVP
        self.onOverflow = onOverflow
        self.onDismissSeeded = onDismissSeeded
        self.onToggleSave = onToggleSave
        self.onToggleRepost = onToggleRepost
    }

    public var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                header
                if let title = content.title, !title.isEmpty {
                    Text(title)
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                }
                if !content.body.isEmpty {
                    Text(content.body)
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .lineLimit(content.title?.isEmpty == false ? 2 : 3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                if !content.media.isEmpty {
                    PostMediaGridView(
                        items: content.media,
                        style: .compact,
                        accessibilityID: "pulsePostMedia_\(content.id)"
                    )
                }
                if let attendees = content.attendees {
                    attendeeStrip(attendees)
                }
                reactionStrip
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(a11yLabel)
        .accessibilityIdentifier("pulsePostCard_\(content.id)")
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 9) {
            FeedAvatar(
                initials: content.authorInitials,
                tint: content.avatarTint,
                verified: content.authorVerified,
                size: 32
            )
            VStack(alignment: .leading, spacing: 2) {
                Text(content.authorName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Text(content.meta)
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s2)
            PulseIntentChip(intent: content.intent)
            headerTrailingControl
        }
    }

    /// Seeded facts get a dismiss "x"; every other card gets the overflow
    /// menu. RN splits the same way (`PostCard.tsx:85-88`).
    @ViewBuilder private var headerTrailingControl: some View {
        if content.actions.isSeeded {
            if let onDismissSeeded {
                Button(action: onDismissSeeded) {
                    Icon(.x, size: 15, color: Theme.Color.appTextMuted)
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Dismiss this suggestion")
                .accessibilityIdentifier("pulsePostDismissSeeded_\(content.id)")
            }
        } else if let onOverflow {
            Button(action: onOverflow) {
                Icon(.moreHorizontal, size: 16, color: Theme.Color.appTextMuted)
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Post options")
            .accessibilityIdentifier("pulsePostOverflow_\(content.id)")
        }
    }

    private func attendeeStrip(_ strip: PulseAttendeeStrip) -> some View {
        VStack(spacing: Spacing.s0) {
            Rectangle()
                .fill(Theme.Color.appBorderSubtle)
                .frame(height: 1)
                .padding(.top, Spacing.s2)
            HStack(alignment: .center, spacing: Spacing.s2) {
                HStack(spacing: -8) {
                    ForEach(Array(strip.avatars.prefix(4).enumerated()), id: \.offset) { index, initials in
                        FeedAvatar(
                            initials: initials,
                            tint: Self.attendeeTints[index % Self.attendeeTints.count],
                            size: 22
                        )
                        .overlay(
                            Circle().stroke(Theme.Color.appSurface, lineWidth: 2)
                        )
                    }
                }
                Text("+ \(strip.goingCount) going")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer(minLength: Spacing.s1)
                if let onRSVP {
                    Button(action: onRSVP) {
                        HStack(spacing: Spacing.s1) {
                            Icon(
                                strip.userIsGoing ? .check : .plusCircle,
                                size: 10,
                                strokeWidth: 3,
                                color: Theme.Color.magic
                            )
                            Text(strip.userIsGoing ? "Going" : "RSVP")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(Theme.Color.magic)
                        }
                        .padding(.horizontal, Spacing.s3)
                        .frame(height: 26)
                        .background(Theme.Color.magicBg)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(strip.userIsGoing ? "Going" : "RSVP")
                    .accessibilityIdentifier("pulseRSVP_\(content.id)")
                }
            }
            .padding(.top, Spacing.s2)
        }
    }

    private var reactionStrip: some View {
        HStack(alignment: .center, spacing: 14) {
            ForEach(content.reactions) { reaction in
                reactionPill(reaction)
            }
            if content.actions.isSolved {
                solvedBadge
            }
            Spacer()
            if let onToggleSave {
                Button(action: onToggleSave) {
                    Icon(
                        .bookmark,
                        size: 12,
                        color: content.actions.isSaved ? Theme.Color.primary600 : Theme.Color.appTextSecondary
                    )
                    .frame(width: 24, height: 24)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(content.actions.isSaved ? "Remove bookmark" : "Save post")
                .accessibilityIdentifier("pulsePostSave_\(content.id)")
            }
            if let onToggleRepost {
                Button(action: onToggleRepost) {
                    HStack(spacing: Spacing.s1) {
                        Icon(
                            .arrowsRepeat,
                            size: 12,
                            color: content.actions.isReposted ? Theme.Color.success : Theme.Color.appTextSecondary
                        )
                        if content.actions.shareCount > 0 {
                            Text("\(content.actions.shareCount)")
                                .font(.system(size: 11.5))
                                .foregroundStyle(
                                    content.actions.isReposted
                                        ? Theme.Color.success
                                        : Theme.Color.appTextSecondary
                                )
                        }
                    }
                    .frame(minWidth: 24, minHeight: 24)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(content.actions.isReposted ? "Undo repost" : "Repost")
                .accessibilityIdentifier("pulsePostRepost_\(content.id)")
            }
            HStack(spacing: Spacing.s1) {
                Icon(.messageCircle, size: 12, color: Theme.Color.appTextSecondary)
                Text(content.commentCount > 0 ? "Reply \(content.commentCount)" : "Reply")
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .accessibilityElement()
            .accessibilityLabel(
                content.commentCount > 0
                    ? "Reply. \(content.commentCount) comments"
                    : "Reply"
            )
        }
        .padding(.top, Spacing.s2)
    }

    /// Inline "Solved" pill — RN renders the same badge once
    /// `state === 'solved'` (`PostCard.tsx:474-479`).
    private var solvedBadge: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.checkCircle, size: 11, strokeWidth: 2.4, color: Theme.Color.success)
            Text("Solved")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.success)
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 22)
        .background(Theme.Color.successLight)
        .clipShape(Capsule())
        .accessibilityElement()
        .accessibilityLabel("Solved")
        .accessibilityIdentifier("pulsePostSolvedBadge_\(content.id)")
    }

    /// Cycling tint palette for the Event attendee mini-avatars (decorative;
    /// the live feed has no per-attendee identity, fixtures echo the design).
    private static let attendeeTints: [FeedAvatarTint] = [.orange, .sky, .violet, .green]

    @ViewBuilder
    private func reactionPill(_ reaction: PulseReaction) -> some View {
        let active = reaction.kind == content.reactions.first?.kind && content.userHasReacted
        if reaction.isInteractive {
            Button(action: onPrimaryReaction) { reactionLabel(reaction, active: active) }
                .buttonStyle(.plain)
                .accessibilityLabel("\(reaction.label.isEmpty ? "React" : reaction.label), \(reaction.count)")
                .accessibilityIdentifier("pulseReaction_\(content.id)_\(reaction.id.rawValue)")
        } else {
            reactionLabel(reaction, active: false)
                .accessibilityElement()
                .accessibilityLabel("\(reaction.label.isEmpty ? "Count" : reaction.label), \(reaction.count)")
        }
    }

    private func reactionLabel(_ reaction: PulseReaction, active: Bool) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(reaction.icon, size: 12, color: active ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
            HStack(spacing: 3) {
                if !reaction.label.isEmpty {
                    Text(reaction.label)
                        .font(.system(size: 11.5, weight: .medium))
                        .foregroundStyle(active ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
                }
                Text("\(reaction.count)")
                    .font(.system(size: 11.5))
                    .foregroundStyle(active ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
            }
        }
    }

    private var a11yLabel: String {
        var parts = [content.authorName, content.intent.cardChipLabel]
        if let title = content.title, !title.isEmpty { parts.append(title) }
        if !content.body.isEmpty { parts.append(content.body) }
        if !content.media.isEmpty {
            parts.append("\(content.media.count) attached \(content.media.count == 1 ? "photo" : "photos")")
        }
        return parts.joined(separator: ". ")
    }
}

/// Right-aligned colored chip in the post header. Resolves intent →
/// foreground/background tokens against the existing design system.
public struct PulseIntentChip: View {
    private let intent: PulseIntent

    public init(intent: PulseIntent) {
        self.intent = intent
    }

    public var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(intent.icon, size: 10, strokeWidth: 2.5, color: foreground)
            Text(intent.cardChipLabel.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(foreground)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 2)
        .background(background)
        .clipShape(Capsule())
        .accessibilityLabel("\(intent.label) post")
    }

    private var foreground: Color {
        switch intent {
        case .all: Theme.Color.appTextSecondary
        case .ask: Theme.Color.warmAmber
        case .recommend: Theme.Color.success
        case .event: Theme.Color.magic
        case .lost: Theme.Color.rose
        case .alert: Theme.Color.error
        case .deal: Theme.Color.success
        case .announce: Theme.Color.slate
        case .neighborhoodWin: Theme.Color.warning
        case .visitorGuide: Theme.Color.info
        }
    }

    private var background: Color {
        switch intent {
        case .all: Theme.Color.appSurfaceSunken
        case .ask: Theme.Color.warmAmberBg
        case .recommend: Theme.Color.successLight
        case .event: Theme.Color.magicBg
        case .lost: Theme.Color.roseBg
        case .alert: Theme.Color.errorBg
        case .deal: Theme.Color.successBg
        case .announce: Theme.Color.slateBg
        case .neighborhoodWin: Theme.Color.warningBg
        case .visitorGuide: Theme.Color.infoBg
        }
    }
}
