//
//  PulseConversationRepliesView.swift
//  Pantopus
//
//  Stable, oldest-first branches. Expanding a branch changes only that
//  branch; the draft and replies waiting behind the new-items pill stay put.
//

import SwiftUI

struct PulseConversationRepliesView: View {
    let content: PulseConversationContent
    let currentUserId: String?
    let expandedBranches: Set<String>
    let pendingReplies: Set<String>
    let onExpand: (String) -> Void
    let onOpenProfile: (String) -> Void
    let onReply: (PulseReplyDTO) -> Void
    let onHelpful: (PulseReplyDTO) -> Void
    let onThank: (PulseReplyDTO) -> Void
    let onMenu: (PulseReplyDTO) -> Void

    var body: some View {
        LazyVStack(alignment: .leading, spacing: Spacing.s3) {
            Text(content.replyCountText)
                .pulseFont(.footnoteStrong)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            if content.replies.isEmpty {
                Text("Be the first to reply")
                    .pulseFont(.body)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, Spacing.s4)
            }
            ForEach(content.branches) { branch in
                if let root = branch.root {
                    row(root, indented: false)
                } else {
                    Text("Reply removed")
                        .pulseFont(.small)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(Spacing.s3)
                        .id(branch.id)
                }
                ForEach(branch.shownDescendants(expanded: expandedBranches.contains(branch.id))) { reply in
                    row(reply, indented: true)
                }
                if !expandedBranches.contains(branch.id), let label = branch.expansionLabel {
                    Button(label) { onExpand(branch.id) }
                        .pulseFont(.smallStrong)
                        .foregroundStyle(Theme.Color.primaryInk)
                        .frame(minHeight: 44)
                        .padding(.leading, Spacing.s5)
                        .accessibilityIdentifier("pulseExpandBranch_\(branch.id)")
                }
            }
        }
        .padding(.horizontal, Spacing.s4)
    }

    private func row(_ reply: PulseReplyDTO, indented: Bool) -> some View {
        PulseConversationReplyView(
            reply: reply,
            replyingTo: content.replyingToName(reply),
            isIndented: indented,
            isOwn: currentUserId != nil && reply.author?.id == currentUserId,
            canMarkHelpful: content.post.type == "ask_local" && content.post.viewer?.canMarkHelpful == true,
            canReply: content.post.moderation?.state == nil || content.post.moderation?.state == "live",
            isPending: pendingReplies.contains(reply.id),
            onOpenProfile: onOpenProfile,
            onReply: { onReply(reply) },
            onHelpful: { onHelpful(reply) },
            onThank: { onThank(reply) },
            onMenu: { onMenu(reply) }
        )
        .id(reply.id)
    }
}
