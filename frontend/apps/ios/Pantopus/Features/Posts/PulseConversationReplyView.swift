//
//  PulseConversationReplyView.swift
//  Pantopus
//
//  A conversation reply at either of the two visible levels. Removed
//  replies keep their place without exposing their former text or author.
//

import SwiftUI

struct PulseConversationReplyView: View {
    let reply: PulseReplyDTO
    let replyingTo: String?
    let isIndented: Bool
    let isOwn: Bool
    let canMarkHelpful: Bool
    let canReply: Bool
    let isPending: Bool
    let onOpenProfile: (String) -> Void
    let onReply: () -> Void
    let onHelpful: () -> Void
    let onThank: () -> Void
    let onMenu: () -> Void

    private var authorName: String {
        let name = reply.author?.displayName ?? ""
        return name.isEmpty ? "A neighbor" : name
    }

    private var meta: String {
        let time = PulsePageWords.relativeTime(PulsePageWords.parseDate(reply.createdAt))
        return [reply.author?.distanceText, time.isEmpty ? nil : time, reply.edited ? "Edited" : nil]
            .compactMap(\.self).filter { !$0.isEmpty }.joined(separator: " · ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if reply.removed {
                Text("Reply removed")
                    .pulseFont(.small)
                    .foregroundStyle(Theme.Color.appTextMuted)
            } else {
                heading
                if let replyingTo {
                    Text("Replying to \(replyingTo)")
                        .pulseFont(.footnote)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                if let text = reply.text, !text.isEmpty {
                    Text(text)
                        .pulseFont(.body)
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if reply.helpful {
                    HStack(spacing: Spacing.s1) {
                        Icon(.check, size: 14, color: Theme.Color.success).accessibilityHidden(true)
                        Text(helpfulText)
                    }
                    .pulseFont(.footnoteStrong)
                    .foregroundStyle(Theme.Color.success)
                }
                actions
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        }
        .padding(.leading, isIndented ? Spacing.s5 : 0)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pulseReply_\(reply.id)")
    }

    private var helpfulText: String {
        guard let name = reply.helpfulTo, !name.isEmpty else { return "Helpful" }
        return "Helpful to \(name)"
    }

    private var heading: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            PlanFlowLayout(spacing: Spacing.s2) {
                if let id = reply.author?.id, !id.isEmpty {
                    Button(authorName) { onOpenProfile(id) }
                        .pulseFont(.button)
                        .frame(minHeight: 44)
                        .buttonStyle(.plain)
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityLabel("Open \(authorName)'s profile")
                } else {
                    Text(authorName).pulseFont(.button).foregroundStyle(Theme.Color.appText)
                }
                if let raw = reply.author?.label, let label = PulseAuthorLabel(rawValue: raw) {
                    PulseAuthorLabelChip(label: label)
                }
                if !meta.isEmpty {
                    Text(meta).pulseFont(.footnote).foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onMenu) {
                Icon(.moreHorizontal, size: 18, color: Theme.Color.appTextSecondary)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Reply options")
            .accessibilityIdentifier("pulseReplyMenu_\(reply.id)")
        }
    }

    private var actions: some View {
        PlanFlowLayout(spacing: Spacing.s3) {
            Button("Reply", action: onReply)
                .frame(minHeight: 44)
                .disabled(!canReply)
                .accessibilityLabel("Reply to \(authorName)")
                .accessibilityIdentifier("pulseReplyReply_\(reply.id)")
            if !isOwn, reply.canThank || reply.thankedByViewer {
                Button(reply.thankedByViewer ? "Thanked" : "Thank", action: onThank)
                    .frame(minHeight: 44)
                    .disabled(reply.thankedByViewer || isPending)
                    .accessibilityIdentifier("pulseReplyThank_\(reply.id)")
            }
            if canMarkHelpful {
                Button(reply.helpful ? "Unmark Helpful" : "Mark Helpful", action: onHelpful)
                    .frame(minHeight: 44)
                    .disabled(isPending)
                    .accessibilityIdentifier("pulseReplyHelpful_\(reply.id)")
            }
        }
        .pulseFont(.footnoteStrong)
        .buttonStyle(.plain)
        .foregroundStyle(Theme.Color.primaryInk)
        .frame(minHeight: 44)
    }
}
