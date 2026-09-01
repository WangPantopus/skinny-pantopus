//
//  InviteeSlotPickerStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — C6 Pick a Time · Stream I5.
//  Placeholder for the I5 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for C6 (Pick a Time). Stream I5 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class InviteeSlotPickerStubViewModel {
    let slug: String
    let eventTypeSlug: String
    let tz: String
    let oneOffToken: String?
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        slug: String,
        eventTypeSlug: String,
        tz: String,
        oneOffToken: String?,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.slug = slug
        self.eventTypeSlug = eventTypeSlug
        self.tz = tz
        self.oneOffToken = oneOffToken
        self.push = push
    }
}

struct InviteeSlotPickerStubView: View {
    private let viewModel: DiscoverySlotPickerViewModel

    init(viewModel stub: InviteeSlotPickerStubViewModel) {
        viewModel = DiscoverySlotPickerViewModel(
            slug: stub.slug,
            eventTypeSlug: stub.eventTypeSlug,
            tz: stub.tz,
            oneOffToken: stub.oneOffToken,
            push: stub.push,
            client: SchedulingClient.shared
        )
    }

    var body: some View {
        DiscoverySlotPickerView(viewModel: viewModel)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        InviteeSlotPickerStubView(viewModel: InviteeSlotPickerStubViewModel(
            slug: "preview",
            eventTypeSlug: "preview",
            tz: "preview",
            oneOffToken: nil
        ) { _ in })
    }
}
#endif
