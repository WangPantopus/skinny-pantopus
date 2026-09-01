//
//  VerificationCenterView.swift
//  Pantopus
//
//  Thin wrapper around `GroupedListView` backed by
//  `VerificationCenterViewModel`. Same chrome as the rest of Settings.
//

import SwiftUI

public struct VerificationCenterView: View {
    @State private var viewModel: VerificationCenterViewModel
    private let onBack: @MainActor () -> Void

    init(
        viewModel: VerificationCenterViewModel = VerificationCenterViewModel(),
        onBack: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    public var body: some View {
        GroupedListView(dataSource: viewModel, onBack: onBack)
            .accessibilityIdentifier("verificationCenter")
    }
}

#Preview {
    NavigationStack {
        VerificationCenterView {}
    }
}
