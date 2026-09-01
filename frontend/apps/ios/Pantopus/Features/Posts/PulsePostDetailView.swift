//
//  PulsePostDetailView.swift
//  Pantopus
//
//  Pulse post detail screen wired through `ContentDetailShell` with
//  `PostAuthorHeader` + `BodyReactionsBody` + `InlineReplyCTA`.
//

import SwiftUI

// swiftlint:disable multiple_closures_with_trailing_closure

/// Pulse post detail entry point.
@MainActor
public struct PulsePostDetailView: View {
    @State private var viewModel: PulsePostDetailViewModel
    @State private var showsShareSheet = false
    @State private var showsReportDialog = false
    @State private var showsDeleteConfirm = false
    @State private var commentPendingDelete: String?
    private let onBack: @MainActor () -> Void
    private let onOpenProfile: @MainActor (String) -> Void
    private let onEdit: @MainActor (String) -> Void
    /// Tap-through from a "Nearby Providers" row. Carries the business
    /// *username* (the `/business/:username` public-profile key).
    private let onOpenBusiness: @MainActor (String) -> Void

    public init(
        postId: String,
        currentUserId: String? = nil,
        onBack: @escaping @MainActor () -> Void,
        onOpenProfile: @escaping @MainActor (String) -> Void = { _ in },
        onEdit: @escaping @MainActor (String) -> Void = { _ in },
        onOpenBusiness: @escaping @MainActor (String) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: PulsePostDetailViewModel(
            postId: postId,
            currentUserId: currentUserId
        ))
        self.onBack = onBack
        self.onOpenProfile = onOpenProfile
        self.onEdit = onEdit
        self.onOpenBusiness = onOpenBusiness
    }

    public var body: some View {
        @Bindable var bindable = viewModel
        return ZStack(alignment: .bottom) {
            content
            if let toast = viewModel.toastMessage {
                ToastView(message: ToastMessage(text: toast, kind: .error))
                    .padding(.bottom, Spacing.s10)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .task(id: toast) {
                        try? await Task.sleep(nanoseconds: 2_500_000_000)
                        viewModel.toastMessage = nil
                    }
            }
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("pulsePostDetail")
        .task { await viewModel.load() }
        .task { await viewModel.loadNearbyProviders() }
        .onChange(of: viewModel.didDeletePost) { _, deleted in
            if deleted { onBack() }
        }
        .confirmationDialog(
            "Post options",
            isPresented: $bindable.showsOverflowMenu,
            titleVisibility: .hidden
        ) {
            Button(viewModel.isSaved ? "Remove bookmark" : "Save post") {
                Task { await viewModel.toggleSave() }
            }
            Button(viewModel.isReposted ? "Undo repost" : "Repost") {
                Task { await viewModel.toggleRepost() }
            }
            if viewModel.isOwner {
                Button("Edit post") {
                    if case let .loaded(detail) = viewModel.state { onEdit(detail.post.id) }
                }
                Button("Delete post", role: .destructive) { showsDeleteConfirm = true }
            } else {
                Button("Report post", role: .destructive) { showsReportDialog = true }
            }
            Button("Cancel", role: .cancel) {}
        }
        .confirmationDialog(
            "Why are you reporting this post?",
            isPresented: $showsReportDialog,
            titleVisibility: .visible
        ) {
            ForEach(Self.reportReasons, id: \.token) { reason in
                Button(reason.label) {
                    Task { await viewModel.reportPost(reason: reason.token) }
                }
            }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Delete this post?", isPresented: $showsDeleteConfirm) {
            Button("Delete", role: .destructive) {
                Task { await viewModel.deletePost() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This can't be undone.")
        }
        .alert(
            "Delete this reply?",
            isPresented: Binding(
                get: { commentPendingDelete != nil },
                set: { if !$0 { commentPendingDelete = nil } }
            )
        ) {
            Button("Delete", role: .destructive) {
                if let id = commentPendingDelete {
                    commentPendingDelete = nil
                    Task { await viewModel.deleteComment(commentId: id) }
                }
            }
            Button("Cancel", role: .cancel) { commentPendingDelete = nil }
        }
        .sheet(
            isPresented: $showsShareSheet,
            onDismiss: { Task { await viewModel.recordShare() } }
        ) {
            if let url = viewModel.shareURL {
                SystemShareSheet(items: [url])
            }
        }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            LoadingLayout(onBack: onBack)
        case let .loaded(detail):
            loadedLayout(detail)
        case let .error(message):
            ErrorLayout(message: message, onBack: onBack) {
                Task { await viewModel.refresh() }
            }
        }
    }

    private func loadedLayout(_ detail: PulsePostDetailContent) -> some View {
        PulsePostDetailLoadedContent(
            detail: detail,
            composerText: Binding(
                get: { viewModel.composerText },
                set: { viewModel.composerText = $0 }
            ),
            isSendingComment: viewModel.isSendingComment,
            replyingToName: viewModel.replyTarget?.authorName,
            selectedReactionEmoji: viewModel.selectedReactionEmoji,
            topBarAction: overflowAction,
            topBarSecondaryAction: shareAction,
            nearbyProviders: viewModel.nearbyProviders,
            onOpenBusiness: onOpenBusiness,
            onBack: onBack,
            onOpenProfile: onOpenProfile,
            onReactionTap: { kind in Task { await viewModel.tapReaction(kind) } },
            onEmojiSelected: { emoji in Task { await viewModel.pickReactionEmoji(emoji) } },
            onSendTap: { Task { await viewModel.sendComment() } },
            onShowMoreReplies: { viewModel.showMoreReplies() },
            onCancelReply: { viewModel.cancelReply() },
            onCommentReply: { comment in viewModel.beginReply(to: comment) },
            onCommentLike: { id in Task { await viewModel.toggleCommentLike(commentId: id) } },
            onCommentDelete: { id in commentPendingDelete = id },
            onRefresh: { [viewModel] in await viewModel.refresh() }
        )
    }

    private var overflowAction: ContentDetailTopBarAction {
        ContentDetailTopBarAction(
            icon: .moreHorizontal,
            accessibilityLabel: "Post options"
        ) { Task { @MainActor in viewModel.showsOverflowMenu = true } }
    }

    private var shareAction: ContentDetailTopBarAction {
        ContentDetailTopBarAction(
            icon: .share,
            accessibilityLabel: "Share post"
        ) { Task { @MainActor in showsShareSheet = true } }
    }

    /// `reportPostSchema` reasons (`backend/routes/posts.js:339`).
    private static let reportReasons: [(token: String, label: String)] = [
        ("spam", "Spam"),
        ("harassment", "Harassment"),
        ("inappropriate", "Inappropriate content"),
        ("misinformation", "Misinformation"),
        ("safety", "Safety concern"),
        ("other", "Something else")
    ]
}

@MainActor
public struct PulsePostDetailLoadedContent: View {
    private let detail: PulsePostDetailContent
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

    public var body: some View {
        ContentDetailShell(
            title: "Post",
            onBack: onBack,
            topBarAction: topBarAction,
            topBarSecondaryAction: topBarSecondaryAction,
            onRefresh: onRefresh,
            header: {
                PostAuthorHeader(
                    displayName: detail.authorDisplayName,
                    avatarURL: detail.authorAvatarURL,
                    isVerified: detail.authorVerified,
                    identity: detail.authorIdentity,
                    timeAndLocality: detail.timeAndLocality,
                    intent: detail.intent
                ) { onOpenProfile(detail.post.userId) }
            },
            body: {
                BodyReactionsBody(
                    body: detail.post.content,
                    media: detail.media,
                    intent: detail.intent,
                    reactions: detail.reactions,
                    onReactionTap: onReactionTap,
                    mediaLocationBadge: detail.post.locationName,
                    selectedReactionEmoji: selectedReactionEmoji,
                    onEmojiSelected: onEmojiSelected,
                    composerAvatarURL: nil,
                    composerAvatarName: "You",
                    composerText: $composerText,
                    isSending: isSendingComment,
                    onSendTap: onSendTap,
                    comments: detail.comments,
                    hiddenReplyCount: detail.hiddenReplyCount,
                    onShowMoreReplies: onShowMoreReplies,
                    replyingToName: replyingToName,
                    onCancelReply: onCancelReply,
                    onCommentReply: onCommentReply,
                    onCommentLike: onCommentLike,
                    onCommentDelete: onCommentDelete,
                    belowReactions: nearbyProviders.isEmpty
                        ? nil
                        : AnyView(
                            NearbyProvidersCard(
                                rows: nearbyProviders,
                                onOpenBusiness: onOpenBusiness
                            )
                        )
                ) { userId in
                    onOpenProfile(userId)
                }
            },
            cta: { InlineReplyCTA() }
        )
    }
}

private struct LoadingLayout: View {
    let onBack: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ContentDetailTopBar(title: "Post", onBack: onBack, action: nil)
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(width: 220, height: 22, cornerRadius: Radii.sm)
                Shimmer(height: 16, cornerRadius: Radii.sm)
                Shimmer(height: 16, cornerRadius: Radii.sm)
                Shimmer(height: 160, cornerRadius: Radii.lg)
                HStack(spacing: Spacing.s2) {
                    Shimmer(width: 80, height: 32, cornerRadius: Radii.pill)
                    Shimmer(width: 80, height: 32, cornerRadius: Radii.pill)
                    Shimmer(width: 80, height: 32, cornerRadius: Radii.pill)
                }
            }
            .padding(Spacing.s4)
            Spacer()
        }
        .background(Theme.Color.appBg)
    }
}

private struct ErrorLayout: View {
    let message: String
    let onBack: @MainActor () -> Void
    let onRetry: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ContentDetailTopBar(title: "Post", onBack: onBack, action: nil)
            EmptyState(
                icon: .alertCircle,
                headline: "Couldn't load this post",
                subcopy: message,
                cta: EmptyState.CTA(title: "Try again") { await MainActor.run { onRetry() } }
            )
            .frame(maxHeight: .infinity)
        }
        .background(Theme.Color.appBg)
    }
}

#Preview {
    @Previewable @State var composer = ""
    PulsePostDetailLoadedContent(
        detail: PulsePostDetailSampleData.populated,
        composerText: $composer,
        isSendingComment: false
    )
}
