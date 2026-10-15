// Existing legacy post presentation, retained for previews and older callers.

import SwiftUI

@MainActor
public struct PulsePostDetailLoadedContent: View {
    private let detail: PulsePostDetailContent
    /// Opened from the feed's copy: the thread is still loading (or failed).
    private let commentsState: CommentsLoadState
    @Binding private var composerText: String
    private let isSendingComment: Bool
    private let replyingToName: String?
    private let selectedReactionEmoji: String?
    private let topBarAction: ContentDetailTopBarAction?
    private let topBarSecondaryAction: ContentDetailTopBarAction?
    /// Organically matched local businesses — empty hides the card.
    private let nearbyProviders: [NearbyProviderRow]
    private let onOpenBusiness: @MainActor (String) -> Void
    private let onBack: @MainActor () -> Void
    private let onOpenProfile: @MainActor (String) -> Void
    private let onReactionTap: @MainActor (PostReactionKind) -> Void
    private let onEmojiSelected: (@MainActor (String) -> Void)?
    private let onSendTap: @MainActor () -> Void
    private let onShowMoreReplies: @MainActor () -> Void
    private let onCancelReply: (@MainActor () -> Void)?
    private let onCommentReply: (@MainActor (PostCommentRow) -> Void)?
    private let onCommentLike: (@MainActor (String) -> Void)?
    private let onCommentDelete: (@MainActor (String) -> Void)?
    private let onRefresh: (@Sendable () async -> Void)?

    public init(
        detail: PulsePostDetailContent,
        commentsState: CommentsLoadState = .loaded,
        composerText: Binding<String>,
        isSendingComment: Bool,
        replyingToName: String? = nil,
        selectedReactionEmoji: String? = nil,
        topBarAction: ContentDetailTopBarAction? = nil,
        topBarSecondaryAction: ContentDetailTopBarAction? = nil,
        nearbyProviders: [NearbyProviderRow] = [],
        onOpenBusiness: @escaping @MainActor (String) -> Void = { _ in },
        onBack: @escaping @MainActor () -> Void = {},
        onOpenProfile: @escaping @MainActor (String) -> Void = { _ in },
        onReactionTap: @escaping @MainActor (PostReactionKind) -> Void = { _ in },
        onEmojiSelected: (@MainActor (String) -> Void)? = nil,
        onSendTap: @escaping @MainActor () -> Void = {},
        onShowMoreReplies: @escaping @MainActor () -> Void = {},
        onCancelReply: (@MainActor () -> Void)? = nil,
        onCommentReply: (@MainActor (PostCommentRow) -> Void)? = nil,
        onCommentLike: (@MainActor (String) -> Void)? = nil,
        onCommentDelete: (@MainActor (String) -> Void)? = nil,
        onRefresh: (@Sendable () async -> Void)? = nil
    ) {
        self.detail = detail
        self.commentsState = commentsState
        _composerText = composerText
        self.isSendingComment = isSendingComment
        self.replyingToName = replyingToName
        self.selectedReactionEmoji = selectedReactionEmoji
        self.topBarAction = topBarAction
        self.topBarSecondaryAction = topBarSecondaryAction
        self.nearbyProviders = nearbyProviders
        self.onOpenBusiness = onOpenBusiness
        self.onBack = onBack
        self.onOpenProfile = onOpenProfile
        self.onReactionTap = onReactionTap
        self.onEmojiSelected = onEmojiSelected
        self.onSendTap = onSendTap
        self.onShowMoreReplies = onShowMoreReplies
        self.onCancelReply = onCancelReply
        self.onCommentReply = onCommentReply
        self.onCommentLike = onCommentLike
        self.onCommentDelete = onCommentDelete
        self.onRefresh = onRefresh
    }

    /// Opens the author's profile; nil (no tap) when the post came without its author's id.
    private var authorProfileTap: (@MainActor () -> Void)? {
        let userId = detail.post.userId
        guard !userId.isEmpty else { return nil }
        return { onOpenProfile(userId) }
    }

    public var body: some View {
        ContentDetailShell(
            title: "Post",
            onBack: onBack,
            topBarAction: topBarAction,
            topBarSecondaryAction: topBarSecondaryAction,
            onRefresh: onRefresh,
            header: {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    if detail.post.isRemovedByModerator {
                        RemovedPostNotice()
                            .padding(.horizontal, Spacing.s4)
                    }
                    PostAuthorHeader(
                        displayName: detail.authorDisplayName,
                        avatarURL: detail.authorAvatarURL,
                        isVerified: detail.authorVerified,
                        identity: detail.authorIdentity,
                        timeAndLocality: detail.timeAndLocality,
                        intent: detail.intent,
                        onAvatarTap: authorProfileTap
                    )
                    // How it ended, or when a Heads-up ends (Pulse S7).
                    if let status = detail.status {
                        PulsePostStatusPill(status: status, postId: detail.post.id)
                            .padding(.horizontal, Spacing.s4)
                    }
                }
            },
            body: {
                BodyReactionsBody(
                    body: detail.post.content,
                    media: detail.media,
                    intent: detail.intent,
                    reactions: detail.reactions,
                    onReactionTap: onReactionTap,
                    mediaLocationBadge: detail.post.locationName,
                    detailLine: detail.post.lostFoundDetailLine,
                    selectedReactionEmoji: selectedReactionEmoji,
                    onEmojiSelected: onEmojiSelected,
                    composerAvatarURL: nil,
                    composerAvatarName: "You",
                    composerText: $composerText,
                    isSending: isSendingComment,
                    onSendTap: onSendTap,
                    comments: detail.comments,
                    commentsState: commentsState,
                    postedRecently: detail.postedWithinHour,
                    hiddenReplyCount: detail.hiddenReplyCount,
                    onShowMoreReplies: onShowMoreReplies,
                    replyingToName: replyingToName,
                    onCancelReply: onCancelReply,
                    onCommentReply: detail.post.isRemovedByModerator ? nil : onCommentReply,
                    onCommentLike: onCommentLike,
                    onCommentDelete: onCommentDelete,
                    belowReactions: nearbyProviders.isEmpty
                        ? nil
                        : AnyView(
                            NearbyProvidersCard(
                                rows: nearbyProviders,
                                onOpenBusiness: onOpenBusiness
                            )
                        ),
                    repliesClosedNote: detail.post.isRemovedByModerator ? "Replies are off for this post." : nil
                ) { userId in
                    onOpenProfile(userId)
                }
            },
            cta: { InlineReplyCTA() }
        )
    }
}

/// Says why the author still sees a post that a moderator removed.
private struct RemovedPostNotice: View {
    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.shieldAlert, size: 16, color: Theme.Color.warning)
                .padding(.top, 1)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Removed by a moderator")
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.warning)
                Text("Only you can see this post. Neighbors can't see it or reply.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("pulsePostDetail-removedNotice")
    }
}
