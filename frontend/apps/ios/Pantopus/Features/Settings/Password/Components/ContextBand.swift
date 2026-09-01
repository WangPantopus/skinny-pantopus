//
//  ContextBand.swift
//  Pantopus
//
//  A13.14 — quiet identity reminder pinned under the top bar of the Change
//  Password screen. Surfaces who you're signed in as and when the password
//  was last changed so the act of changing it has context.
//

import SwiftUI

/// Full-width band: mail icon + "Signed in as …" over a clock icon +
/// "Last changed …". Reads as a single block to VoiceOver.
@MainActor
public struct ContextBand: View {
    private let email: String
    private let lastChanged: String

    public init(email: String, lastChanged: String) {
        self.email = email
        self.lastChanged = lastChanged
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack(spacing: Spacing.s2) {
                Icon(.mail, size: 14, color: Theme.Color.appTextSecondary)
                Text("Signed in as \(email)")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            HStack(spacing: Spacing.s2) {
                Icon(.clock, size: 13, color: Theme.Color.appTextMuted)
                Text("Last changed \(lastChanged)")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Signed in as \(email). Last changed \(lastChanged).")
        .accessibilityIdentifier("passwordChangeContextBand")
    }
}

#Preview {
    ContextBand(email: "maria@pantopus.app", lastChanged: "84 days ago")
        .background(Theme.Color.appBg)
}
