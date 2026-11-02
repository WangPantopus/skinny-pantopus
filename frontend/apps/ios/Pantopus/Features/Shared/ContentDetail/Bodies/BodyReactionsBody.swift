//
//  BodyReactionsBody.swift
//  Pantopus
//
//  `body_reactions` slot for the Pulse post detail. Body copy → media
//  grid → reactions bar → inline composer → flattened comment thread.
//
// swiftlint:disable file_length multiple_closures_with_trailing_closure

import SwiftUI

/// View-model surface for a single comment row.
public struct PostCommentRow: Sendable, Identifiable, Hashable {
    public let id: String
    public let authorName: String
    public let authorAvatarURL: URL?
    public let authorIdentity: IdentityPillar
    public let body: String
    public let timestamp: String
    public let reactionCount: Int
    public let userReacted: Bool
    /// 0 for top-level, 1 for nested. We collapse deeper threads to 1.
    public let indentLevel: Int
    public let authorUserId: String?
    /// Image attachments uploaded with the comment.
    public let attachmentURLs: [URL]
    /// True when the signed-in user authored this comment — gates the
    /// delete affordance.
    public let isOwn: Bool

    public init(
        id: String,
        authorName: String,
        authorAvatarURL: URL?,
        authorIdentity: IdentityPillar,
        body: String,
        timestamp: String,
        reactionCount: Int = 0,
        userReacted: Bool = false,
        indentLevel: Int,
        authorUserId: String?,
        attachmentURLs: [URL] = [],
        isOwn: Bool = false
    ) {
        self.id = id
        self.authorName = authorName
        self.authorAvatarURL = authorAvatarURL
        self.authorIdentity = authorIdentity
        self.body = body
        self.timestamp = timestamp
        self.reactionCount = reactionCount
        self.userReacted = userReacted
        self.indentLevel = indentLevel
        self.authorUserId = authorUserId
        self.attachmentURLs = attachmentURLs
        self.isOwn = isOwn
    }

    /// Copy with updated heart state — used for optimistic toggles.
    public func withReaction(count: Int, userReacted: Bool) -> PostCommentRow {
        PostCommentRow(
            id: id,
            authorName: authorName,
            authorAvatarURL: authorAvatarURL,
            authorIdentity: authorIdentity,
            body: body,
            timestamp: timestamp,
            reactionCount: count,
            userReacted: userReacted,
            indentLevel: indentLevel,
            authorUserId: authorUserId,
            attachmentURLs: attachmentURLs,
            isOwn: isOwn
        )
    }
}

/// Quick-reply prompt rendered in the empty thread state.
public struct PostQuickReplyPrompt: Sendable, Identifiable, Hashable {
    public let id: String
    public let label: String
    public let icon: PantopusIcon

    public init(label: String, icon: PantopusIcon) {
        id = label
        self.label = label
        self.icon = icon
    }
}

/// The post's one reaction under it: its kind (Helpful, Going, Celebrate),
/// how many people tapped it, and whether the signed-in person did.
public struct PostReactionCounts: Sendable, Hashable {
    public var kind: PostReactionKind
    public var likeCount: Int
    public var isOn: Bool

    public init(kind: PostReactionKind = .helpful, likeCount: Int = 0, isOn: Bool = false) {
        self.kind = kind
        self.likeCount = likeCount
        self.isOn = isOn
    }
}

/// The thread under a post opened from a list's copy (Instant Screens): the
/// card shows at once while the post's comments are read.
public enum CommentsLoadState: Equatable, Sendable {
    case loaded
    /// The comments are being read; `count` is the card's comment count.
    case loading(count: Int)
    /// That read failed; the post stays on screen.
    case failed(count: Int)

    /// The card's count while the comments themselves aren't on screen.
    var pendingCount: Int? {
        switch self {
        case .loaded: nil
        case let .loading(count), let .failed(count): count
        }
    }
}

/// Pulse post body — text + media + reactions + comments. Pure render
/// surface; all state lives in the host view-model.
@MainActor
public struct BodyReactionsBody: View {
    private let bodyText: String
    private let media: [PostMediaItem]
    private let intent: PostIntent
    private let reactions: PostReactionCounts
    private let onReactionTap: @MainActor () -> Void
    private let composerAvatarURL: URL?
    private let composerAvatarName: String
    @Binding private var composerText: String
    private let isSending: Bool
    private let onSendTap: @MainActor () -> Void
    private let comments: [PostCommentRow]
    private let commentsState: CommentsLoadState
    /// The post is under an hour old, so an empty thread reads "just posted".
    private let postedRecently: Bool
    private let hiddenReplyCount: Int
    private let onShowMoreReplies: (@MainActor () -> Void)?
    /// Asks for the comments again when they failed to load. A post that zooms
    /// open has no pull to refresh, so the failure line carries the button.
    private let onRetryComments: (@MainActor () -> Void)?
    private let onCommentAvatarTap: @MainActor (String) -> Void
    /// Author name the composer is replying to (nil = top-level).
    private let replyingToName: String?
    private let onCancelReply: (@MainActor () -> Void)?
    private let onCommentReply: (@MainActor (PostCommentRow) -> Void)?
    private let onCommentLike: (@MainActor (String) -> Void)?
    private let onCommentDelete: (@MainActor (String) -> Void)?
    /// Place label for the media grid's map-pin badge (A10.4).
    private let mediaLocationBadge: String?
    /// One line of details under the text, such as a Lost & Found post's
    /// contact; nil for none.
    private let detailLine: String?
    /// An Event's when and where, under the text; nil on other posts.
    private let eventDetails: PulseEventDetails?
    /// Optional card rendered between the reaction bar and the comment
    /// composer. Pulse post detail passes the "Nearby Providers" card here;
    /// every other caller leaves it nil. Type-erased so adding the slot
    /// doesn't make this shared body generic.
    private let belowReactions: AnyView?
    /// Shown in place of the composer when nobody can reply (a post a
    /// moderator removed); nil keeps the composer and the empty-thread prompts.
    private let repliesClosedNote: String?

    public init(
        body: String,
        media: [PostMediaItem],
        intent: PostIntent = .share,
        reactions: PostReactionCounts,
        onReactionTap: @escaping @MainActor () -> Void,
        mediaLocationBadge: String? = nil,
        detailLine: String? = nil,
        eventDetails: PulseEventDetails? = nil,
        composerAvatarURL: URL?,
        composerAvatarName: String,
        composerText: Binding<String>,
        isSending: Bool,
        onSendTap: @escaping @MainActor () -> Void,
        comments: [PostCommentRow],
        commentsState: CommentsLoadState = .loaded,
        postedRecently: Bool = false,
        hiddenReplyCount: Int = 0,
        onShowMoreReplies: (@MainActor () -> Void)? = nil,
        onRetryComments: (@MainActor () -> Void)? = nil,
        replyingToName: String? = nil,
        onCancelReply: (@MainActor () -> Void)? = nil,
        onCommentReply: (@MainActor (PostCommentRow) -> Void)? = nil,
        onCommentLike: (@MainActor (String) -> Void)? = nil,
        onCommentDelete: (@MainActor (String) -> Void)? = nil,
        belowReactions: AnyView? = nil,
        repliesClosedNote: String? = nil,
        onCommentAvatarTap: @escaping @MainActor (String) -> Void = { _ in }
    ) {
        self.belowReactions = belowReactions
        self.repliesClosedNote = repliesClosedNote
        bodyText = body
        self.media = media
        self.intent = intent
        self.reactions = reactions
        self.onReactionTap = onReactionTap
        self.mediaLocationBadge = mediaLocationBadge
        self.detailLine = detailLine
        self.eventDetails = eventDetails
        self.composerAvatarURL = composerAvatarURL
        self.composerAvatarName = composerAvatarName
        _composerText = composerText
        self.isSending = isSending
        self.onSendTap = onSendTap
        self.comments = comments
        self.commentsState = commentsState
        self.postedRecently = postedRecently
        self.hiddenReplyCount = hiddenReplyCount
        self.onShowMoreReplies = onShowMoreReplies
        self.onRetryComments = onRetryComments
        self.replyingToName = replyingToName
        self.onCancelReply = onCancelReply
        self.onCommentReply = onCommentReply
        self.onCommentLike = onCommentLike
        self.onCommentDelete = onCommentDelete
        self.onCommentAvatarTap = onCommentAvatarTap
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            // While the reply is typed, a tap on the post only closes the
            // keyboard (founder request 2026-10-29); the reply box is below.
            Group {
                if !bodyText.isEmpty {
                    PostLinkText(bodyText)
                        .font(.system(size: 15, weight: .regular))
                        .foregroundStyle(Theme.Color.appText)
                        .lineSpacing(7) // 15 + 7 ≈ 22pt line height
                        .padding(.horizontal, Spacing.s4)
                        .accessibilityLabel(bodyText)
                }

                if let eventDetails {
                    PulseEventDetailRows(
                        details: eventDetails,
                        style: .page,
                        whenIdentifier: "pulsePostDetail-eventWhen",
                        placeIdentifier: "pulsePostDetail-eventPlace"
                    )
                    .padding(.horizontal, Spacing.s4)
                }

                if let detailLine {
                    // Selectable, so a phone number can be copied.
                    Text(detailLine)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .textSelection(.enabled)
                        .padding(.horizontal, Spacing.s4)
                        .accessibilityIdentifier("pulsePostDetail-detailLine")
                }

                if !media.isEmpty {
                    PostMediaGridView(
                        items: media,
                        style: .regular,
                        accessibilityID: "pulsePostDetail-media",
                        locationBadge: mediaLocationBadge,
                        usesSharpPreviews: true,
                        edgeToEdge: true
                    )
                }

                ReactionsBar(
                    counts: reactions,
                    commentCount: visibleCommentCount,
                    commentsAreFresh: threadIsEmpty,
                    postedRecently: postedRecently,
                    onTap: onReactionTap
                )
                .padding(.horizontal, Spacing.s4)

                Rectangle()
                    .fill(Theme.Color.appBorder)
                    .frame(height: 1)
                    .padding(.horizontal, Spacing.s4)

                if let belowReactions {
                    belowReactions
                        .padding(.horizontal, Spacing.s4)
                }
            }
            .closesKeyboardFirst()

            if repliesClosedNote == nil, let replyingToName {
                HStack(spacing: Spacing.s2) {
                    Icon(.reply, size: 12, color: Theme.Color.appTextSecondary)
                    Text("Replying to ")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        + Text(replyingToName)
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                    Spacer()
                    if let onCancelReply {
                        Button(action: { onCancelReply() }) {
                            Icon(.x, size: 12, color: Theme.Color.appTextSecondary)
                                .frame(width: 28, height: 28)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Cancel reply")
                        .accessibilityIdentifier("pulsePostDetail-cancelReply")
                    }
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s1)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .padding(.horizontal, Spacing.s4)
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("pulsePostDetail-replyBanner")
            }

            if let repliesClosedNote {
                Text(repliesClosedNote)
                    .font(.system(size: PantopusTextStyle.small.size))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s4)
                    .accessibilityIdentifier("pulsePostDetail-repliesClosed")
            } else {
                CommentComposer(
                    avatarName: composerAvatarName,
                    avatarURL: composerAvatarURL,
                    text: $composerText,
                    placeholder: composerPlaceholder,
                    isFocusedPresentation: threadIsEmpty,
                    isSending: isSending,
                    onSend: onSendTap
                )
                .padding(.horizontal, Spacing.s4)
            }

            if !comments.isEmpty {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    ForEach(comments) { comment in
                        CommentRow(
                            comment: comment,
                            onAvatarTap: {
                                if let uid = comment.authorUserId { onCommentAvatarTap(uid) }
                            },
                            onReply: onCommentReply.map { handler in { handler(comment) } },
                            onToggleLike: onCommentLike.map { handler in { handler(comment.id) } },
                            onDelete: onCommentDelete.map { handler in { handler(comment.id) } }
                        )
                    }
                    if hiddenReplyCount > 0, let onShowMoreReplies {
                        Button {
                            onShowMoreReplies()
                        } label: {
                            Text("View \(hiddenReplyCount) more \(hiddenReplyCount == 1 ? "reply" : "replies")")
                                .font(.system(size: PantopusTextStyle.small.size, weight: .semibold))
                                .foregroundStyle(Theme.Color.primaryInk)
                                .frame(minHeight: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("View \(hiddenReplyCount) more replies")
                        .padding(.leading, 28 + Spacing.s3) // align with comment body
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .closesKeyboardFirst()
            } else if !threadIsEmpty {
                pendingThread
            } else if repliesClosedNote == nil {
                EmptyThreadState(
                    intent: intent,
                    prompts: intent.quickReplyPrompts
                ) { prompt in
                    composerText = prompt.label
                }
                .padding(.horizontal, Spacing.s4)
            }
        }
    }

    private var visibleCommentCount: Int {
        commentsState.pendingCount ?? (comments.count + hiddenReplyCount)
    }

    /// No comments, as far as anyone on screen knows.
    private var threadIsEmpty: Bool {
        comments.isEmpty && (commentsState.pendingCount ?? 0) == 0
    }

    /// Opened from a list's copy: placeholders while the comments load, a
    /// short line if that failed.
    @ViewBuilder private var pendingThread: some View {
        switch commentsState {
        case let .loading(count) where count > 0:
            VStack(alignment: .leading, spacing: Spacing.s3) {
                ForEach(0..<min(count, 3), id: \.self) { _ in
                    HStack(alignment: .top, spacing: Spacing.s3) {
                        Shimmer(width: 32, height: 32, cornerRadius: Radii.xl)
                        VStack(alignment: .leading, spacing: 7) {
                            Shimmer(width: 120, height: 11, cornerRadius: Radii.xs)
                            Shimmer(height: 11, cornerRadius: Radii.xs)
                        }
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Loading comments")
            .accessibilityIdentifier("pulsePostDetail-commentsLoading")
        case let .failed(count) where count > 0:
            if let onRetryComments {
                HStack(spacing: Spacing.s2) {
                    Text("Couldn't load the comments.")
                        .font(.system(size: PantopusTextStyle.small.size))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Button("Try again", action: onRetryComments)
                        .font(.system(size: PantopusTextStyle.small.size, weight: .semibold))
                        .foregroundStyle(Theme.Color.primaryInk)
                        .frame(minHeight: 44)
                        .accessibilityIdentifier("pulsePostDetail-commentsRetry")
                }
                .padding(.horizontal, Spacing.s4)
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("pulsePostDetail-commentsFailed")
            } else {
                Text("Couldn't load the comments. Pull down to try again.")
                    .font(.system(size: PantopusTextStyle.small.size))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, Spacing.s4)
                    .accessibilityIdentifier("pulsePostDetail-commentsFailed")
            }
        default:
            EmptyView()
        }
    }

    private var composerPlaceholder: String {
        if let replyingToName { return "Reply to \(replyingToName)..." }
        return threadIsEmpty ? "Be the first to reply..." : "Add a comment"
    }
}

// MARK: - Sub-views

private struct ReactionsBar: View {
    let counts: PostReactionCounts
    let commentCount: Int
    let commentsAreFresh: Bool
    /// "just posted" follows "0 comments" only while the post is under an hour old.
    let postedRecently: Bool
    let onTap: @MainActor () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            // The post's one reaction, named by its kind as on its card ("Helpful 3").
            ReactionPill(
                id: counts.kind.rawValue,
                icon: counts.kind.icon,
                label: counts.kind.label,
                likeCount: counts.likeCount,
                accessibilityLabel: counts.likeCount == 0 ? counts.kind.label : "\(counts.kind.label), \(counts.likeCount)",
                isSelected: counts.isOn
            ) { onTap() }
            Spacer()
            HStack(spacing: Spacing.s1) {
                Icon(.messageCircle, size: 13, color: commentsAreFresh ? Theme.Color.appTextMuted : Theme.Color.appTextSecondary)
                Text(commentSummary)
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(commentsAreFresh ? Theme.Color.appTextMuted : Theme.Color.appTextSecondary)
            }
            .accessibilityLabel(commentSummary)
        }
    }

    private var commentSummary: String {
        if commentsAreFresh {
            return postedRecently ? "0 comments · just posted" : "0 comments"
        }
        return "\(commentCount) \(commentCount == 1 ? "comment" : "comments")"
    }
}

private struct ReactionPill: View {
    let id: String
    let icon: PantopusIcon
    /// The reaction's word ("Helpful", "Going", "Celebrate").
    let label: String
    /// Shown after the word once someone tapped it.
    let likeCount: Int
    let accessibilityLabel: String
    let isSelected: Bool
    var selectedForeground: Color = Theme.Color.primary700
    var selectedBackground: Color = Theme.Color.primary50
    let onTap: @MainActor () -> Void

    var body: some View {
        Button(action: { onTap() }) { pillBody }
            .buttonStyle(.plain)
            .frame(minHeight: 44, alignment: .center)
            .accessibilityIdentifier("pulsePostDetail-reaction-\(id)")
            .accessibilityLabel(accessibilityLabel)
            .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    private var pillBody: some View {
        HStack(spacing: Spacing.s1) {
            Icon(icon, size: 14, color: foreground)
            Text(label)
                .font(.system(size: PantopusTextStyle.caption.size, weight: .medium))
                .foregroundStyle(foreground)
            if likeCount != 0 {
                Text("\(likeCount)")
                    .font(.system(size: PantopusTextStyle.caption.size, weight: .regular))
                    .foregroundStyle(foreground)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 32)
        .background(background)
        .overlay {
            RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                .stroke(border, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
    }

    private var foreground: Color {
        isSelected ? selectedForeground : Theme.Color.appTextSecondary
    }

    private var background: Color {
        isSelected ? selectedBackground : Theme.Color.appSurface
    }

    private var border: Color {
        isSelected ? selectedForeground.opacity(0.25) : Theme.Color.appBorder
    }
}

// MARK: - Preview

#Preview("Populated") {
    @Previewable @State var text = ""
    BodyReactionsBody(
        body: "Anyone know a reliable handyman for fixing a leaky faucet in Cambridge? Tried two on Angi already.",
        media: [],
        reactions: PostReactionCounts(kind: .helpful, likeCount: 7, isOn: true),
        onReactionTap: {},
        composerAvatarURL: nil,
        composerAvatarName: "You",
        composerText: $text,
        isSending: false,
        onSendTap: {},
        comments: [
            PostCommentRow(
                id: "1",
                authorName: "Maria Chen",
                authorAvatarURL: nil,
                authorIdentity: .personal,
                body: "I used Mike at Westside Plumbing last month. Solid.",
                timestamp: "3m ago",
                indentLevel: 0,
                authorUserId: "u1"
            ),
            PostCommentRow(
                id: "2",
                authorName: "Sam Lee",
                authorAvatarURL: nil,
                authorIdentity: .personal,
                body: "+1 to Mike. Fair pricing too.",
                timestamp: "2m ago",
                indentLevel: 1,
                authorUserId: "u2"
            )
        ],
        hiddenReplyCount: 4
    ) {}
        .background(Theme.Color.appBg)
}
