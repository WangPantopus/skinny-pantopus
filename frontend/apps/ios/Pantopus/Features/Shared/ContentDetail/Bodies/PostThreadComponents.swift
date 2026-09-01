//
//  PostThreadComponents.swift
//  Pantopus
//
//  Composer, comment rows, and empty-thread quick replies for Pulse post detail.
//

// swiftlint:disable multiple_closures_with_trailing_closure

import SwiftUI

struct CommentComposer: View {
    let avatarName: String
    let avatarURL: URL?
    @Binding var text: String
    let placeholder: String
    let isFocusedPresentation: Bool
    let isSending: Bool
    let onSend: @MainActor () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            AvatarWithIdentityRing(
                name: avatarName,
                imageURL: avatarURL,
                identity: .personal,
                ringProgress: 1,
                size: 28
            )
            TextField(placeholder, text: $text)
                .font(.system(size: PantopusTextStyle.small.size))
                .foregroundStyle(Theme.Color.appText)
                .submitLabel(.send)
                .onSubmit { if canSend { onSend() } }
                .padding(.horizontal, Spacing.s3)
                .frame(height: 40)
                .background(Theme.Color.appSurface)
                .overlay {
                    RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                        .stroke(
                            isFocusedPresentation ? Theme.Color.primary500 : Theme.Color.appBorder,
                            lineWidth: isFocusedPresentation ? 1.5 : 1
                        )
                }
                .shadow(
                    color: isFocusedPresentation ? Theme.Color.primary500.opacity(0.13) : .clear,
                    radius: isFocusedPresentation ? 8 : 0,
                    x: 0,
                    y: 0
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
                .accessibilityIdentifier("pulsePostDetail-composer")
                .accessibilityLabel(placeholder)
            Button(action: { if canSend { onSend() } }) {
                ZStack {
                    if isSending {
                        ProgressView().tint(Theme.Color.appTextInverse)
                    } else {
                        Icon(
                            .send,
                            size: 18,
                            color: canSend || isFocusedPresentation ? Theme.Color.appTextInverse : Theme.Color.appTextMuted
                        )
                    }
                }
                .frame(width: 40, height: 40)
                .background(canSend || isFocusedPresentation ? Theme.Color.primary600 : Theme.Color.appSurfaceSunken)
                .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
            .accessibilityIdentifier("pulsePostDetail-sendComment")
            .accessibilityLabel("Send comment")
        }
    }

    private var canSend: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSending
    }
}

struct CommentRow: View {
    let comment: PostCommentRow
    let onAvatarTap: @MainActor () -> Void
    var onReply: (@MainActor () -> Void)?
    var onToggleLike: (@MainActor () -> Void)?
    var onDelete: (@MainActor () -> Void)?

    @State private var attachmentViewerIndex: MediaViewerSelection?

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Spacer().frame(width: CGFloat(comment.indentLevel) * 36)
            Button(action: { onAvatarTap() }) {
                AvatarWithIdentityRing(
                    name: comment.authorName,
                    imageURL: comment.authorAvatarURL,
                    identity: comment.authorIdentity,
                    ringProgress: 1,
                    size: comment.indentLevel > 0 ? 24 : 28
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("pulsePostDetail-commentAvatar-\(comment.id)")
            .accessibilityLabel("Open \(comment.authorName)'s profile")
            .frame(minWidth: 28, minHeight: 28)

            VStack(alignment: .leading, spacing: Spacing.s1) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(alignment: .firstTextBaseline, spacing: Spacing.s1) {
                        Button(action: { onAvatarTap() }) {
                            Text(comment.authorName)
                                .font(.system(size: PantopusTextStyle.caption.size, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Open \(comment.authorName)'s profile")
                        Text("·")
                            .font(.system(size: 10))
                            .foregroundStyle(Theme.Color.appTextMuted)
                        Text(comment.timestamp)
                            .font(.system(size: 10, weight: .regular))
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                    if !comment.body.isEmpty {
                        Text(comment.body)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextStrong)
                            .lineSpacing(3)
                    }
                    if !comment.attachmentURLs.isEmpty {
                        attachmentStrip
                    }
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .background(Theme.Color.appSurface)
                .overlay {
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                }
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))

                HStack(spacing: Spacing.s3) {
                    Button("Reply") { onReply?() }
                        .buttonStyle(.plain)
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(minHeight: 44, alignment: .center)
                        .accessibilityIdentifier("pulsePostDetail-reply-\(comment.id)")
                        .accessibilityLabel("Reply to \(comment.authorName)")

                    Button(action: { onToggleLike?() }) {
                        HStack(spacing: 3) {
                            Icon(
                                .heart,
                                size: 11,
                                color: comment.userReacted ? Theme.Color.error : Theme.Color.appTextSecondary
                            )
                            Text("\(comment.reactionCount)")
                                .font(.system(size: 10.5, weight: .regular))
                                .foregroundStyle(comment.userReacted ? Theme.Color.error : Theme.Color.appTextSecondary)
                        }
                    }
                    .buttonStyle(.plain)
                    .frame(minHeight: 44, alignment: .center)
                    .accessibilityIdentifier("pulsePostDetail-commentHeart-\(comment.id)")
                    .accessibilityLabel("Heart \(comment.authorName)'s reply, \(comment.reactionCount)")
                    .accessibilityAddTraits(comment.userReacted ? [.isButton, .isSelected] : .isButton)

                    if comment.isOwn, let onDelete {
                        Button("Delete") { onDelete() }
                            .buttonStyle(.plain)
                            .font(.system(size: 10.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.error)
                            .frame(minHeight: 44, alignment: .center)
                            .accessibilityIdentifier("pulsePostDetail-deleteComment-\(comment.id)")
                            .accessibilityLabel("Delete your reply")
                    }
                }
                .padding(.leading, Spacing.s1)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.vertical, 2)
    }

    /// Up to four square image attachments inside the bubble. Tapping
    /// one opens the shared full-screen viewer over all of them.
    private var attachmentStrip: some View {
        HStack(spacing: Spacing.s1) {
            ForEach(Array(comment.attachmentURLs.prefix(4).enumerated()), id: \.offset) { index, url in
                MediaStillImage(url: url)
                    .frame(width: 64, height: 64)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .contentShape(Rectangle())
                    .onTapGesture { attachmentViewerIndex = MediaViewerSelection(index: index) }
                    .accessibilityLabel("Comment photo \(index + 1)")
            }
        }
        .padding(.top, Spacing.s1)
        .fullScreenCover(item: $attachmentViewerIndex) { selection in
            MediaViewerView(
                items: comment.attachmentURLs.enumerated().map { index, url in
                    PostMediaItem(id: "\(comment.id)-\(index)", kind: .image, url: url)
                },
                startIndex: selection.index
            )
        }
    }
}

struct EmptyThreadState: View {
    let intent: PostIntent
    let prompts: [PostQuickReplyPrompt]
    let onPromptTap: @MainActor (PostQuickReplyPrompt) -> Void

    var body: some View {
        VStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .fill(Theme.Color.primary50)
                Icon(.messageSquarePlus, size: 22, color: Theme.Color.primary600)
            }
            .frame(width: 48, height: 48)
            .accessibilityHidden(true)

            VStack(spacing: Spacing.s1) {
                Text("Be the first to reply")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(subcopy)
                    .font(.system(size: 12.5, weight: .regular))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineSpacing(4)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 250)
            }

            FlexibleChipRows(prompts: prompts, onPromptTap: onPromptTap)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s6)
        .background(Theme.Color.appSurface)
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(
                    Theme.Color.appBorder,
                    style: StrokeStyle(lineWidth: 1, dash: [4, 4])
                )
        }
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pulsePostDetail-emptyThread")
    }

    private var subcopy: String {
        switch intent {
        case .lostFound:
            "A neighbor sighting, a tip, or even a \"looking\" matters in the first hour."
        case .ask:
            "A question, tip, or resource can get the thread moving."
        case .offer:
            "Ask a detail, claim interest, or help the offer find the right neighbor."
        case .event:
            "A quick RSVP or offer to bring something helps the host plan."
        case .share:
            "Add context, say thanks, or help other neighbors spot why it matters."
        case .alert:
            "Confirm what you are seeing nearby or share a useful next step."
        }
    }
}

private struct FlexibleChipRows: View {
    let prompts: [PostQuickReplyPrompt]
    let onPromptTap: @MainActor (PostQuickReplyPrompt) -> Void

    var body: some View {
        VStack(spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                ForEach(prompts.prefix(2)) { prompt in
                    QuickReplyChip(prompt: prompt) { onPromptTap(prompt) }
                }
            }
            if let last = prompts.dropFirst(2).first {
                QuickReplyChip(prompt: last) { onPromptTap(last) }
            }
        }
    }
}

private struct QuickReplyChip: View {
    let prompt: PostQuickReplyPrompt
    let onTap: @MainActor () -> Void

    var body: some View {
        Button(action: { onTap() }) {
            HStack(spacing: Spacing.s1) {
                Icon(prompt.icon, size: 12, color: Theme.Color.appTextSecondary)
                Text(prompt.label)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurfaceSunken)
            .overlay {
                RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("pulsePostDetail-quickReply-\(prompt.id)")
        .accessibilityLabel(prompt.label)
    }
}

public extension PostIntent {
    var quickReplyPrompts: [PostQuickReplyPrompt] {
        switch self {
        case .ask:
            [
                PostQuickReplyPrompt(label: "Try a question reply", icon: .helpCircle),
                PostQuickReplyPrompt(label: "Share a tip", icon: .lightbulb),
                PostQuickReplyPrompt(label: "Suggest a resource", icon: .share)
            ]
        case .lostFound:
            [
                PostQuickReplyPrompt(label: "I've seen it", icon: .eye),
                PostQuickReplyPrompt(label: "Have you checked X?", icon: .mapPin),
                PostQuickReplyPrompt(label: "DM me about details", icon: .messageCircle)
            ]
        case .offer:
            [
                PostQuickReplyPrompt(label: "I'm interested", icon: .hand),
                PostQuickReplyPrompt(label: "Can pick up today", icon: .check),
                PostQuickReplyPrompt(label: "Any details?", icon: .helpCircle)
            ]
        case .event:
            [
                PostQuickReplyPrompt(label: "I'm going", icon: .checkCircle),
                PostQuickReplyPrompt(label: "Can bring supplies", icon: .shoppingBag),
                PostQuickReplyPrompt(label: "What time?", icon: .clock)
            ]
        case .share:
            [
                PostQuickReplyPrompt(label: "Thanks for sharing", icon: .heart),
                PostQuickReplyPrompt(label: "I can add context", icon: .messageCircle),
                PostQuickReplyPrompt(label: "Saving this", icon: .bookmark)
            ]
        case .alert:
            [
                PostQuickReplyPrompt(label: "Thanks for the heads up", icon: .alertCircle),
                PostQuickReplyPrompt(label: "I can confirm", icon: .check),
                PostQuickReplyPrompt(label: "Need help?", icon: .helpCircle)
            ]
        }
    }
}
