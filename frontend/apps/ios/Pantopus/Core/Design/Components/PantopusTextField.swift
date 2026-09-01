//
//  PantopusTextField.swift
//  Pantopus
//
//  44pt text field with the four design-system states: default, focus,
//  valid, error. Reads label / error to VoiceOver.
//

import SwiftUI

/// Validation state for `PantopusTextField`.
public enum PantopusFieldState: Sendable, Equatable {
    case `default`
    case valid
    /// Carries a helper string rendered beneath the field.
    case error(String)
}

/// Token-styled text field with validation visuals.
@MainActor
public struct PantopusTextField: View {
    @Binding private var text: String
    private let label: String
    private let placeholder: String
    private let state: PantopusFieldState
    private let isRequired: Bool
    private let isDirty: Bool
    private let isSecure: Bool
    private let keyboardType: UIKeyboardType
    private let contentType: UITextContentType?
    private let identifier: String?
    private let containerColor: Color

    @FocusState private var isFocused: Bool

    public init(
        _ label: String,
        text: Binding<String>,
        placeholder: String = "",
        state: PantopusFieldState = .default,
        isRequired: Bool = false,
        isDirty: Bool = false,
        isSecure: Bool = false,
        keyboardType: UIKeyboardType = .default,
        contentType: UITextContentType? = nil,
        identifier: String? = nil,
        containerColor: Color = Theme.Color.appSurface
    ) {
        self.label = label
        _text = text
        self.placeholder = placeholder
        self.state = state
        self.isRequired = isRequired
        self.isDirty = isDirty
        self.isSecure = isSecure
        self.keyboardType = keyboardType
        self.contentType = contentType
        self.identifier = identifier
        self.containerColor = containerColor
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack(spacing: 2) {
                Text(label)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                if isRequired {
                    Text("*")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.error)
                        .accessibilityHidden(true)
                }
                if isDirty {
                    Circle()
                        .fill(Theme.Color.warning)
                        .frame(width: 6, height: 6)
                        .padding(.leading, Spacing.s1)
                        .accessibilityHidden(true)
                }
            }

            HStack(spacing: Spacing.s2) {
                input
                trailingIcon
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 44)
            .background(containerColor)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(borderColor, lineWidth: isFocused ? 2 : 1)
            )

            if case let .error(message) = state {
                Text(message)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityLabel("Error: \(message)")
            }
        }
    }

    @ViewBuilder private var input: some View {
        if isSecure {
            SecureField(placeholder, text: $text)
                .textContentType(contentType)
                .focused($isFocused)
                .accessibilityLabel(a11yLabel)
                .modifier(IdentifierModifier(identifier: identifier))
        } else {
            TextField(placeholder, text: $text)
                .textContentType(contentType)
                .keyboardType(keyboardType)
                .focused($isFocused)
                .accessibilityLabel(a11yLabel)
                .modifier(IdentifierModifier(identifier: identifier))
        }
    }

    @ViewBuilder private var trailingIcon: some View {
        switch state {
        case .valid: Icon(.check, size: 18, color: Theme.Color.success)
        case .error: Icon(.alertCircle, size: 18, color: Theme.Color.error)
        case .default: EmptyView()
        }
    }

    private var borderColor: Color {
        switch state {
        case .error: Theme.Color.error
        case .valid: Theme.Color.success
        case .default: isFocused ? Theme.Color.primary600 : Theme.Color.appBorder
        }
    }

    private var a11yLabel: String {
        let base: String =
            switch state {
            case let .error(msg): "\(label), error: \(msg)"
            case .valid: "\(label), valid"
            case .default: label
            }
        return isRequired ? "\(base), required" : base
    }
}

/// Conditional `accessibilityIdentifier` for the real input element so
/// XCUITests can type into the field without relying on wrapper focus.
private struct IdentifierModifier: ViewModifier {
    let identifier: String?

    func body(content: Content) -> some View {
        if let identifier {
            content.accessibilityIdentifier(identifier)
        } else {
            content
        }
    }
}

#Preview("All states") {
    @Previewable @State var plain = ""
    @Previewable @State var valid = "alice@pantopus.app"
    @Previewable @State var errored = "not-an-email"
    return VStack(spacing: Spacing.s3) {
        PantopusTextField("Email", text: $plain, placeholder: "you@pantopus.app")
        PantopusTextField("Email", text: $valid, state: .valid)
        PantopusTextField(
            "Email",
            text: $errored,
            state: .error("Please enter a valid email address")
        )
    }
    .padding()
    .background(Theme.Color.appBg)
}
