//
//  ChatEmojiPickerSheet.swift
//  Pantopus
//
//  Compact emoji picker opened from the chat composer's emoji button
//  (Phase 3). A fixed 8-column grid of curated common emoji — tapping
//  one appends it to the composer. Embedded below the composer so the
//  draft stays visible; drag the heading down to dismiss.
//

import SwiftUI

struct ChatEmojiPickerSheet<DismissGesture: Gesture>: View {
    /// Appends the tapped emoji to the composer. The panel stays open
    /// so multiple emoji can be picked in one pass.
    let onPick: @MainActor (String) -> Void
    let onDismiss: @MainActor () -> Void
    let dismissGesture: DismissGesture

    /// Curated common-emoji set (8 × 8).
    private let emoji: [String] = [
        "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣",
        "😊", "😇", "🙂", "😉", "😍", "🥰", "😘", "😎",
        "🤔", "🤨", "😐", "😴", "😬", "🙄", "😢", "😭",
        "😤", "😡", "🥳", "🤩", "🤗", "🤭", "🫡", "🙃",
        "👍", "👎", "👏", "🙌", "🙏", "💪", "🤝", "👋",
        "❤️", "🧡", "💛", "💚", "💙", "💜", "🤍", "💔",
        "🔥", "⭐", "✨", "🎉", "🎊", "🎁", "💯", "✅",
        "🏠", "🔧", "🛠️", "📦", "🚚", "🌳", "🐕", "☀️"
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack {
                Text("Emoji")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                Button(action: onDismiss) {
                    Icon(.chevronDown, size: 20, color: Theme.Color.appTextMuted)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Hide emoji")
                .accessibilityIdentifier("chatEmojiDismiss")
            }
            .contentShape(Rectangle())
            .gesture(dismissGesture)
            ScrollView {
                LazyVGrid(
                    columns: Array(repeating: GridItem(.flexible(), spacing: Spacing.s1), count: 8),
                    spacing: Spacing.s1
                ) {
                    ForEach(emoji, id: \.self) { symbol in
                        Button { onPick(symbol) } label: {
                            Text(symbol)
                                .font(.system(size: 28))
                                .frame(maxWidth: .infinity, minHeight: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(symbol)
                    }
                }
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s4)
        .padding(.bottom, Spacing.s4)
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("chatEmojiPicker")
    }
}
