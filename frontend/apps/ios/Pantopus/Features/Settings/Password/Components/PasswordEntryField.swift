//
//  PasswordEntryField.swift
//  Pantopus
//
//  A13.14 — masked password input. Extends the `PantopusTextField` visual
//  vocabulary with: an optional leading status icon (lock), a reveal toggle
//  (eye / eye-off), a "revealed" monospace mode for sanity-checking a strong
//  password, a helper line, and the shared default/valid/error states.
//
//  Named `PasswordEntryField` rather than `PasswordField` because the Auth
//  feature already owns a top-level `PasswordField` (login/sign-up); this is
//  the design's `PasswordField` atom for the Settings → Password surface.
//

import SwiftUI

/// Token-styled secure field with a leading icon, reveal toggle, helper, and
/// validation visuals. Mirrors the design's `PasswordField` atom.
@MainActor
public struct PasswordEntryField: View {
    @Binding private var text: String
    private let label: String
    private let placeholder: String
    private let state: PantopusFieldState
    private let isRequired: Bool
    private let leftIcon: PantopusIcon?
    private let helper: String?
    private let revealedByDefault: Bool
    private let contentType: UITextContentType?
    private let identifier: String?

    @FocusState private var isFocused: Bool
    /// `nil` until the user taps the reveal toggle, after which it overrides
    /// the caller-supplied `revealedByDefault`.
    @State private var revealOverride: Bool?

    public init(
        _ label: String,
        text: Binding<String>,
        placeholder: String = "",
        state: PantopusFieldState = .default,
        isRequired: Bool = false,
        leftIcon: PantopusIcon? = nil,
        helper: String? = nil,
        revealedByDefault: Bool = false,
        contentType: UITextContentType? = nil,
        identifier: String? = nil
    ) {
        self.label = label
        _text = text
        self.placeholder = placeholder
        self.state = state
        self.isRequired = isRequired
        self.leftIcon = leftIcon
        self.helper = helper
        self.revealedByDefault = revealedByDefault
        self.contentType = contentType
        self.identifier = identifier
    }

    private var isRevealed: Bool {
        revealOverride ?? revealedByDefault
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
            }

            HStack(spacing: Spacing.s2) {
                if let leftIcon {
                    Icon(leftIcon, size: 16, color: leftIconColor)
                }
                input
                trailing
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 46)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(borderColor, lineWidth: borderWidth)
            )

            footer
        }
    }

    @ViewBuilder private var input: some View {
        if isRevealed {
            TextField(placeholder, text: $text)
                .font(.system(size: 13.5, design: .monospaced))
                .textContentType(contentType)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .focused($isFocused)
                .accessibilityLabel(a11yLabel)
                .modifier(PasswordEntryFieldIdentifier(identifier: identifier))
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            SecureField(placeholder, text: $text)
                .textContentType(contentType)
                .focused($isFocused)
                .accessibilityLabel(a11yLabel)
                .modifier(PasswordEntryFieldIdentifier(identifier: identifier))
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var trailing: some View {
        HStack(spacing: Spacing.s2) {
            switch state {
            case .valid: Icon(.checkCircle, size: 18, color: Theme.Color.success)
            case .error: Icon(.alertCircle, size: 18, color: Theme.Color.error)
            case .default: EmptyView()
            }
            Button {
                revealOverride = !isRevealed
            } label: {
                Icon(isRevealed ? .eyeOff : .eye, size: 17, color: Theme.Color.appTextSecondary)
                    .frame(width: 32, height: 32)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isRevealed ? "Hide password" : "Show password")
            .accessibilityIdentifier(identifier.map { "\($0)_reveal" } ?? "passwordReveal")
        }
    }

    @ViewBuilder private var footer: some View {
        if case let .error(message) = state {
            HStack(alignment: .top, spacing: Spacing.s1) {
                Icon(.alertCircle, size: 12, color: Theme.Color.error)
                    .padding(.top, 1)
                Text(message)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.error)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Error: \(message)")
        } else if let helper {
            Text(helper)
                .font(.system(size: 11.5))
                .foregroundStyle(state == .valid ? Theme.Color.success : Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var leftIconColor: Color {
        if case .error = state { return Theme.Color.error }
        return Theme.Color.appTextSecondary
    }

    private var borderColor: Color {
        switch state {
        case .error: Theme.Color.error
        case .valid: Theme.Color.success
        case .default: isFocused ? Theme.Color.primary600 : Theme.Color.appBorder
        }
    }

    private var borderWidth: CGFloat {
        if isFocused { return 2 }
        return state == .default ? 1 : 1.5
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

/// Conditional `accessibilityIdentifier` on the real input so XCUITests can
/// type into the field without relying on wrapper focus.
private struct PasswordEntryFieldIdentifier: ViewModifier {
    let identifier: String?

    func body(content: Content) -> some View {
        if let identifier {
            content.accessibilityIdentifier(identifier)
        } else {
            content
        }
    }
}

#Preview("States") {
    @Previewable @State var current = "autumn-river-2019"
    @Previewable @State var newPw = "Bake-Sourdough-Friday-77"
    @Previewable @State var bad = "password123"
    return VStack(spacing: Spacing.s4) {
        PasswordEntryField("Current password", text: $current, state: .valid, isRequired: true, leftIcon: .lock)
        PasswordEntryField("New password", text: $newPw, state: .valid, isRequired: true, revealedByDefault: true)
        PasswordEntryField(
            "New password",
            text: $bad,
            state: .error("Too common — appeared in 2.3M public records."),
            isRequired: true,
            revealedByDefault: true
        )
        PasswordEntryField("Confirm new password", text: $newPw, state: .valid, isRequired: true, helper: "Matches new password.")
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
