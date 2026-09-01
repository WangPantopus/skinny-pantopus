//
//  OwnerComposeFab.swift
//  Pantopus
//
//  C2 — "Post as this business". React Native floats the same circular
//  composer FAB over the owner dashboard
//  (`src/app/businesses/[id]/index.tsx:371-379`), gated on
//  `access.role_base ∈ owner | admin | editor`. Tapping it opens the
//  shared Pulse composer pointed at
//  `POST /api/businesses/:businessId/posts`.
//

import SwiftUI

/// Business-violet circular compose FAB for the owner dashboard.
@MainActor
struct OwnerComposeFab: View {
    let action: @MainActor () -> Void

    var body: some View {
        Button(action: action) {
            Icon(.edit2, size: 20, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                .frame(width: 52, height: 52)
                .background(Theme.Color.business, in: Circle())
        }
        .buttonStyle(.plain)
        .pantopusShadow(.lg)
        .accessibilityLabel("Post as this business")
        .accessibilityIdentifier("businessOwner.composePost")
    }
}
