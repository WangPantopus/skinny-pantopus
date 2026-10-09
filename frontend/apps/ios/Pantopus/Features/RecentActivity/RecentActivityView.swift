//
//  RecentActivityView.swift
//  Pantopus
//
//  P1.5 — thin wrapper around `ListOfRowsView` for the standalone
//  Recent Activity log reached from the Hub's `HubRecentActivity`
//  "See all" CTA.
//

import SwiftUI

public struct RecentActivityView: View {
    @State private var viewModel: RecentActivityViewModel

    public init(viewModel: RecentActivityViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("recentActivity")
            // New activity (a notification, a message, a household change): the open log re-reads.
            .refreshesOnStoreChange(affects: { note in
                HubStoreReads.topics.contains { note.names(topic: $0) } || note.names(kind: HubStoreReads.kind)
            }, perform: { await viewModel.load() })
    }
}

#Preview {
    NavigationStack {
        RecentActivityView(viewModel: RecentActivityViewModel())
    }
}
