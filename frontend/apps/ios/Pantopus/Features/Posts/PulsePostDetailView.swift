//
//  PulsePostDetailView.swift
//  Pantopus
//
//  Pulse post detail screen wired through `ContentDetailShell` with
//  `PostAuthorHeader` + `BodyReactionsBody` + `InlineReplyCTA`.
//

import SwiftUI

/// Pulse post detail entry point.
@MainActor
public struct PulsePostDetailView: View {
    @State private var viewModel: PulsePostDetailViewModel
    @State private var showsShareSheet = false
    @State private var showsReportDialog = false
    @State private var showsDeleteConfirm = false
    @State private var commentPendingDelete: String?
    @State private var replyMenu: PulseReplyDTO?
    @State private var replyPendingReport: PulseReplyDTO?
    @State private var isVisible = false
    @State private var showsOfferRequests = false
    @State private var showsReadScopeConfirm = false
    @State private var privateMessage: PulsePrivateMessageDestination?
    @Environment(\.scenePhase) private var scenePhase
    private let onBack: @MainActor () -> Void
    private let onOpenProfile: @MainActor (String) -> Void
    private let onEdit: @MainActor (String) -> Void
    private let onContentLoaded: @MainActor () -> Void
    /// Tap-through from a "Nearby Providers" row. Carries the business
    /// *username* (the `/business/:username` public-profile key).
    private let onOpenBusiness: @MainActor (String) -> Void

    public init(
        postId: String,
        currentUserId: String? = nil,
        onBack: @escaping @MainActor () -> Void,
        onOpenProfile: @escaping @MainActor (String) -> Void = { _ in },
        onEdit: @escaping @MainActor (String) -> Void = { _ in },
        onOpenBusiness: @escaping @MainActor (String) -> Void = { _ in },
        onContentLoaded: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(initialValue: PulsePostDetailViewModel(
            postId: postId,
            currentUserId: currentUserId
        ))
        self.onBack = onBack
        self.onOpenProfile = onOpenProfile
        self.onEdit = onEdit
        self.onOpenBusiness = onOpenBusiness
        self.onContentLoaded = onContentLoaded
    }

    public var body: some View {
        @Bindable var bindable = viewModel
        return replyDialogs
            .confirmationDialog(
                "Post options",
                isPresented: $bindable.showsOverflowMenu,
                titleVisibility: .hidden
            ) {
                Button(viewModel.isSaved ? "Remove bookmark" : "Save post") {
                    Task { await viewModel.toggleSave() }
                }
                if viewModel.conversation != nil {
                    if viewModel.canShareConversation {
                        Button("Share post", action: requestShare)
                            .disabled(viewModel.isPreparingShare)
                    }
                } else if viewModel.canSharePost {
                    Button(viewModel.isReposted ? "Undo repost" : "Repost") {
                        Task { await viewModel.toggleRepost() }
                    }
                }
                if viewModel.isOwner {
                    if viewModel.canNarrowAudience {
                        Button("Who can read") { showsReadScopeConfirm = true }
                            .accessibilityIdentifier("pulseConversationReadScope")
                    }
                    Button("Edit post") {
                        if case let .loaded(detail) = viewModel.state {
                            onEdit(detail.post.id)
                        } else if let detail = viewModel.conversation {
                            onEdit(detail.post.id)
                        }
                    }
                    if viewModel.canKeepAskOpen {
                        Button("Keep open 7 more days") {
                            Task { await viewModel.keepAskOpen() }
                        }
                        .accessibilityIdentifier("pulseAskKeepOpen")
                    }
                    if viewModel.canCloseAsk {
                        Button("Close") { viewModel.showsCloseAskConfirm = true }
                            .accessibilityIdentifier("pulseAskClose")
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
            .alert("Close this question?", isPresented: $bindable.showsCloseAskConfirm) {
                Button("Close", role: .destructive) {
                    Task { await viewModel.closeAsk() }
                }
                .accessibilityIdentifier("pulseAskCloseConfirm")
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("It leaves Pulse. You can restore it from My posts.")
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
            .sheet(isPresented: $showsShareSheet) {
                if let url = viewModel.shareURL {
                    SystemShareSheet(items: [url])
                }
            }
            .sheet(isPresented: $showsOfferRequests) {
                PulseOfferRequestsSheet(viewModel: viewModel)
            }
            .sheet(item: $privateMessage) { destination in
                PulsePrivateMessageSheet(destination: destination)
            }
            .sheet(isPresented: $showsReadScopeConfirm) {
                PulseAudiencePickerView(viewModel: viewModel)
            }
    }

    private var baseContent: some View {
        ZStack(alignment: .bottom) {
            content
            if let toast = viewModel.toastMessage {
                ToastView(message: ToastMessage(text: toast, kind: viewModel.toastKind))
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
        .onAppear { isVisible = true }
        .onDisappear {
            isVisible = false
            showsShareSheet = false
        }
        .task(id: isVisible && scenePhase == .active) {
            guard isVisible, scenePhase == .active else { return }
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(60)) } catch { return }
                await viewModel.pollConversationReplies()
            }
        }
        .onChange(of: viewModel.state) { _, state in
            if !viewModel.canSharePost { showsShareSheet = false }
            switch state {
            case .loaded, .conversation: onContentLoaded()
            default: break
            }
        }
        .onChange(of: viewModel.didDeletePost) { _, deleted in
            if deleted { onBack() }
        }
    }

    private var replyDialogs: some View {
        baseContent
            .confirmationDialog(
                "Reply options",
                isPresented: Binding(get: { replyMenu != nil }, set: { if !$0 { replyMenu = nil } }),
                titleVisibility: .hidden,
                presenting: replyMenu
            ) { reply in
                if let id = reply.author?.id, id == viewModel.currentUserId {
                    Button("Delete reply", role: .destructive) { commentPendingDelete = reply.id }
                } else {
                    Button("Report reply", role: .destructive) { replyPendingReport = reply }
                    if let id = reply.author?.id, !id.isEmpty {
                        Button("Mute \(reply.author?.displayName ?? "this person")") {
                            Task { await viewModel.muteConversationAuthor(id) }
                        }
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
            .confirmationDialog(
                "Why are you reporting this reply?",
                isPresented: Binding(get: { replyPendingReport != nil }, set: { if !$0 { replyPendingReport = nil } }),
                titleVisibility: .visible,
                presenting: replyPendingReport
            ) { reply in
                ForEach(Self.reportReasons, id: \.token) { reason in
                    Button(reason.label) { Task { await viewModel.reportConversationReply(reply, reason: reason.token) } }
                }
                Button("Cancel", role: .cancel) {}
            }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            LoadingLayout(onBack: onBack)
        case let .loaded(detail):
            loadedLayout(detail)
        case let .conversation(detail):
            PulseConversationDetailContent(
                viewModel: viewModel,
                content: detail,
                onBack: onBack,
                onOpenProfile: onOpenProfile,
                onMenu: { replyMenu = $0 },
                onOfferRequests: { showsOfferRequests = true },
                onPrivateMessage: {
                    Task {
                        let destination = await viewModel.prepareLostFoundMessage()
                        if isVisible, scenePhase == .active { privateMessage = destination }
                    }
                }
            )
        case let .error(message, retryable):
            if retryable {
                ErrorLayout(message: message, onBack: onBack) {
                    Task { await viewModel.refresh() }
                }
            } else {
                ErrorLayout(message: message, onBack: onBack, onRetry: nil)
            }
        }
    }

    private func loadedLayout(_ detail: PulsePostDetailContent) -> some View {
        PulsePostDetailLoadedContent(
            detail: detail,
            commentsState: viewModel.commentsState,
            composerText: Binding(
                get: { viewModel.composerText },
                set: { viewModel.composerText = $0 }
            ),
            isSendingComment: viewModel.isSendingComment,
            replyingToName: viewModel.replyTarget?.authorName,
            selectedReactionEmoji: viewModel.selectedReactionEmoji,
            topBarAction: overflowAction,
            topBarSecondaryAction: viewModel.canSharePost ? shareAction : nil,
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
        ) { Task { @MainActor in requestShare() } }
    }

    private func requestShare() {
        Task {
            if await viewModel.authorizeShare(), isVisible, scenePhase == .active {
                showsShareSheet = true
            }
        }
    }
}

extension PulsePostDetailView {
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
    /// Nil when Try again can't help (the post is gone or hidden); Back stays.
    let onRetry: (@MainActor () -> Void)?

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ContentDetailTopBar(title: "Post", onBack: onBack, action: nil)
            EmptyState(
                icon: .alertCircle,
                headline: "Couldn't load this post",
                subcopy: message,
                cta: onRetry == nil ? nil : EmptyState.CTA(title: "Try again") { await MainActor.run { onRetry?() } }
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

extension PostDetailDTO {
    /// "Lost · Contact: Phone 5555550123" for a Lost & Found post, as the web
    /// card and post page show it; nil for other posts. The contact is stored
    /// as `dm`, `comment`, `phone` or `phone|<digits>`.
    var lostFoundDetailLine: String? {
        guard postType == "lost_found" else { return nil }
        var parts: [String] = []
        switch lostFoundType {
        case "lost": parts.append("Lost")
        case "found": parts.append("Found")
        default: break
        }
        if let stored = lostFoundContactPref {
            let pieces = stored.split(separator: "|", maxSplits: 1).map(String.init)
            if let key = pieces.first, let pref = PulseLostFoundContactPref(rawValue: key) {
                let number = pieces.count > 1 ? pieces[1] : ""
                parts.append(pref == .phone && !number.isEmpty ? "Contact: \(pref.label) \(number)" : "Contact: \(pref.label)")
            }
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}
