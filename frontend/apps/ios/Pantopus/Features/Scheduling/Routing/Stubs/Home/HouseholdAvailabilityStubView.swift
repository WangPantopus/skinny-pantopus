//
//  HouseholdAvailabilityStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — F8 My Availability · Stream I10.
//  Placeholder for the I10 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for F8 (My Availability). Stream I10 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class HouseholdAvailabilityStubViewModel {
    let homeId: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        homeId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.homeId = homeId
        self.push = push
    }
}

struct HouseholdAvailabilityStubView: View {
    @State private var viewModel: HouseholdAvailabilityStubViewModel

    init(viewModel: HouseholdAvailabilityStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        MyHouseholdAvailabilityView(
            viewModel: MyHouseholdAvailabilityViewModel(
                homeId: viewModel.homeId,
                push: viewModel.push
            )
        )
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        HouseholdAvailabilityStubView(viewModel: HouseholdAvailabilityStubViewModel(homeId: "preview") { _ in })
    }
}
#endif
