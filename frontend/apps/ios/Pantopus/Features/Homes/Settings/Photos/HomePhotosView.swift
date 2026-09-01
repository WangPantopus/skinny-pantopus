//
//  HomePhotosView.swift
//  Pantopus
//
//  A14.1 — Home photos empty state; routes users to the documents vault
//  for uploads until a dedicated gallery ships. Mirrors Android
//  `HomePhotosScreen`.
//

import SwiftUI

public struct HomePhotosView: View {
    private let onBack: @MainActor () -> Void
    private let onOpenDocuments: @MainActor () -> Void

    public init(
        onBack: @escaping @MainActor () -> Void,
        onOpenDocuments: @escaping @MainActor () -> Void
    ) {
        self.onBack = onBack
        self.onOpenDocuments = onOpenDocuments
    }

    public var body: some View {
        ContentDetailShell(
            title: "Photos",
            onBack: onBack,
            header: { EmptyView() },
            body: {
                EmptyState(
                    icon: .image,
                    headline: "Home photos",
                    subcopy: "Store exterior and room photos in your home documents vault for insurance and maintenance records.",
                    cta: .init(title: "Open documents") { onOpenDocuments() }
                )
            },
            cta: {
                Button(action: onOpenDocuments) {
                    Text("Upload in documents")
                        .font(.system(size: 14.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Theme.Color.primary600)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        )
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("homePhotos")
    }
}
