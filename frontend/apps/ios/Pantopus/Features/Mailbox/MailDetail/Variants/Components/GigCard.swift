//
//  GigCard.swift
//  Pantopus
//
//  White rounded card primitive used by the A17.6 Gig mail variant
//  sub-surfaces — bidder profile, post summary, other-bids strip,
//  next-steps timeline. Mirrors the Android `GigCard.kt` shape so the
//  two platforms compose the same gig body the same way. `padded =
//  false` lets cards that draw their own section dividers manage edge
//  insets per-section.
//

import SwiftUI

@MainActor
struct GigCard<Content: View>: View {
    var padded: Bool = true
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(padded ? Spacing.s3 : 0)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
    }
}

/// Uppercase section eyebrow shared by the gig cards.
struct GigSectionLabel: View {
    let text: String
    var body: some View {
        Text(text)
            .pantopusTextStyle(.overline)
            .foregroundStyle(Theme.Color.appTextSecondary)
    }
}
