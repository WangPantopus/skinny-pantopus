//
//  ReviewSignupsView.swift
//  Pantopus
//
//  T6.6c (P26.5) — Review signups. Thin wrapper around the shared
//  `ListOfRowsView`. The shell renders the back chevron, title,
//  trailing share action, filter chip strip, and avatar-first signup
//  rows with per-row status chip + Confirm / Edit footer.
//

import SwiftUI

public struct ReviewSignupsView: View {
    @State private var viewModel: ReviewSignupsViewModel
    private let reservationsStore: SupportTrainReservationsStore

    public init(
        viewModel: ReviewSignupsViewModel,
        reservationsStore: SupportTrainReservationsStore = .shared
    ) {
        _viewModel = State(initialValue: viewModel)
        self.reservationsStore = reservationsStore
    }

    public var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("reviewSignups")
            // Pull in any edits the EditSignup form pushed while we
            // were off the stack — keeps the row in sync without a
            // re-fetch. The optimistic-confirm path uses the same
            // local-cache pattern.
            .onAppear { viewModel.applyPendingEdits(from: reservationsStore) }
            .onChange(of: reservationsStore.revision) { _, _ in
                viewModel.applyPendingEdits(from: reservationsStore)
            }
    }
}

#Preview {
    NavigationStack {
        ReviewSignupsView(
            viewModel: ReviewSignupsViewModel(supportTrainId: "preview")
        )
    }
}
