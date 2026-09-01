//
//  SectionHeader.swift
//  Pantopus
//
//  Overline-style section header with an optional trailing action link.
//

import SwiftUI

/// Uppercase overline header with optional trailing action.
///
/// - Parameters:
///   - title: Rendered UPPERCASE.
///   - action: Optional trailing "See all"-style link + handler.
@MainActor
public struct SectionHeader: View {
    /// Trailing action payload.
    public struct Action {
        public let title: String
        public let handler: () -> Void

        public init(title: String, handler: @escaping () -> Void) {
            self.title = title
            self.handler = handler
        }
    }

    private let title: String
    private let action: Action?

    public init(_ title: String, action: Action? = nil) {
        self.title = title
        self.action = action
    }

    public var body: some View {
        HStack(spacing: Spacing.s2) {
            Text(title)
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            if let action {
                Button(action: action.handler) {
                    HStack(spacing: Spacing.s1) {
                        Text(action.title)
                            .pantopusTextStyle(.small)
                        Icon(.chevronRight, size: 14, color: Theme.Color.primary600)
                    }
                    .foregroundStyle(Theme.Color.primary600)
                }
                .buttonStyle(.plain)
                .frame(minHeight: 44)
                .accessibilityLabel(action.title)
                .accessibilityHint("\(title) — tap to expand")
            }
        }
        .padding(.vertical, Spacing.s2)
    }
}

#Preview("Plain") { SectionHeader("Bills due") }

#Preview("With action") {
    SectionHeader("Neighbors", action: .init(title: "See all") {})
}
