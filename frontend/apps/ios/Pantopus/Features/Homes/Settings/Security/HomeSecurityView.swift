//
//  HomeSecurityView.swift
//  Pantopus
//
//  P5.1 / A14.2 — Per-home Security toggles. Thin wrapper around
//  `GroupedListView`; the view-model owns the toggle state and the
//  helper-line projection.
//

import SwiftUI

public struct HomeSecurityView: View {
    @State private var viewModel: HomeSecurityViewModel
    private let onBack: @MainActor () -> Void

    public init(
        viewModel: HomeSecurityViewModel,
        onBack: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    public var body: some View {
        GroupedListView(dataSource: viewModel, onBack: onBack)
            .accessibilityIdentifier("homeSecurity")
    }
}

#Preview("Balanced") {
    HomeSecurityView(viewModel: HomeSecurityViewModel(homeId: "home-1", variant: .balanced)) {}
}

#Preview("Strict") {
    HomeSecurityView(viewModel: HomeSecurityViewModel(homeId: "home-1", variant: .strict)) {}
}
