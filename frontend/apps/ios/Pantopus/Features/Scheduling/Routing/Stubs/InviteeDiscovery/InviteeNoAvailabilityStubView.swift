//
//  InviteeNoAvailabilityStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — C8 No Availability · Stream I5.
//  Placeholder for the I5 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for C8 (No Availability). Stream I5 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class InviteeNoAvailabilityStubViewModel {
    let slug: String
    let eventTypeSlug: String
    let tz: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        slug: String,
        eventTypeSlug: String,
        tz: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.slug = slug
        self.eventTypeSlug = eventTypeSlug
        self.tz = tz
        self.push = push
    }
}

struct InviteeNoAvailabilityStubView: View {
    private let viewModel: NoAvailabilityViewModel

    init(viewModel stub: InviteeNoAvailabilityStubViewModel) {
        viewModel = NoAvailabilityViewModel(
            slug: stub.slug,
            eventTypeSlug: stub.eventTypeSlug,
            tz: stub.tz,
            push: stub.push,
            client: SchedulingClient.shared
        )
    }

    var body: some View {
        NoAvailabilityView(viewModel: viewModel)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        InviteeNoAvailabilityStubView(viewModel: InviteeNoAvailabilityStubViewModel(
            slug: "preview",
            eventTypeSlug: "preview",
            tz: "preview"
        ) { _ in })
    }
}
#endif
