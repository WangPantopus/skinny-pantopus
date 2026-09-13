import SwiftUI

public struct LeaveHomeView: View {
    @State private var viewModel: LeaveHomeViewModel
    private let onBack: @MainActor () -> Void
    private let onLeft: @MainActor () -> Void

    public init(
        viewModel: LeaveHomeViewModel,
        onBack: @escaping @MainActor () -> Void,
        onLeft: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onLeft = onLeft
    }

    public var body: some View {
        HomeMemberRemovalView(model: viewModel.removal) { original in
            if viewModel.acknowledgedSelfRemoval(original) { onLeft() } else { onBack() }
        }
        .toolbar(.hidden, for: .tabBar)
        .accessibilityIdentifier("leaveHome")
    }
}
