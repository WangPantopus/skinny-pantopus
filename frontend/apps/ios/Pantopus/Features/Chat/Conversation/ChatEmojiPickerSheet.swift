//
//  ChatEmojiPickerSheet.swift
//  Pantopus
//
//  Compact emoji picker opened from the chat composer's emoji button
//  (Phase 3). A fixed 8-column grid of curated common emoji — tapping
//  one appends it to the composer and keeps the sheet open; drag down
//  to dismiss.
//

import SwiftUI

struct ChatEmojiPickerSheet: View {
    /// Appends the tapped emoji to the composer. The sheet stays open
    /// so multiple emoji can be picked in one pass.
    let onPick: @MainActor (String) -> Void

    /// Curated common-emoji set (8 × 8).
    private static let emoji: [String] = [
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
            Text("Emoji")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            ScrollView {
                LazyVGrid(
                    columns: Array(repeating: GridItem(.flexible(), spacing: Spacing.s1), count: 8),
                    spacing: Spacing.s1
                ) {
                    ForEach(Self.emoji, id: \.self) { symbol in
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
