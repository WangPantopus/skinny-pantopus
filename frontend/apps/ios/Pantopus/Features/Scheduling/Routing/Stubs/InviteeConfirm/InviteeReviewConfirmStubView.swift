//
//  InviteeReviewConfirmStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — D2 Review & Confirm · Stream I6.
//  Placeholder for the I6 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for D2 (Review & Confirm). Stream I6 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class InviteeReviewConfirmStubViewModel {
    let slug: String
    let eventTypeSlug: String
    let start: String
    let tz: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        slug: String,
        eventTypeSlug: String,
        start: String,
        tz: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.slug = slug
        self.eventTypeSlug = eventTypeSlug
        self.start = start
        self.tz = tz
        self.push = push
    }
}

/// Stream I6 adapter — builds the real D2 view-model from the routed stub payload
/// and renders the real review/confirm screen. The D1 draft is read back from the
/// in-session draft store (the frozen route can't carry it).
struct InviteeReviewConfirmStubView: View {
    private let viewModel: InviteeReviewConfirmViewModel

    init(viewModel stub: InviteeReviewConfirmStubViewModel) {
        viewModel = InviteeReviewConfirmViewModel(
            slug: stub.slug,
            eventTypeSlug: stub.eventTypeSlug,
            start: stub.start,
            tz: stub.tz,
            push: stub.push,
            client: SchedulingClient.shared
        )
    }

    var body: some View {
        InviteeReviewConfirmView(viewModel: viewModel)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        InviteeReviewConfirmStubView(viewModel: InviteeReviewConfirmStubViewModel(
            slug: "preview",
            eventTypeSlug: "preview",
            start: "preview",
            tz: "preview"
        ) { _ in })
    }
}
#endif
