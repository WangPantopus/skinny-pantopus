//
//  NeighborMessageReceivedView.swift
//  Pantopus
//
//  D2 — a received verified-neighbor message. No identity is shown ("a
//  verified neighbor nearby"); the body is the neutral template the sender
//  picked. Replies are templated and stay anonymous both ways. Feedback,
//  block, and report are calm, in-control, and never notify the sender.
//  Ported from `place-message-received.jsx` / web `…ReceivedView`.
//

import SwiftUI

struct NeighborMessageReceivedView: View {
    @State var viewModel: NeighborMessageReceivedViewModel
    var onBack: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            PlaceDetailHeader(
                title: "Message",
                address: "Inbox · verified neighbors",
                onBack: onBack
            )
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .task { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            ReceivedSkeleton()
        case .notFound:
            EmptyState(
                icon: .helpCircle,
                headline: "Message not found",
                subcopy: "This message may have been removed, or it isn't addressed to you.",
                cta: EmptyState.CTA(title: "Back to Place") { onBack() }
            )
        case let .error(message):
            ErrorState(message: message) { await viewModel.load() }
        case let .loaded(message):
            loaded(message)
        }
    }

    private func loaded(_ message: ReceivedNeighborMessage) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ReceivedCard(message: message)

                PlaceDetailSectionLabel(text: "Reply")
                replySection(message)

                PlaceDetailSectionLabel(text: "Manage this message")
                ManageCard(
                    flags: viewModel.flags,
                    onNotHelpful: { Task { await viewModel.markNotHelpful() } },
                    onBlock: { Task { await viewModel.block() } },
                    onReport: { Task { await viewModel.report() } }
                )

                HStack(alignment: .top, spacing: 8) {
                    Icon(.shield, size: 14, strokeWidth: 2, color: Theme.Color.appTextMuted)
                    Text("You're in control. This neighbor doesn't know who you are, and you can stop messages from them at any time.")
                        .font(.system(size: 12.5))
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 2)
                .padding(.top, 14)
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
    }

    @ViewBuilder
    private func replySection(_ message: ReceivedNeighborMessage) -> some View {
        let hasReply = message.reply != nil && !viewModel.editingReply
        let canReply = message.canReply && !viewModel.flags.blocked
        if hasReply, let reply = message.reply {
            ReplySent(messageBody: reply.body) { viewModel.startEditingReply() }
        } else if canReply {
            QuickReplyBar(
                replies: viewModel.replies,
                replying: viewModel.replying
            ) { id in Task { await viewModel.reply(id) } }
        } else {
            RepliesOffNote()
        }
    }
}

// MARK: - Received card

private struct ReceivedCard: View {
    let message: ReceivedNeighborMessage

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(Theme.Color.appSurfaceSunken)
                        .overlay(Circle().strokeBorder(Theme.Color.appBorder, lineWidth: 1))
                    Icon(.shieldCheck, size: 23, strokeWidth: 2, color: Theme.Color.home)
                }
                .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 1) {
                    Text("From a verified neighbor nearby")
                        .font(.system(size: 16, weight: .bold))
                        .kerning(-0.19)
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("On your block · \(neighborRelativeTime(message.createdAt))")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                Spacer(minLength: 0)
                PlaceChip(model: PlaceChipModel(tone: .success, text: "Verified", icon: .shieldCheck))
            }
            Text(message.body)
                .pantopusTextStyle(.body)
                .lineSpacing(4)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 16)
            Divider().overlay(Theme.Color.appBorderSubtle).padding(.top, 16)
            HStack(alignment: .top, spacing: 8) {
                Icon(.eyeOff, size: 14, strokeWidth: 2, color: Theme.Color.appTextMuted)
                Text("They chose this from a set of pre-written notes — they can't type freely, and they don't know who you are either.")
                    .font(.system(size: 12.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 14)
        }
        .padding(17)
        .placeCard()
    }
}

// MARK: - Quick-reply bar

private struct QuickReplyBar: View {
    let replies: [NeighborReplyTemplate]
    let replying: Bool
    var onReply: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            PlaceFlowLayout(spacing: 8) {
                ForEach(replies) { reply in
                    Button { onReply(reply.id) } label: {
                        Text(reply.body)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.Color.primary600)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(Theme.Color.infoBg)
                            .clipShape(Capsule())
                            .overlay(Capsule().strokeBorder(Theme.Color.infoLight, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(replying)
                    .opacity(replying ? 0.6 : 1)
                }
            }
            HStack(spacing: 6) {
                Icon(.eyeOff, size: 13, strokeWidth: 2, color: Theme.Color.appTextMuted)
                Text("Replies are templated and stay anonymous.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
    }
}

private struct ReplySent: View {
    let messageBody: String
    var onChange: () -> Void

    var bodyContent: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .fill(Theme.Color.homeBg)
                        .overlay(
                            RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .strokeBorder(Theme.Color.successLight, lineWidth: 1)
                        )
                    Icon(.check, size: 19, strokeWidth: 2.75, color: Theme.Color.home)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Reply sent")
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("\u{201C}\(messageBody)\u{201D}")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
            }
            Divider().overlay(Theme.Color.successLight).padding(.vertical, 12)
            HStack {
                HStack(spacing: 6) {
                    Icon(.eyeOff, size: 13, strokeWidth: 2, color: Theme.Color.home)
                    Text("Delivered anonymously")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.home)
                }
                Spacer(minLength: 0)
                Button("Change reply", action: onChange)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
                    .buttonStyle(.plain)
            }
        }
    }

    var body: some View {
        bodyContent
            .padding(14)
            .background(Theme.Color.successBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .strokeBorder(Theme.Color.successLight, lineWidth: 1)
            )
    }
}

private struct RepliesOffNote: View {
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Icon(.ban, size: 14, strokeWidth: 2, color: Theme.Color.appTextMuted)
            Text("Replies are off for this neighbor.")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .placeCard()
    }
}

// MARK: - Manage card

private struct ManageCard: View {
    let flags: NeighborManageFlags
    var onNotHelpful: () -> Void
    var onBlock: () -> Void
    var onReport: () -> Void

    private enum Tone { case neutral, danger }

    private struct Row {
        let icon: PantopusIcon
        let tone: Tone
        let title: String
        let sub: String
        let doneTitle: String
        let done: Bool
        let action: () -> Void
    }

    private var rows: [Row] {
        [
            Row(
                icon: .circleSlash,
                tone: .neutral,
                title: "This isn't helpful",
                sub: "Tell us this note wasn't useful. The sender won't be told.",
                doneTitle: "Thanks for the feedback",
                done: flags.notHelpful,
                action: onNotHelpful
            ),
            Row(
                icon: .ban,
                tone: .neutral,
                title: "Block this neighbor",
                sub: "Stop messages from this verified home. They won't be notified.",
                doneTitle: "Neighbor blocked",
                done: flags.blocked,
                action: onBlock
            ),
            Row(
                icon: .flag,
                tone: .danger,
                title: "Report this message",
                sub: "Flag it for the Pantopus trust team to review.",
                doneTitle: "Reported to the trust team",
                done: flags.reported,
                action: onReport
            )
        ]
    }

    var body: some View {
        VStack(spacing: 0) {
            let allRows = rows
            ForEach(Array(allRows.enumerated()), id: \.offset) { index, row in
                rowView(row)
                if index < allRows.count - 1 {
                    Divider().overlay(Theme.Color.appBorderSubtle)
                }
            }
        }
        .placeCard()
    }

    private func rowView(_ row: Row) -> some View {
        let danger = row.tone == .danger
        let fg = danger ? Theme.Color.error : Theme.Color.appTextSecondary
        let tileBg = danger ? Theme.Color.errorBg : Theme.Color.appSurfaceSunken
        let tileFg = danger ? Theme.Color.error : Theme.Color.appTextMuted
        let tileBorder = danger ? Theme.Color.errorLight : Theme.Color.appBorder
        return Button(action: row.action) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .fill(tileBg)
                        .overlay(
                            RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .strokeBorder(tileBorder, lineWidth: 1)
                        )
                    Icon(
                        row.done ? .check : row.icon,
                        size: 18,
                        strokeWidth: 2.25,
                        color: row.done ? Theme.Color.home : tileFg
                    )
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text(row.done ? row.doneTitle : row.title)
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(row.done ? Theme.Color.appTextMuted : fg)
                    if !row.done {
                        Text(row.sub)
                            .font(.system(size: 12.5))
                            .lineSpacing(1.5)
                            .foregroundStyle(Theme.Color.appTextMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 0)
                if !row.done {
                    Icon(.chevronRight, size: 18, strokeWidth: 2.25, color: Theme.Color.appTextMuted)
                }
            }
            .padding(14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(row.done)
    }
}

// MARK: - Skeleton

private struct ReceivedSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    PlaceSkeleton(width: 44, height: 44, radius: 22)
                    VStack(alignment: .leading, spacing: 8) {
                        PlaceSkeleton(widthFraction: 0.66, height: 14)
                        PlaceSkeleton(widthFraction: 0.33, height: 12)
                    }
                }
                PlaceSkeleton(height: 14)
                PlaceSkeleton(widthFraction: 0.83, height: 14)
            }
            .padding(17)
            .placeCard()
            PlaceSkeleton(height: 36, radius: 18).padding(.top, 12)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }
}
