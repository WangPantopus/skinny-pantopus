//
//  ChatSideBySide.swift
//  Pantopus
//
//  What the chat screens change when the list and a conversation sit side
//  by side on a wide screen (the iPhone Duo open; `InboxSplitView`): the
//  open conversation's row is tinted, its header leaves Back out (the list
//  is the way back), and the conversation column waits with a note until a
//  chat is picked. Phones never set these, so nothing changes there.
//

import SwiftUI

private struct SelectedConversationRowIdKey: EnvironmentKey {
    static var defaultValue: String? {
        nil
    }
}

private struct ChatConversationShowsBackKey: EnvironmentKey {
    static var defaultValue: Bool {
        true
    }
}

extension EnvironmentValues {
    /// The list row of the conversation open beside the list, tinted as selected; nil while the list stands alone.
    var selectedConversationRowId: String? {
        get { self[SelectedConversationRowIdKey.self] }
        set { self[SelectedConversationRowIdKey.self] = newValue }
    }

    /// Whether a conversation's header shows Back. Not where the conversation is the first screen of its column
    /// beside the list.
    var chatConversationShowsBack: Bool {
        get { self[ChatConversationShowsBackKey.self] }
        set { self[ChatConversationShowsBackKey.self] = newValue }
    }
}

/// The conversation column before a chat is picked. It never opens one by itself: opening a conversation marks it
/// read. With no conversations yet, the list beside it shows the empty state and New message.
struct ChatConversationPlaceholder: View {
    let listIsEmpty: Bool

    var body: some View {
        VStack(spacing: 14) {
            Icon(.messageSquareText, size: 30, strokeWidth: 1.8, color: Theme.Color.primaryInk)
                .frame(width: 72, height: 72)
                .background(Theme.Color.primary50)
                .clipShape(Circle())
            if !listIsEmpty {
                Text("Pick a conversation")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
            }
            Text(listIsEmpty ? "When you message a neighbor, the chat opens here." : "Choose a chat on the left to read it here.")
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appSurface)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("chatConversationPlaceholder")
    }
}
