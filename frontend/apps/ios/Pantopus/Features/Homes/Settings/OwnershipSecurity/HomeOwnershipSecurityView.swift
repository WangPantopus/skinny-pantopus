//
//  HomeOwnershipSecurityView.swift
//  Pantopus
//
//  A14.2 (policy variant) — "Ownership & Security". Thin wrapper around
//  `GroupedListView`; the view-model owns the three radio groups, the
//  status banner, and the quorum "requires owner approval" state.
//

import SwiftUI

public struct HomeOwnershipSecurityView: View {
    @State private var viewModel: HomeOwnershipSecurityViewModel
    private let onBack: @MainActor () -> Void

    public init(
        viewModel: HomeOwnershipSecurityViewModel,
        onBack: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    public var body: some View {
        GroupedListView(dataSource: viewModel, onBack: onBack)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("homeOwnershipSecurity")
    }
}

#Preview {
    HomeOwnershipSecurityView(viewModel: HomeOwnershipSecurityViewModel(homeId: "home-1")) {}
}
