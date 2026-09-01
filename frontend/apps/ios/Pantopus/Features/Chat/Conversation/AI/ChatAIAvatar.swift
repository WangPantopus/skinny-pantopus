//
//  ChatAIAvatar.swift
//  Pantopus
//
//  A15.3 — the Pantopus AI mark. A circle filled with the design's
//  `.ai-grad` primary-blue gradient (primary600 → primary800) carrying a
//  white `sparkles` glyph. Used wherever the AI assistant appears
//  (chat-list row, conversation header, welcome card, empty state).
//

import SwiftUI

/// The Pantopus AI avatar: a primary-blue gradient circle with a white
/// `sparkles` glyph (A15.3 `.ai-grad` / `.ai-av`).
public struct ChatAIAvatar: View {
    private let size: CGFloat

    public init(size: CGFloat) {
        self.size = size
    }

    public var body: some View {
        Circle()
            .fill(
                LinearGradient(
                    colors: [Theme.Color.primary600, Theme.Color.primary800],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .frame(width: size, height: size)
            .overlay(
                Icon(.sparkles, size: size * 0.5, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
            )
            .accessibilityElement()
            .accessibilityLabel("Pantopus AI")
    }
}

#Preview {
    HStack(spacing: Spacing.s4) {
        ChatAIAvatar(size: 32)
        ChatAIAvatar(size: 44)
        ChatAIAvatar(size: 88)
    }
    .padding()
    .background(Theme.Color.appSurface)
}
