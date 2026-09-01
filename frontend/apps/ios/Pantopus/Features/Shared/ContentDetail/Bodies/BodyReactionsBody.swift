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

/// Counts displayed under each reaction pill, plus which (if any) the
/// signed-in user has currently selected.
public struct PostReactionCounts: Sendable, Hashable {
    public var helpful: Int
    public var heart: Int
    public var going: Int
    public var userReaction: PostReactionKind?

    public init(helpful: Int = 0, heart: Int = 0, going: Int = 0, userReaction: PostReactionKind? = nil) {
        self.helpful = helpful
        self.heart = heart
        self.going = going
        self.userReaction = userReaction
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
    private let onReactionTap: @MainActor (PostReactionKind) -> Void
    private let composerAvatarURL: URL?
    private let composerAvatarName: String
    @Binding private var composerText: String
    private let isSending: Bool
    private let onSendTap: @MainActor () -> Void
    private let comments: [PostCommentRow]
    private let hiddenReplyCount: Int
    private let onShowMoreReplies: (@MainActor () -> Void)?
    private let onCommentAvatarTap: @MainActor (String) -> Void
    /// Author name the composer is replying to (nil = top-level).
    private let replyingToName: String?
    private let onCancelReply: (@MainActor () -> Void)?
    private let onCommentReply: (@MainActor (PostCommentRow) -> Void)?
    private let onCommentLike: (@MainActor (String) -> Void)?
    private let onCommentDelete: (@MainActor (String) -> Void)?
    /// Place label for the media grid's map-pin badge (A10.4).
    private let mediaLocationBadge: String?
    /// Emoji flair on the active heart reaction (long-press popover pick).
    private let selectedReactionEmoji: String?
    private let onEmojiSelected: (@MainActor (String) -> Void)?
    /// Optional card rendered between the reaction bar and the comment
    /// composer. Pulse post detail passes the "Nearby Providers" card here;
    /// every other caller leaves it nil. Type-erased so adding the slot
    /// doesn't make this shared body generic.
    private let belowReactions: AnyView?

    public init(
        body: String,
        media: [PostMediaItem],
        intent: PostIntent = .share,
        reactions: PostReactionCounts,
        onReactionTap: @escaping @MainActor (PostReactionKind) -> Void,
        mediaLocationBadge: String? = nil,
        selectedReactionEmoji: String? = nil,
        onEmojiSelected: (@MainActor (String) -> Void)? = nil,
        composerAvatarURL: URL?,
        composerAvatarName: String,
        composerText: Binding<String>,
        isSending: Bool,
        onSendTap: @escaping @MainActor () -> Void,
        comments: [PostCommentRow],
        hiddenReplyCount: Int = 0,
        onShowMoreReplies: (@MainActor () -> Void)? = nil,
        replyingToName: String? = nil,
        onCancelReply: (@MainActor () -> Void)? = nil,
        onCommentReply: (@MainActor (PostCommentRow) -> Void)? = nil,
        onCommentLike: (@MainActor (String) -> Void)? = nil,
        onCommentDelete: (@MainActor (String) -> Void)? = nil,
        belowReactions: AnyView? = nil,
        onCommentAvatarTap: @escaping @MainActor (String) -> Void = { _ in }
    ) {
        self.belowReactions = belowReactions
        bodyText = body
        self.media = media
        self.intent = intent
        self.reactions = reactions
        self.onReactionTap = onReactionTap
        self.mediaLocationBadge = mediaLocationBadge
        self.selectedReactionEmoji = selectedReactionEmoji
        self.onEmojiSelected = onEmojiSelected
        self.composerAvatarURL = composerAvatarURL
        self.composerAvatarName = composerAvatarName
        _composerText = composerText
        self.isSending = isSending
        self.onSendTap = onSendTap
        self.comments = comments
        self.hiddenReplyCount = hiddenReplyCount
        self.onShowMoreReplies = onShowMoreReplies
        self.replyingToName = replyingToName
        self.onCancelReply = onCancelReply
        self.onCommentReply = onCommentReply
        self.onCommentLike = onCommentLike
        self.onCommentDelete = onCommentDelete
        self.onCommentAvatarTap = onCommentAvatarTap
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            if !bodyText.isEmpty {
                Text(bodyText)
                    .font(.system(size: 15, weight: .regular))
                    .foregroundStyle(Theme.Color.appText)
                    .lineSpacing(7) // 15 + 7 ≈ 22pt line height
                    .padding(.horizontal, Spacing.s4)
                    .accessibilityLabel(bodyText)
            }

            if !media.isEmpty {
                PostMediaGridView(
                    items: media,
                    style: .regular,
                    accessibilityID: "pulsePostDetail-media",
                    locationBadge: mediaLocationBadge
                )
                .padding(.horizontal, Spacing.s4)
            }

            ReactionsBar(
                counts: reactions,
                commentCount: visibleCommentCount,
                commentsAreFresh: comments.isEmpty,
                selectedEmoji: selectedReactionEmoji,
                onEmojiSelected: onEmojiSelected,
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

            if let replyingToName {
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

            CommentComposer(
                avatarName: composerAvatarName,
                avatarURL: composerAvatarURL,
                text: $composerText,
                placeholder: composerPlaceholder,
                isFocusedPresentation: comments.isEmpty,
                isSending: isSending,
                onSend: onSendTap
            )
            .padding(.horizontal, Spacing.s4)

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
                                .foregroundStyle(Theme.Color.primary600)
                                .frame(minHeight: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("View \(hiddenReplyCount) more replies")
                        .padding(.leading, 28 + Spacing.s3) // align with comment body
                    }
                }
                .padding(.horizontal, Spacing.s4)
            } else {
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
        comments.count + hiddenReplyCount
    }

    private var composerPlaceholder: String {
        if let replyingToName { return "Reply to \(replyingToName)..." }
        return comments.isEmpty ? "Be the first to reply..." : "Add a comment"
    }
}

// MARK: - Sub-views

private struct ReactionsBar: View {
    let counts: PostReactionCounts
    let commentCount: Int
    let commentsAreFresh: Bool
    var selectedEmoji: String?
    var onEmojiSelected: (@MainActor (String) -> Void)?
    let onTap: @MainActor (PostReactionKind) -> Void

    @State private var showsEmojiPicker = false

    var body: some View {
        HStack(spacing: Spacing.s2) {
            ReactionPill(
                id: "heart",
                icon: .heart,
                emojiGlyph: counts.userReaction == .helpful ? selectedEmoji : nil,
                count: counts.helpful,
                accessibilityLabel: "Heart reaction, \(counts.helpful)",
                isSelected: counts.userReaction == .helpful,
                selectedForeground: Theme.Color.error,
                selectedBackground: Theme.Color.errorBg
            ) { onTap(.helpful) }
                .simultaneousGesture(
                    LongPressGesture(minimumDuration: 0.35).onEnded { _ in
                        if onEmojiSelected != nil { showsEmojiPicker = true }
                    }
                )
                .popover(isPresented: $showsEmojiPicker) {
                    HStack(spacing: Spacing.s2) {
                        ForEach(PulsePostDetailViewModel.reactionEmojis, id: \.self) { emoji in
                            Button {
                                showsEmojiPicker = false
                                onEmojiSelected?(emoji)
                            } label: {
                                Text(emoji)
                                    .font(.system(size: 24))
                                    .frame(width: 36, height: 36)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("React with \(emoji)")
                        }
                    }
                    .padding(Spacing.s2)
                    .presentationCompactAdaptation(.popover)
                    .accessibilityIdentifier("pulsePostDetail-emojiPicker")
                }
            ReactionPill(
                id: "hand",
                icon: .hand,
                count: counts.heart,
                accessibilityLabel: "Raised hand reaction, \(counts.heart)",
                isSelected: counts.userReaction == .heart,
                onTap: nil
            )
            ReactionPill(
                id: "eye",
                icon: .eye,
                count: counts.going,
                accessibilityLabel: "Watching reaction, \(counts.going)",
                isSelected: counts.userReaction == .going,
                onTap: nil
            )
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
            return "0 comments · just posted"
        }
        return "\(commentCount) \(commentCount == 1 ? "comment" : "comments")"
    }
}

private struct ReactionPill: View {
    let id: String
    let icon: PantopusIcon
    /// Emoji rendered instead of the icon (long-press popover pick).
    var emojiGlyph: String?
    let count: Int
    let accessibilityLabel: String
    let isSelected: Bool
    var selectedForeground: Color = Theme.Color.primary700
    var selectedBackground: Color = Theme.Color.primary50
    /// `nil` renders the pill as display-only (no Button wrapper).
    let onTap: (@MainActor () -> Void)?

    var body: some View {
        if let onTap {
            Button(action: { onTap() }) { pillBody }
                .buttonStyle(.plain)
                .frame(minHeight: 44, alignment: .center)
                .accessibilityIdentifier("pulsePostDetail-reaction-\(id)")
                .accessibilityLabel(accessibilityLabel)
                .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
        } else {
            pillBody
                .accessibilityElement()
                .accessibilityIdentifier("pulsePostDetail-reaction-\(id)")
                .accessibilityLabel(accessibilityLabel)
        }
    }

    private var pillBody: some View {
        HStack(spacing: Spacing.s1) {
            if let emojiGlyph {
                Text(emojiGlyph)
                    .pantopusTextStyle(.small)
            } else {
                Icon(icon, size: 14, color: foreground)
            }
            Text("\(count)")
                .font(.system(size: PantopusTextStyle.caption.size, weight: .regular))
                .foregroundStyle(foreground)
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
        reactions: PostReactionCounts(helpful: 7, heart: 2, going: 0, userReaction: .helpful),
        onReactionTap: { _ in },
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
