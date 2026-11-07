//
//  PulsePostCard.swift
//  Pantopus
//
//  One row in the Pulse vertical feed. Header (avatar + meta + intent
//  chip), optional title (any post that has one), body clamped to 3
//  lines (2 with a title), intent-shaped reaction strip, optional Event
//  attendee row with RSVP chip. Pure-render view — all state lives upstream.
//

import SwiftUI

// swiftlint:disable file_length

/// A tap shown at once while the server hasn't confirmed it yet (Instant
/// Screens: low-risk taps show as pending, then confirmed or rolled back).
public enum PulsePendingAction: Sendable, Hashable {
    case reaction
    case save
    case repost
}

/// Which overflow actions a single Pulse card offers this viewer, and
/// which of them are already applied. Mirrors RN's per-card gating in
/// `src/components/feed/PostCard.tsx:97-101, 382-397, 445-470`.
public struct PulsePostActions: Sendable, Hashable {
    /// Cold-start neighborhood fact — dismissable, never reportable.
    public let isSeeded: Bool
    public let isSaved: Bool
    public let isReposted: Bool
    public let shareCount: Int
    /// `state == "solved"`: an Ask already marked solved (no "Mark solved");
    /// the Solved badge while the Pulse redesign is off (launch cut #11).
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
    /// Taps on this card still waiting for the server.
    public let pending: Set<PulsePendingAction>
    /// The asker's own open Ask (Pulse S7, contract §2.12): "Close" is offered.
    public let canCloseAsk: Bool
    /// …and "Keep open 7 more days", until it has been used once.
    public let canKeepAskOpen: Bool
    /// A plan's own post (Plans marks it `post_metadata.plan`): its plan
    /// changes or cancels it, so it offers no Delete.
    public let isPlanPost: Bool

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
        topicLabel: String? = nil,
        pending: Set<PulsePendingAction> = [],
        canCloseAsk: Bool = false,
        canKeepAskOpen: Bool = false,
        isPlanPost: Bool = false
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
        self.pending = pending
        self.canCloseAsk = canCloseAsk
        self.canKeepAskOpen = canKeepAskOpen
        self.isPlanPost = isPlanPost
    }

    /// Report is offered to everyone except the author (RN
    /// `PostCard.tsx:507`).
    public var canReport: Bool {
        !isOwner && !isSeeded
    }

    /// Delete is author-only (RN `PostCard.tsx:516`), and never a plan's post:
    /// deleting it would take the plan and everyone's asks with it.
    public var canDelete: Bool {
        isOwner && !isSeeded && !isPlanPost
    }

    /// The host's own plan post opens its plan, where Change and Cancel live.
    public var canOpenPlan: Bool {
        isOwner && isPlanPost
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
    /// Replaces the tint's color: a person's profile colors their own cards
    /// with their profile color (`ProfileAvatarColor`).
    public var avatarColor: Color?
    public let meta: String
    public let intent: PulseIntent
    public let title: String?
    public let body: String
    /// When and where an Event happens; nil on other posts.
    public let event: PulseEventDetails?
    /// The post's reaction: emoji reactions, or an Event's Going, which its
    /// attendee strip shows as "N going" and the Going button.
    public let reaction: PulseReaction
    public let attendees: PulseAttendeeStrip?
    public let userHasReacted: Bool
    public let media: [PostMediaItem]
    /// Number of comments — shown beside the Reply affordance.
    public let commentCount: Int
    /// Overflow-menu capability set for this viewer.
    public let actions: PulsePostActions
    /// The chip's word; a found Lost & Found post says "Found"
    /// (`PulseIntent.chipLabel(lostFoundType:)`).
    public let chipLabel: String
    /// Posted far from the author's homes; the meta line says Visitor (web shows a Visitor badge).
    public let isVisitor: Bool
    /// Curator attribution comes from `origin`, never the cold-start fact flag.
    public let origin: String?
    /// The post's Pulse topic, when it has one this build knows (Pulse S4):
    /// named on the meta line and muted by "Mute this topic".
    public let pulseTopic: PulseTopic?
    /// How the post ended, or when a Heads-up ends (Pulse S7).
    public let status: PulsePostStatus?
    /// Connections: "Ben C. and 2 others reposted", the line above the author; nil when no connection reposted it.
    public let repostedBy: String?
    /// What the author's photo and name open; nil when they open nothing.
    public let authorLink: PulseAuthorLink?
    public var isCurator: Bool {
        origin == "curator"
    }

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
        event: PulseEventDetails? = nil,
        reaction: PulseReaction,
        attendees: PulseAttendeeStrip?,
        userHasReacted: Bool,
        media: [PostMediaItem] = [],
        commentCount: Int = 0,
        actions: PulsePostActions = PulsePostActions(),
        chipLabel: String? = nil,
        isVisitor: Bool = false,
        origin: String? = nil,
        pulseTopic: PulseTopic? = nil,
        status: PulsePostStatus? = nil,
        repostedBy: String? = nil,
        authorLink: PulseAuthorLink? = nil
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
        self.event = event
        self.reaction = reaction
        self.attendees = attendees
        self.userHasReacted = userHasReacted
        self.media = media
        self.commentCount = commentCount
        self.actions = actions
        self.chipLabel = chipLabel ?? intent.cardChipLabel
        self.isVisitor = isVisitor
        self.origin = origin
        self.pulseTopic = pulseTopic
        self.status = status
        self.repostedBy = repostedBy
        self.authorLink = authorLink
    }
}

/// Where a post's author leads, as the post page's header: a person's profile or a business's page.
public enum PulseAuthorLink: Sendable, Hashable {
    case person(userId: String)
    case business(String)
}

/// Event card attendee strip — stacked avatars, "N going" and the Going button.
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
    /// The post open beside the feed on a wide screen: its card is tinted and marked selected.
    @Environment(\.selectedPulsePostId) private var selectedPostId
    /// The emoji picker is open from the reaction pill.
    @State private var showsReactionPicker = false
    private let content: PulsePostCardContent
    private let onTap: @MainActor () -> Void
    /// An emoji picked in the reaction picker (picking the viewer's own takes it away).
    private let onPickReaction: @MainActor (PostReactionEmoji) -> Void
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
    /// Opens the author's profile or page from their photo and name. `nil` leaves them plain.
    private let onOpenAuthor: (@MainActor () -> Void)?

    public init(
        content: PulsePostCardContent,
        onTap: @escaping @MainActor () -> Void,
        onPickReaction: @escaping @MainActor (PostReactionEmoji) -> Void,
        onRSVP: (@MainActor () -> Void)? = nil,
        onOverflow: (@MainActor () -> Void)? = nil,
        onDismissSeeded: (@MainActor () -> Void)? = nil,
        onToggleSave: (@MainActor () -> Void)? = nil,
        onToggleRepost: (@MainActor () -> Void)? = nil,
        onOpenAuthor: (@MainActor () -> Void)? = nil
    ) {
        self.content = content
        self.onTap = onTap
        self.onPickReaction = onPickReaction
        self.onRSVP = onRSVP
        self.onOverflow = onOverflow
        self.onDismissSeeded = onDismissSeeded
        self.onToggleSave = onToggleSave
        self.onToggleRepost = onToggleRepost
        self.onOpenAuthor = onOpenAuthor
    }

    public var body: some View {
        if content.actions.isSeeded {
            // A cold-start tip isn't a post: there's no page to open and nothing to react to (its X dismisses it).
            card
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("pulsePostCard_\(content.id)")
        } else {
            Button(action: onTap) { card }
                .buttonStyle(.plain)
                // One element with one label; its controls are named actions, so VoiceOver reaches each one
                // (combining would leave that to how SwiftUI merges nested buttons).
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(a11yLabel)
                .accessibilityAddTraits(isOpenBeside ? [.isButton, .isSelected] : .isButton)
                .accessibilityAction { onTap() }
                .accessibilityActions { cardActions }
                .accessibilityIdentifier("pulsePostCard_\(content.id)")
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 9) {
            authorIdentity
            Spacer(minLength: Spacing.s2)
            PulseIntentChip(intent: content.intent, label: content.chipLabel)
            headerTrailingControl
        }
    }

    /// The author's photo and name, which open their profile (or page) when the card has somewhere to take them.
    @ViewBuilder private var authorIdentity: some View {
        let identity = HStack(alignment: .center, spacing: 9) {
            FeedAvatar(
                initials: content.authorInitials,
                tint: content.avatarTint,
                color: content.avatarColor,
                verified: content.authorVerified,
                size: 32
            )
            VStack(alignment: .leading, spacing: 2) {
                Text(content.authorName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                headerMetadata
            }
        }
        if let onOpenAuthor {
            Button(action: onOpenAuthor) {
                identity.contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("pulsePostAuthor_\(content.id)")
        } else {
            identity
        }
    }

    /// "Open Ben's profile" for a person, "Open Corner Bakery's page" for a business.
    private var openAuthorLabel: String {
        if case .business? = content.authorLink { return "Open \(content.authorName)'s page" }
        return "Open \(content.authorName)'s profile"
    }

    /// Seeded facts get a dismiss "x"; every other card gets the overflow
    /// menu. RN splits the same way (`PostCard.tsx:85-88`).
    @ViewBuilder private var headerTrailingControl: some View {
        if content.actions.isSeeded {
            if let onDismissSeeded {
                Button(action: onDismissSeeded) {
                    Icon(.x, size: 15, color: Theme.Color.appTextMuted)
                        .frame(width: 28, height: 28)
                        .hitArea(horizontal: 8, vertical: 8)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Dismiss this suggestion")
                .accessibilityIdentifier("pulsePostDismissSeeded_\(content.id)")
            }
        } else if let onOverflow {
            Button(action: onOverflow) {
                Icon(.moreHorizontal, size: 16, color: Theme.Color.appTextMuted)
                    .frame(width: 28, height: 28)
                    .hitArea(horizontal: 8, vertical: 8)
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
                if strip.goingCount > 0 {
                    Text(PostReactionKind.going.countText(strip.goingCount))
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
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
                            Text(PostReactionKind.going.label)
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(Theme.Color.magic)
                        }
                        .padding(.horizontal, Spacing.s3)
                        .frame(height: 26)
                        .background(Theme.Color.magicBg)
                        .clipShape(Capsule())
                        .hitArea(vertical: 9)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(PostReactionKind.going.label)
                    .accessibilityValue(strip.goingCount > 0 ? PostReactionKind.going.countText(strip.goingCount) : "")
                    .accessibilityAddTraits(strip.userIsGoing ? .isSelected : [])
                    .accessibilityIdentifier("pulseRSVP_\(content.id)")
                }
            }
            .padding(.top, Spacing.s2)
        }
    }

    private var reactionStrip: some View {
        HStack(alignment: .center, spacing: 14) {
            // An Event's Going button sits in its attendee strip.
            if content.reaction.kind == .emoji {
                reactionPill
            }
            // October 13's badge while the Pulse redesign, whose status words
            // replace it, is off (launch cut #11).
            if !LaunchFeatures.pulseRedesign, content.actions.isSolved {
                solvedBadge
            }
            Spacer()
            if let onToggleSave {
                Button(action: onToggleSave) {
                    Icon(
                        .bookmark,
                        size: 12,
                        color: content.actions.isSaved ? Theme.Color.primaryInk : Theme.Color.appTextSecondary
                    )
                    .frame(width: 24, height: 24)
                    .hitArea(horizontal: 8, vertical: 10)
                }
                .buttonStyle(.plain)
                .opacity(content.actions.pending.contains(.save) ? 0.5 : 1)
                .accessibilityLabel(content.actions.isSaved ? "Remove bookmark" : "Save post")
                .accessibilityValue(content.actions.pending.contains(.save) ? "Saving" : "")
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
                    .hitArea(horizontal: 8, vertical: 10)
                }
                .buttonStyle(.plain)
                .opacity(content.actions.pending.contains(.repost) ? 0.5 : 1)
                .accessibilityLabel(content.actions.isReposted ? "Undo repost" : "Repost")
                .accessibilityValue(content.actions.pending.contains(.repost) ? "Saving" : "")
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

    /// Cycling tint palette for the Event attendee mini-avatars (decorative;
    /// the live feed has no per-attendee identity, fixtures echo the design).
    private static let attendeeTints: [FeedAvatarTint] = [.orange, .sky, .violet, .green]

    private var a11yLabel: String {
        var parts = [content.authorName, content.chipLabel]
        if let repostedBy = content.repostedBy { parts.insert(repostedBy, at: 0) }
        if content.isCurator { parts.append("Pantopus curator") }
        if content.isVisitor { parts.append("Visitor") }
        if let topic = content.pulseTopic { parts.append(topic.label) }
        if let status = content.status { parts.append(status.text) }
        if let title = content.title, !title.isEmpty { parts.append(title) }
        if !content.body.isEmpty { parts.append(content.body) }
        if let when = content.event?.when { parts.append(when) }
        if let place = content.event?.place { parts.append(place) }
        if !content.media.isEmpty {
            parts.append("\(content.media.count) attached \(content.media.count == 1 ? "photo" : "photos")")
        }
        parts += reactionsSpoken
        // A part that already ends a sentence keeps its own mark (as on Android): VoiceOver never hears "7..".
        return parts.reduce("") { label, part in
            guard let last = label.last else { return part }
            return label + (".?!".contains(last) ? " " : ". ") + part
        }
    }
}

/// The card's VoiceOver actions sit in an extension so the card's body stays within SwiftLint's type length.
private extension PulsePostCard {
    @ViewBuilder var headerMetadata: some View {
        if content.isCurator {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: Spacing.s1) {
                    curatorChip
                    metadataText
                }
                .fixedSize(horizontal: true, vertical: false)
                VStack(alignment: .leading, spacing: 2) {
                    curatorChip
                    metadataText
                }
            }
        } else {
            metadataText
        }
    }

    var metadataText: some View {
        Text(content.meta)
            .font(.system(size: 10.5))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .lineLimit(1)
    }

    /// Who among the viewer's connections reposted the post (Connections), above the author; plain text.
    func repostedByLine(_ text: String) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(.arrowsRepeat, size: 11, color: Theme.Color.appTextSecondary)
            Text(text)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(1)
        }
        .accessibilityIdentifier("pulsePostRepostedBy_\(content.id)")
    }

    /// An Event's when and where, under its text (as on the web card).
    func eventRows(_ event: PulseEventDetails) -> some View {
        PulseEventDetailRows(
            details: event,
            style: .card,
            whenIdentifier: "pulsePostEventWhen_\(content.id)",
            placeIdentifier: "pulsePostEventPlace_\(content.id)"
        )
    }

    /// The f9 export's neutral origin chip, without its out-of-scope explainer.
    var curatorChip: some View {
        PulseCuratorChip()
            .accessibilityIdentifier("pulsePostCurator_\(content.id)")
    }

    /// Inline "Solved" pill — RN renders the same badge once
    /// `state === 'solved'` (`PostCard.tsx:474-479`).
    var solvedBadge: some View {
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

    /// The post's emoji reactions (an Event's Going sits in its attendee
    /// strip): a smile and "React" before anyone reacted, else up to three
    /// emoji and how many reacted ("👍❤️😂 6"), in the active colour once the
    /// viewer reacted. A tap opens the emoji picker from it.
    var reactionPill: some View {
        let reactions = content.reaction.emoji
        let active = reactions.mine != nil
        return Button(action: openReactionPicker) {
            reactionPillLabel(reactions, active: active)
                .hitArea(horizontal: 6, vertical: 12)
        }
        .buttonStyle(.plain)
        .opacity(content.actions.pending.contains(.reaction) ? 0.5 : 1)
        .accessibilityLabel(reactions.accessibilityLabel)
        .accessibilityValue(reactions.accessibilityValue)
        .accessibilityAddTraits(active ? .isSelected : [])
        .accessibilityIdentifier("pulseReaction_\(content.id)")
        .pulseReactionPicker(isPresented: $showsReactionPicker, selected: reactions.mine, onPick: onPickReaction)
    }

    @ViewBuilder
    func reactionPillLabel(_ reactions: PostReactions, active: Bool) -> some View {
        if reactions.isEmpty {
            HStack(spacing: Spacing.s1) {
                Icon(.smile, size: 12, color: Theme.Color.appTextSecondary)
                Text(PostReactionKind.emoji.label)
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        } else {
            HStack(spacing: Spacing.s1) {
                Text(reactions.cardEmoji.map(\.rawValue).joined())
                    .font(.system(size: 13))
                Text("\(reactions.total)")
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(active ? Theme.Color.primaryInk : Theme.Color.appTextSecondary)
            }
        }
    }

    /// The pill's words for the card's label, since the card is one element
    /// and its "React" action doesn't name the counts: "Reactions, 6: 3 Like,
    /// 2 Love, 1 Haha" and "Your reaction: Love"; none before anyone reacted,
    /// and none on an Event (its Going action names them).
    var reactionsSpoken: [String] {
        let reactions = content.reaction.emoji
        guard content.reaction.kind == .emoji, !reactions.isEmpty else { return [] }
        return [reactions.accessibilityLabel, reactions.accessibilityValue].filter { !$0.isEmpty }
    }

    /// Opens the emoji picker, unless the last pick is still on its way.
    func openReactionPicker() {
        guard !content.actions.pending.contains(.reaction) else { return }
        showsReactionPicker = true
    }

    /// The card's controls as VoiceOver actions, named as their buttons are.
    @ViewBuilder var cardActions: some View {
        if let onRSVP, content.attendees != nil {
            Button(content.reaction.accessibilityLabel, action: onRSVP)
        } else if content.reaction.kind == .emoji {
            Button(PostReactionKind.emoji.label, action: openReactionPicker)
        }
        if let onToggleSave {
            Button(content.actions.isSaved ? "Remove bookmark" : "Save post", action: onToggleSave)
        }
        if let onToggleRepost {
            Button(content.actions.isReposted ? "Undo repost" : "Repost", action: onToggleRepost)
        }
        if let onOverflow {
            Button("Post options", action: onOverflow)
        }
        if let onOpenAuthor {
            Button(openAuthorLabel, action: onOpenAuthor)
        }
    }
}

private struct PulseCuratorChip: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(spacing: Spacing.s1) {
            PantopusMark(size: 16)
                .accessibilityHidden(true)
            Text("Pantopus curator")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineLimit(1)
        }
        .fixedSize(horizontal: true, vertical: false)
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(colorScheme == .dark ? Theme.Color.appSurfaceRaised : Theme.Color.appSurfaceSunken)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(
            colorScheme == .dark ? Theme.Color.appTextSecondary : .clear,
            lineWidth: 1
        ))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Pantopus curator")
    }
}

public extension PulseIntent {
    /// The intent's colour: the card chip's text and icon, and its map pin.
    var tint: Color {
        switch self {
        case .all, .generic: Theme.Color.appTextSecondary
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

    /// The soft fill behind the intent's colour: the card chip, a pinned card's top.
    var tintBackground: Color {
        switch self {
        case .all, .generic: Theme.Color.appSurfaceSunken
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

/// Right-aligned colored chip in the post header. Resolves intent →
/// foreground/background tokens against the existing design system.
public struct PulseIntentChip: View {
    private let intent: PulseIntent
    private let label: String

    public init(intent: PulseIntent, label: String? = nil) {
        self.intent = intent
        self.label = label ?? intent.cardChipLabel
    }

    public var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(intent.icon, size: 10, strokeWidth: 2.5, color: foreground)
            Text(label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(foreground)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 2)
        .background(background)
        .clipShape(Capsule())
        .accessibilityLabel(intent == .generic ? label : "\(intent.label) post")
    }

    private var foreground: Color {
        intent.tint
    }

    private var background: Color {
        intent.tintBackground
    }
}

private extension PulsePostCard {
    var card: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if let repostedBy = content.repostedBy {
                repostedByLine(repostedBy)
                    .padding(.horizontal, Spacing.s4)
            }
            header
                .padding(.horizontal, Spacing.s4)
            if let title = content.title, !title.isEmpty {
                Text(title)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                    .padding(.horizontal, Spacing.s4)
            }
            if !content.body.isEmpty {
                PostLinkText(content.body)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(content.title?.isEmpty == false ? 2 : 3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Spacing.s4)
            }
            if let event = content.event {
                eventRows(event)
                    .padding(.horizontal, Spacing.s4)
            }
            if !content.media.isEmpty {
                PostMediaGridView(
                    items: content.media,
                    style: .compact,
                    accessibilityID: "pulsePostMedia_\(content.id)",
                    usesSharpPreviews: true,
                    edgeToEdge: true
                )
            }
            if let attendees = content.attendees {
                attendeeStrip(attendees)
                    .padding(.horizontal, Spacing.s4)
            }
            // On its own line, so the words are never cut short (Pulse S7).
            if let status = content.status {
                PulsePostStatusPill(status: status, postId: content.id)
                    .padding(.top, Spacing.s1)
                    .padding(.horizontal, Spacing.s4)
            }
            if !content.actions.isSeeded {
                reactionStrip
                    .padding(.horizontal, Spacing.s4)
            }
        }
        .padding(.vertical, Spacing.s4)
        .background(isOpenBeside ? Theme.Color.primary100 : Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    var isOpenBeside: Bool {
        selectedPostId == content.id
    }
}
