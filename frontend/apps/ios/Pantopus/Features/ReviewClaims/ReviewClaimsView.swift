//
//  ReviewClaimsView.swift
//  Pantopus
//
//  P1.1 — Admin Review-claims queue. Thin wrapper around the shared
//  `ListOfRowsView`. The shell handles the back chevron, tabbed
//  pending/approved/rejected strip, the warning-tinted "N claims
//  awaiting review" banner, and the avatar-first claim rows with their
//  inline "Review claim" footer.
//

import SwiftUI

public struct ReviewClaimsView: View {
    @State private var viewModel: ReviewClaimsViewModel

    public init(viewModel: ReviewClaimsViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("reviewClaims")
    }
}

#Preview {
    NavigationStack {
        ReviewClaimsView(
            viewModel: ReviewClaimsViewModel { _ in }
        )
    }
}
