//
//  IdentityStrip.swift
//  Pantopus
//
//  P4.2 — A13.10 Edit Business Page. Violet identity strip rendered
//  under the top bar in the published variant. Replaced with
//  `CompletionStrip` in the setup variant.
//

import SwiftUI

/// Slim 32pt violet band with the business identity tile (store icon +
/// name) and a quiet "Published · N days ago" trailing meta. Renders
/// flush under the top bar in the published variant of the editor.
@MainActor
public struct EditBusinessIdentityStrip: View {
    private let name: String
    private let lastPublishedLabel: String

    public init(name: String, lastPublishedLabel: String) {
        self.name = name
        self.lastPublishedLabel = lastPublishedLabel
    }

    public var body: some View {
        HStack(spacing: Spacing.s2) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .fill(Theme.Color.business)
                    .frame(width: 18, height: 18)
                Icon(.building2, size: 10, color: Theme.Color.appTextInverse)
            }
            Text(name)
                .font(.system(size: PantopusTextStyle.caption.size, weight: .semibold))
                .foregroundStyle(Theme.Color.businessDark)
                .lineLimit(1)
            Spacer(minLength: Spacing.s2)
            Text(lastPublishedLabel)
                .font(.system(size: PantopusTextStyle.caption.size - 1))
                .foregroundStyle(Theme.Color.businessDark.opacity(0.7))
                .lineLimit(1)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.businessBg)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Theme.Color.business.opacity(0.18))
                .frame(height: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(name), \(lastPublishedLabel)")
        .accessibilityIdentifier("editBusinessPage.identityStrip")
    }
}

#Preview {
    EditBusinessIdentityStrip(
        name: "Roost Café · Elm Park",
        lastPublishedLabel: "Published · 6 days ago"
    )
}
