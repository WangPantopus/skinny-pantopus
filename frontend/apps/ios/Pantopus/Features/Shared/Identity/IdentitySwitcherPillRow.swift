//
//  IdentitySwitcherPillRow.swift
//  Pantopus
//
//  Pill-row identity switcher. Three (or more) equal-width capsule
//  buttons inside a single outer pill — tap rebinds the active
//  identity. Used by the Me tab today; Identity Center reuses the
//  same component, just with a different identity list.
//

import SwiftUI

/// Render-only choice for the switcher. Feature code projects its own
/// identity enum into this so the component stays generic.
public struct IdentityOption: Identifiable, Sendable, Hashable {
    public let id: String
    public let label: String
    public let icon: PantopusIcon
    public let accent: Color

    public init(id: String, label: String, icon: PantopusIcon, accent: Color) {
        self.id = id
        self.label = label
        self.icon = icon
        self.accent = accent
    }
}

/// Equal-width identity switcher pill row. Pass three or more
/// `IdentityOption`s; the active one fills with its accent colour and
/// renders icon + label in inverse text.
public struct IdentitySwitcherPillRow: View {
    private let options: [IdentityOption]
    private let activeId: String
    private let onSelect: @MainActor (String) -> Void
    private let identifierPrefix: String

    public init(
        options: [IdentityOption],
        activeId: String,
        identifierPrefix: String = "identityPill",
        onSelect: @escaping @MainActor (String) -> Void
    ) {
        self.options = options
        self.activeId = activeId
        self.identifierPrefix = identifierPrefix
        self.onSelect = onSelect
    }

    public var body: some View {
        HStack(spacing: 6) {
            ForEach(options) { option in
                let active = option.id == activeId
                Button {
                    onSelect(option.id)
                } label: {
                    HStack(spacing: 5) {
                        Icon(
                            option.icon,
                            size: 11,
                            strokeWidth: 2.4,
                            color: active ? Theme.Color.appTextInverse : Theme.Color.appTextStrong
                        )
                        Text(option.label)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(active ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 30)
                    .background(active ? option.accent : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("\(identifierPrefix)_\(option.id)")
                .accessibilityAddTraits(active ? [.isButton, .isSelected] : .isButton)
            }
        }
        .padding(3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .accessibilityIdentifier("\(identifierPrefix)Row")
    }
}

#Preview {
    IdentitySwitcherPillRow(
        options: [
            IdentityOption(id: "personal", label: "Personal", icon: .user, accent: Theme.Color.primary600),
            IdentityOption(id: "home", label: "Home", icon: .home, accent: Theme.Color.home),
            IdentityOption(id: "business", label: "Business", icon: .shieldCheck, accent: Theme.Color.business)
        ],
        activeId: "personal"
    ) { _ in }
        .padding()
        .background(Theme.Color.appBg)
}
