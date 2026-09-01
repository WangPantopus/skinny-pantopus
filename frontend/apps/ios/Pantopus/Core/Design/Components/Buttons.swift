//
//  Buttons.swift
//  Pantopus
//
//  Primary / Ghost / Destructive button styles. All three share the same
//  44pt minimum height, `Radii.lg` corner, loading-spinner substitution,
//  and 50% disabled opacity.
//

import SwiftUI

/// Shared button-style enum routed through `PantopusButton`.
public enum PantopusButtonKind: Sendable {
    case primary
    case ghost
    case destructive
}

/// Internal core button. Feature code uses the typed wrappers below.
@MainActor
public struct PantopusButton: View {
    private let title: String
    private let kind: PantopusButtonKind
    private let isLoading: Bool
    private let isEnabled: Bool
    private let action: () async -> Void

    public init(
        title: String,
        kind: PantopusButtonKind,
        isLoading: Bool = false,
        isEnabled: Bool = true,
        action: @escaping () async -> Void
    ) {
        self.title = title
        self.kind = kind
        self.isLoading = isLoading
        self.isEnabled = isEnabled
        self.action = action
    }

    public var body: some View {
        Button {
            Task { await action() }
        } label: {
            ZStack {
                Text(title)
                    .pantopusTextStyle(.body)
                    .opacity(isLoading ? 0 : 1)
                if isLoading {
                    ProgressView().tint(foreground)
                }
            }
            .foregroundStyle(foreground)
            .frame(maxWidth: .infinity, minHeight: 44)
            .padding(.horizontal, Spacing.s4)
            .background(background)
            .overlay(border)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .pantopusShadow(kind == .primary ? .primary : .sm)
            .opacity(isEnabled ? 1 : 0.5)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled || isLoading)
        .accessibilityLabel(title)
        .accessibilityAddTraits(.isButton)
    }

    private var foreground: Color {
        switch kind {
        case .primary: Theme.Color.appTextInverse
        case .ghost: Theme.Color.appText
        case .destructive: Theme.Color.appTextInverse
        }
    }

    private var background: Color {
        switch kind {
        case .primary: Theme.Color.primary600
        case .ghost: Theme.Color.appSurface
        case .destructive: Theme.Color.error
        }
    }

    @ViewBuilder private var border: some View {
        switch kind {
        case .ghost:
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        default:
            EmptyView()
        }
    }
}

/// Filled primary-action button.
public struct PrimaryButton: View {
    public let title: String
    public var isLoading: Bool = false
    public var isEnabled: Bool = true
    public let action: () async -> Void

    public init(
        title: String,
        isLoading: Bool = false,
        isEnabled: Bool = true,
        action: @escaping () async -> Void
    ) {
        self.title = title
        self.isLoading = isLoading
        self.isEnabled = isEnabled
        self.action = action
    }

    public var body: some View {
        PantopusButton(
            title: title,
            kind: .primary,
            isLoading: isLoading,
            isEnabled: isEnabled,
            action: action
        )
    }
}

/// Outlined neutral button for secondary actions.
public struct GhostButton: View {
    public let title: String
    public var isLoading: Bool = false
    public var isEnabled: Bool = true
    public let action: () async -> Void

    public init(
        title: String,
        isLoading: Bool = false,
        isEnabled: Bool = true,
        action: @escaping () async -> Void
    ) {
        self.title = title
        self.isLoading = isLoading
        self.isEnabled = isEnabled
        self.action = action
    }

    public var body: some View {
        PantopusButton(
            title: title,
            kind: .ghost,
            isLoading: isLoading,
            isEnabled: isEnabled,
            action: action
        )
    }
}

/// Filled error button for destructive flows (sign out, delete, etc.).
public struct DestructiveButton: View {
    public let title: String
    public var isLoading: Bool = false
    public var isEnabled: Bool = true
    public let action: () async -> Void

    public init(
        title: String,
        isLoading: Bool = false,
        isEnabled: Bool = true,
        action: @escaping () async -> Void
    ) {
        self.title = title
        self.isLoading = isLoading
        self.isEnabled = isEnabled
        self.action = action
    }

    public var body: some View {
        PantopusButton(
            title: title,
            kind: .destructive,
            isLoading: isLoading,
            isEnabled: isEnabled,
            action: action
        )
    }
}

#Preview("All states") {
    VStack(spacing: Spacing.s3) {
        PrimaryButton(title: "Continue") {}
        PrimaryButton(title: "Signing in…", isLoading: true) {}
        PrimaryButton(title: "Disabled", isEnabled: false) {}
        GhostButton(title: "Skip") {}
        DestructiveButton(title: "Delete home") {}
    }
    .padding()
    .background(Theme.Color.appBg)
}
