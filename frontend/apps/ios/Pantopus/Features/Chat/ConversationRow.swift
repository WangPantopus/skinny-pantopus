//
//  ConversationRow.swift
//  Pantopus
//
//  Per-row view for the Chat List. Three avatar treatments (DM /
//  group / AI-assistant), identity chip slot, pinned rail + tint, and
//  unread bolding rules baked in.
//

import SwiftUI

/// Single row in the chat list.
public struct ConversationRow: View {
    private let content: ConversationRowContent
    private let onTap: @MainActor () -> Void

    public init(content: ConversationRowContent, onTap: @escaping @MainActor () -> Void) {
        self.content = content
        self.onTap = onTap
    }

    public var body: some View {
        Button(action: onTap) {
            HStack(alignment: .center, spacing: Spacing.s3) {
                avatar
                middle
                trailing
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s4)
            .background(rowBackground)
            .overlay(alignment: .leading) {
                if content.pinned {
                    Rectangle()
                        .fill(Theme.Color.primary600)
                        .frame(width: 3)
                        .clipShape(UnevenRoundedRectangle(
                            topLeadingRadius: 0,
                            bottomLeadingRadius: 0,
                            bottomTrailingRadius: 2,
                            topTrailingRadius: 2
                        ))
                }
            }
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(Theme.Color.appBorderSubtle)
                    .frame(height: 1)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("conversationRow_\(content.id)")
    }

    private var rowBackground: some View {
        Group {
            if content.pinned {
                Theme.Color.primary50.opacity(0.5)
            } else {
                Theme.Color.appSurface
            }
        }
    }

    @ViewBuilder
    private var avatar: some View {
        switch content.variant {
        case .dm:
            DMAvatarView(content: content)
        case .aiAssistant:
            ChatAIAvatar(size: 44)
        case let .group(extras, extraCount):
            GroupAvatarView(content: content, extras: extras, extraCount: extraCount)
        }
    }

    private var isAIRow: Bool {
        if case .aiAssistant = content.variant { return true }
        return false
    }

    private var middle: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack(spacing: 6) {
                Text(content.displayName)
                    .font(.system(size: 16, weight: content.unread > 0 || isAIRow ? .bold : .medium))
                    .foregroundStyle(isAIRow ? Theme.Color.primary700 : Theme.Color.appText)
                    .lineLimit(1)
                if isAIRow {
                    // A15.3 `.ai-badge` — primary identity, not business purple.
                    Text("AI")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Theme.Color.primary700)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background(Theme.Color.primary50, in: Capsule())
                        .accessibilityHidden(true)
                }
                if let chip = content.identityChip {
                    IdentityDisclosureChip(chip: chip)
                }
                if content.pinned {
                    Icon(.star, size: 11, color: Theme.Color.appTextMuted)
                        .accessibilityHidden(true)
                }
                Spacer(minLength: Spacing.s0)
            }
            Text(content.preview)
                .font(.system(size: 14, weight: content.unread > 0 ? .semibold : .regular))
                .foregroundStyle(
                    isAIRow
                        ? Theme.Color.primary600
                        : (content.unread > 0 ? Theme.Color.appTextStrong : Theme.Color.appTextSecondary)
                )
                .lineLimit(1)
            if !content.topics.isEmpty {
                topicPills
                    .padding(.top, 2)
            }
        }
    }

    /// Topic pills under the preview — first two topics + a "+N"
    /// overflow pill when the conversation has more.
    private var topicPills: some View {
        HStack(spacing: 4) {
            ForEach(content.topics.prefix(2)) { topic in
                ConversationTopicPill(topic: topic)
            }
            if content.topics.count > 2 {
                Text("+\(content.topics.count - 2)")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Theme.Color.appSurfaceSunken, in: Capsule())
                    .accessibilityLabel("\(content.topics.count - 2) more topics")
            }
        }
        .accessibilityIdentifier("conversationRow.topics_\(content.id)")
    }

    @ViewBuilder private var trailing: some View {
        if isAIRow {
            Icon(.chevronRight, size: 18, color: Theme.Color.primary600)
                .accessibilityHidden(true)
        } else {
            trailingDefault
        }
    }

    private var trailingDefault: some View {
        VStack(alignment: .trailing, spacing: 6) {
            HStack(spacing: 4) {
                if content.isMuted {
                    Icon(.bellOff, size: 14, color: Theme.Color.appTextMuted)
                        .accessibilityLabel("Muted")
                }
                Text(content.timeLabel)
                    .font(.system(size: 12, weight: content.unread > 0 ? .semibold : .regular))
                    .foregroundStyle(content.unread > 0 ? Theme.Color.primary600 : Theme.Color.appTextMuted)
            }
            if content.unread > 0 {
                Text("\(content.unread)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, 6)
                    .frame(minWidth: 20, minHeight: 20)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
                    .accessibilityLabel("\(content.unread) unread")
            }
        }
        .frame(minWidth: 32, alignment: .trailing)
    }

    private var accessibilityLabel: String {
        var parts: [String] = [content.displayName]
        if let chip = content.identityChip { parts.append(chip.label) }
        if content.verified { parts.append("verified") }
        parts.append(content.preview)
        if content.unread > 0 { parts.append("\(content.unread) unread") }
        return parts.joined(separator: ". ")
    }
}

// MARK: - Avatar variants

private struct DMAvatarView: View {
    let content: ConversationRowContent

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            initialsCircle(size: 52, color: Theme.Color.personalBg, initials: content.initials, fg: Theme.Color.primary600)
            if content.verified {
                Icon(.check, size: 9, strokeWidth: 3.5, color: Theme.Color.appTextInverse)
                    .frame(width: 16, height: 16)
                    .background(Theme.Color.primary600)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                    .offset(x: 1, y: 1)
                    .accessibilityLabel("Verified")
            }
        }
        .frame(width: 52, height: 52)
    }
}

private struct GroupAvatarView: View {
    let content: ConversationRowContent
    let extras: [String]
    let extraCount: Int

    var body: some View {
        ZStack {
            // Back tile
            initialsCircle(size: 32, color: Theme.Color.warning, initials: content.initials)
                .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                .offset(x: -6, y: -6)
            // Front tile
            initialsCircle(
                size: 32,
                color: Theme.Color.success,
                initials: extras.first ?? "+\(extraCount > 0 ? extraCount : 1)"
            )
            .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
            .offset(x: 6, y: 6)
        }
        .frame(width: 44, height: 44)
        .accessibilityLabel("Group")
    }
}

private func initialsCircle(
    size: CGFloat,
    color: Color,
    initials: String,
    fg: Color = Theme.Color.appTextInverse
) -> some View {
    ZStack {
        Circle().fill(color)
        Text(initials)
            .font(.system(size: size * 0.34, weight: .bold))
            .foregroundStyle(fg)
    }
    .frame(width: size, height: size)
}

// MARK: - Topic pill

/// One topic pill under the preview line. The icon follows the topic
/// type: `task`/`gig` → briefcase, `listing`/`marketplace` → tag.
private struct ConversationTopicPill: View {
    let topic: ConversationRowTopic

    var body: some View {
        HStack(spacing: 3) {
            Icon(icon, size: 10, color: Theme.Color.appTextSecondary)
            Text(topic.title)
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(Theme.Color.appSurfaceSunken, in: Capsule())
    }

    private var icon: PantopusIcon {
        switch topic.topicType {
        case "task", "gig": .briefcase
        case "listing", "marketplace": .tag
        default: .messageCircle
        }
    }
}

// MARK: - Identity disclosure chip

private struct IdentityDisclosureChip: View {
    let chip: ConversationIdentityChip

    var body: some View {
        HStack(spacing: 3) {
            Icon(icon, size: 8, strokeWidth: 2.6, color: foreground)
            Text(chip.label.uppercased())
                .font(.system(size: 9, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(foreground)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 1)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
    }

    private var icon: PantopusIcon {
        switch chip {
        case .business: .shoppingBag
        case .home: .home
        }
    }

    private var foreground: Color {
        switch chip {
        case .business: Theme.Color.business
        case .home: Theme.Color.home
        }
    }

    private var background: Color {
        switch chip {
        case .business: Theme.Color.businessBg
        case .home: Theme.Color.homeBg
        }
    }
}

// MARK: - Swipe actions

/// Reveals mute + hide actions when the user swipes a conversation row left.
public struct SwipeableConversationRow: View {
    private let content: ConversationRowContent
    private let onTap: @MainActor () -> Void
    private let onMute: @MainActor () -> Void
    private let onHide: @MainActor () -> Void

    private let revealWidth: CGFloat = 140
    @State private var offset: CGFloat = 0
    @GestureState private var dragging: CGFloat = 0

    public init(
        content: ConversationRowContent,
        onTap: @escaping @MainActor () -> Void,
        onMute: @escaping @MainActor () -> Void,
        onHide: @escaping @MainActor () -> Void
    ) {
        self.content = content
        self.onTap = onTap
        self.onMute = onMute
        self.onHide = onHide
    }

    public var body: some View {
        ZStack(alignment: .trailing) {
            swipeActions
            ConversationRow(content: content, onTap: onTap)
                .offset(x: clampedOffset)
                .highPriorityGesture(swipeGesture)
        }
        .accessibilityIdentifier("swipeableConversationRow_\(content.id)")
    }

    private var clampedOffset: CGFloat {
        min(0, max(-revealWidth, offset + dragging))
    }

    private var swipeActions: some View {
        HStack(spacing: 0) {
            swipeButton(
                icon: content.isMuted ? .bell : .bellOff,
                label: content.isMuted ? "Unmute" : "Mute",
                tint: Color(red: 0.42, green: 0.45, blue: 0.50),
                id: "conversationRow.swipeMute_\(content.id)"
            ) {
                reset()
                onMute()
            }
            swipeButton(
                icon: .archive,
                label: "Hide",
                tint: Color(red: 0.22, green: 0.25, blue: 0.32),
                id: "conversationRow.swipeHide_\(content.id)"
            ) {
                reset()
                onHide()
            }
        }
        .frame(width: revealWidth)
        .opacity(clampedOffset < -2 ? 1 : 0)
    }

    private func swipeButton(
        icon: PantopusIcon,
        label: String,
        tint: Color,
        id: String,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Icon(icon, size: 17, color: Theme.Color.appTextInverse)
                Text(label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(tint)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }

    private var swipeGesture: some Gesture {
        DragGesture(minimumDistance: 14)
            .updating($dragging) { value, state, _ in
                if abs(value.translation.width) > abs(value.translation.height) {
                    state = value.translation.width
                }
            }
            .onEnded { value in
                let projected = offset + value.translation.width
                withAnimation(.interpolatingSpring(stiffness: 320, damping: 30)) {
                    offset = projected < -revealWidth / 2 ? -revealWidth : 0
                }
            }
    }

    private func reset() {
        withAnimation(.interpolatingSpring(stiffness: 320, damping: 30)) {
            offset = 0
        }
    }
}
