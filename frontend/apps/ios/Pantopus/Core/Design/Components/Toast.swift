//
//  Toast.swift
//  Pantopus
//
//  Lightweight transient banner used for success + error surfacing on
//  form submissions and CTA results.
//

import SwiftUI

/// Visual role for a `ToastView`.
public enum ToastKind: Sendable {
    case success
    case error
    case neutral
}

/// Payload for `ToastView`. Hold as `@State` on the host and set to nil
/// after the auto-dismiss delay.
public struct ToastMessage: Identifiable, Equatable, Sendable {
    public let id = UUID()
    public let text: String
    public let kind: ToastKind

    public init(text: String, kind: ToastKind = .neutral) {
        self.text = text
        self.kind = kind
    }
}

/// Pill-shaped banner, intended to be floated at the bottom of the screen.
public struct ToastView: View {
    public let message: ToastMessage

    public init(message: ToastMessage) {
        self.message = message
    }

    public var body: some View {
        Text(message.text)
            .pantopusTextStyle(.small)
            .foregroundStyle(Theme.Color.appTextInverse)
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s2)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
            .accessibilityLabel(message.text)
    }

    private var background: Color {
        switch message.kind {
        case .success: Theme.Color.success.opacity(0.95)
        case .error: Theme.Color.error.opacity(0.95)
        case .neutral: Theme.Color.appText.opacity(0.9)
        }
    }
}

public extension View {
    /// Floats an error toast when a refresh fails while the screen's content
    /// stays up, then clears the message. Screens keep what they loaded
    /// instead of swapping it for a full-screen error.
    func refreshFailureToast(_ message: Binding<String?>) -> some View {
        overlay(alignment: .bottom) {
            if let text = message.wrappedValue {
                ToastView(message: ToastMessage(text: text, kind: .error))
                    .padding(.bottom, Spacing.s10)
                    .task(id: text) {
                        try? await Task.sleep(nanoseconds: 3_000_000_000)
                        message.wrappedValue = nil
                    }
            }
        }
    }
}
