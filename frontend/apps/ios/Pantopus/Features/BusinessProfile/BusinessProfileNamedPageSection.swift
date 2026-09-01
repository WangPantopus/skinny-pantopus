//
//  BusinessProfileNamedPageSection.swift
//  Pantopus
//
//  C4 — the named custom-page section on the public business profile. Shown
//  only when the entry point carried a slug (`pantopus://b/:username/:slug`,
//  or `pantopus://business/:username?pageSlug=…`). Mirrors RN
//  `src/app/business/[username].tsx:495-517`.
//

import SwiftUI

/// Renders the named page's title, description and published blocks — or the
/// loading / failure copy RN uses for the same states.
@MainActor
struct BusinessProfileNamedPageSection: View {
    let state: BusinessProfileNamedPageState

    var body: some View {
        switch state {
        case .none:
            EmptyView()
        case let .loading(title):
            section(title: title) {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Shimmer(height: 18, cornerRadius: Radii.sm)
                    Shimmer(height: 72, cornerRadius: Radii.md)
                }
                .accessibilityIdentifier("businessProfile.page.loading")
            }
        case let .failed(title, message):
            section(title: title) {
                Text(message)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityIdentifier("businessProfile.page.error")
            }
        case let .loaded(title, description, blocks):
            section(title: title) {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    if let description, !description.isEmpty {
                        Text(description)
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    if blocks.isEmpty {
                        Text("This business page has no published content yet.")
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .accessibilityIdentifier("businessProfile.page.empty")
                    } else {
                        BusinessPageBlocksPreview(blocks: blocks)
                    }
                }
            }
        }
    }

    private func section(
        title: String,
        @ViewBuilder inner: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(title)
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appTextStrong)
            inner()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, Spacing.s4)
        .accessibilityIdentifier("businessProfile.page")
    }
}
