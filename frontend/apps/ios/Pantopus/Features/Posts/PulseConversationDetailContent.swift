//
//  PulseConversationDetailContent.swift
//  Pantopus
//
//  The Pulse conversation inside the existing detail shell, with the
//  existing media viewer and composer. Replies never insert while reading.
//

import SwiftUI

@MainActor
struct PulseConversationDetailContent: View {
    @Bindable var viewModel: PulsePostDetailViewModel
    let content: PulseConversationContent
    let onBack: () -> Void
    let onOpenProfile: (String) -> Void
    let onMenu: (PulseReplyDTO) -> Void
    let onOfferRequests: () -> Void
    let onPrivateMessage: () -> Void
    let onFollowSettings: () -> Void
    @State private var focusRequest = 0

    private var card: PulsePageCard {
        content.post.pageCard()
    }

    private var repliesOpen: Bool {
        content.post.moderation?.state == nil || content.post.moderation?.state == "live"
    }

    var body: some View {
        ScrollViewReader { proxy in
            ContentDetailShell(
                title: "Conversation",
                onBack: onBack,
                topBarAction: ContentDetailTopBarAction(icon: .moreHorizontal, accessibilityLabel: "Post options") {
                    Task { @MainActor in viewModel.showsOverflowMenu = true }
                },
                topBarSecondaryAction: followAction,
                onRefresh: { await viewModel.refresh() },
                scalesType: true,
                scrollOverlay: newRepliesPill(proxy),
                header: { header },
                body: { replies }
            )
            .safeAreaInset(edge: .bottom, spacing: 0) { composer }
        }
    }

    private var followAction: ContentDetailTopBarAction? {
        guard repliesOpen else { return nil }
        let label = content.post.viewer?.following == true ? "Following" : "Follow"
        return ContentDetailTopBarAction(icon: .bookmark, accessibilityLabel: label, text: label) {
            Task { if await viewModel.followConversation() { onFollowSettings() } }
        }
    }

    private func newRepliesPill(_ proxy: ScrollViewProxy) -> AnyView? {
        let count = viewModel.waitingReplyCount
        guard count > 0 else { return nil }
        return AnyView(NewItemsPill(
            text: count == 1 ? "1 new reply" : "\(count) new replies",
            direction: .down,
            identifier: "pulseConversationNewReplies"
        ) {
            if let id = viewModel.revealWaitingReplies() {
                // Let SwiftUI lay out the newly revealed branch before scrolling.
                Task { @MainActor in
                    await Task.yield()
                    withAnimation { proxy.scrollTo(id, anchor: .top) }
                }
            }
        })
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            if let notice = viewModel.conversationRefreshNotice {
                RefreshNotice(text: notice) { Task { await viewModel.refresh() } }
            }
            PostAuthorHeader(
                displayName: card.authorName,
                avatarURL: content.post.author?.avatarUrl.flatMap(URL.init(string:)),
                isVerified: false,
                identity: .personal,
                timeAndLocality: card.meta,
                intent: .from(purpose: nil, postType: content.post.type),
                onAvatarTap: authorProfileTap,
                pulseCard: card
            )
            VStack(alignment: .leading, spacing: Spacing.s3) {
                if !card.text.isEmpty {
                    Text(card.text).pulseFont(.body)
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)
                }
                if !media.isEmpty {
                    PostMediaGridView(items: media, style: .regular, accessibilityID: "pulseConversationMedia")
                }
                if let about = card.aboutLine {
                    Text(about).pulseFont(.footnote).foregroundStyle(Theme.Color.appTextSecondary)
                }
                if let status = card.status {
                    PulsePostStatusPill(status: status, postId: card.id)
                }
                if repliesOpen { primaryAction }
            }
            .padding(.horizontal, Spacing.s4)
        }
    }

    private var media: [PostMediaItem] {
        content.post.media.enumerated().compactMap { index, item in
            guard item.type == "image", let raw = item.url, let url = URL(string: raw), !raw.isEmpty else { return nil }
            return PostMediaItem(
                id: "\(index)-\(raw)",
                kind: .image,
                url: url,
                thumbnailURL: item.thumbnailUrl.flatMap(URL.init(string:))
            )
        }
    }

    private var authorProfileTap: (@MainActor () -> Void)? {
        guard let id = card.authorId, !id.isEmpty else { return nil }
        return { onOpenProfile(id) }
    }

    @ViewBuilder private var primaryAction: some View {
        if content.post.type == "offer" {
            if viewModel.isOwner {
                Button("Requests", action: onOfferRequests)
                    .pulseFont(.button)
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("pulseOfferOpenRequests")
            } else {
                Button(viewModel.offerActionLabel) { Task { await viewModel.requestConversationOffer() } }
                    .pulseFont(.button)
                    .frame(minHeight: 44)
                    .disabled(!viewModel.canRequestOffer)
                    .accessibilityIdentifier("pulseOfferRequest")
            }
        } else if card.actionKind == "its_mine", !viewModel.isOwner, card.authorId != nil {
            Button("It's mine", action: onPrivateMessage)
                .pulseFont(.button)
                .frame(minHeight: 44)
                .disabled(!viewModel.pendingConversationActions.isEmpty)
                .accessibilityIdentifier("pulseLostFoundPrivateMessage")
        } else if ["answer", "reply", "going", "seen_it"].contains(card.actionKind ?? "reply") {
            PlanFlowLayout(spacing: Spacing.s3) {
                Button {
                    if card.actionKind == "going" || card.actionKind == "seen_it" {
                        Task { await viewModel.toggleConversationPrimaryAction() }
                    } else { focusRequest += 1 }
                } label: {
                    HStack(spacing: Spacing.s1) {
                        if card.actionDone {
                            Icon(.check, size: 16, color: Theme.Color.primaryInk).accessibilityHidden(true)
                        }
                        Text(card.actionLabel ?? "Reply")
                    }
                    .pulseFont(.button)
                    .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .foregroundStyle(Theme.Color.primaryInk)
                .disabled(!viewModel.pendingConversationActions.isEmpty)
                .accessibilityIdentifier("pulseConversationPrimaryAction")
                if let count = card.goingText {
                    Text(count).pulseFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
        }
    }

    private var replies: some View {
        PulseConversationRepliesView(
            content: content,
            currentUserId: viewModel.currentUserId,
            expandedBranches: viewModel.expandedConversationBranches,
            pendingReplies: viewModel.pendingConversationActions.isEmpty ? [] : Set(content.replies.map(\.id)),
            onExpand: viewModel.expandConversationBranch,
            onOpenProfile: onOpenProfile,
            onReply: { reply in
                viewModel.beginReply(to: reply)
                focusRequest += 1
            },
            onHelpful: { reply in Task { await viewModel.markConversationReplyHelpful(reply) } },
            onThank: { reply in Task { await viewModel.thankConversationReply(reply) } },
            onMenu: onMenu
        )
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if repliesOpen {
                if let target = viewModel.replyTarget {
                    HStack {
                        Text("Replying to \(target.authorName)").pulseFont(.footnote)
                        Spacer(minLength: 0)
                        Button { viewModel.cancelReply() } label: {
                            Icon(.x, size: 16, color: Theme.Color.appTextSecondary).frame(width: 44, height: 44)
                        }
                        .accessibilityLabel("Cancel reply")
                    }
                }
                CommentComposer(
                    avatarName: "You",
                    avatarURL: nil,
                    text: $viewModel.composerText,
                    placeholder: "Write a reply…",
                    isFocusedPresentation: false,
                    isSending: viewModel.isSendingComment,
                    onSend: { Task { await viewModel.sendComment() } },
                    focusRequest: focusRequest
                )
            } else {
                Text("Replies are off for this post.").pulseFont(.small)
            }
        }
        .foregroundStyle(Theme.Color.appTextSecondary)
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) { Divider() }
    }
}
