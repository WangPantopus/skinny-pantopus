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

    /// Brief confirmations keep their existing dwell; explanatory messages get up to seven seconds.
    public static func duration(for text: String, minimum: Double = 3) -> Duration {
        .seconds(max(minimum, min(Double(text.count) * 0.06, 7)))
    }
}

/// Banner floated at the bottom of the screen, clear of its edges. A message
/// that fits on one line is a pill; a longer one wraps, centred, in a rounded
/// rectangle whose corners stay clear of the first and last lines.
public struct ToastView: View {
    public let message: ToastMessage

    public init(message: ToastMessage) {
        self.message = message
    }

    public var body: some View {
        ViewThatFits(in: .horizontal) {
            label
                .fixedSize()
                .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
            label
                .fixedSize(horizontal: false, vertical: true)
                .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        }
        .padding(.horizontal, Spacing.s4)
        .accessibilityLabel(message.text)
    }

    private var label: some View {
        Text(message.text)
            .pantopusTextStyle(.small)
            .pantopusLineHeight(.small)
            .multilineTextAlignment(.center)
            .foregroundStyle(Theme.Color.appTextInverse)
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s2)
            .background(background)
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
                        do {
                            try await Task.sleep(for: ToastMessage.duration(for: text))
                        } catch {
                            return
                        }
                        guard message.wrappedValue == text else { return }
                        message.wrappedValue = nil
                    }
            }
        }
    }
}
