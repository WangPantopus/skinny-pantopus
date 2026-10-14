//
//  NewItemsPill.swift
//  Pantopus
//
//  The pill that says how many new items wait and brings them in when
//  tapped: "↑ 3 new conversations" on the Pulse page (Pulse S6), "↓ 2 new
//  replies" in a conversation (S9). New items never move the page by
//  themselves; this is how a person asks for them. The arrow is drawn; the
//  words say it all for VoiceOver. Scales with Dynamic Type.
//

import SwiftUI

public struct NewItemsPill: View {
    public enum Direction: Sendable {
        case up
        case down
    }

    private let text: String
    private let direction: Direction
    private let identifier: String
    private let action: @MainActor () -> Void

    /// - Parameters:
    ///   - text: "3 new conversations" (the arrow is drawn, not written).
    public init(
        text: String,
        direction: Direction,
        identifier: String,
        action: @escaping @MainActor () -> Void
    ) {
        self.text = text
        self.direction = direction
        self.identifier = identifier
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                Icon(direction == .up ? .arrowUp : .arrowDown, size: 16, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                    .accessibilityHidden(true)
                Text(text)
                    .pulseFont(.button)
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s2)
            .frame(minHeight: 44)
            .background(Theme.Color.appText)
            .clipShape(Capsule())
            .shadow(color: Theme.Color.appText.opacity(0.25), radius: 8, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(text)
        .accessibilityIdentifier(identifier)
    }
}
