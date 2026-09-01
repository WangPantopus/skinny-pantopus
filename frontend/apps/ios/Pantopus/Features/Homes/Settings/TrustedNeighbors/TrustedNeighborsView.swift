//
//  TrustedNeighborsView.swift
//  Pantopus
//
//  A14.1 — Trusted neighbors list placeholder until approve/list API lands.
//  Mirrors Android `TrustedNeighborsScreen`.
//

// swiftlint:disable line_length

import SwiftUI

public struct TrustedNeighborsView: View {
    private let onBack: @MainActor () -> Void

    public init(onBack: @escaping @MainActor () -> Void) {
        self.onBack = onBack
    }

    public var body: some View {
        ContentDetailShell(
            title: "Trusted neighbors",
            onBack: onBack,
            header: { EmptyView() },
            body: {
                EmptyState(
                    icon: .users,
                    headline: "No trusted neighbors yet",
                    subcopy: "Trusted neighbors can receive packages and help with access when you're away. Approved neighbors will appear here."
                )
            },
            cta: { EmptyView() }
        )
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("trustedNeighbors")
    }
}
