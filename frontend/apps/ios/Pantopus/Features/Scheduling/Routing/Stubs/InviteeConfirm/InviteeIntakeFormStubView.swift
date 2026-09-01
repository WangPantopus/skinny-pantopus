//
//  InviteeIntakeFormStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — D1 Your Details · Stream I6.
//  Placeholder for the I6 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for D1 (Your Details). Stream I6 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class InviteeIntakeFormStubViewModel {
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

/// Stream I6 adapter — builds the real D1 view-model from the routed stub payload
/// and renders the real intake form. Prefills name/email when the invitee is
/// signed in to the app.
struct InviteeIntakeFormStubView: View {
    private let viewModel: InviteeIntakeFormViewModel

    init(viewModel stub: InviteeIntakeFormStubViewModel) {
        var prefill: InviteePrefill?
        if case let .signedIn(user) = AuthManager.shared.state, !user.email.isEmpty {
            prefill = InviteePrefill(name: user.displayName ?? "", email: user.email)
        }
        viewModel = InviteeIntakeFormViewModel(
            slug: stub.slug,
            eventTypeSlug: stub.eventTypeSlug,
            start: stub.start,
            tz: stub.tz,
            prefill: prefill,
            push: stub.push,
            client: SchedulingClient.shared
        )
    }

    var body: some View {
        InviteeIntakeFormView(viewModel: viewModel)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        InviteeIntakeFormStubView(viewModel: InviteeIntakeFormStubViewModel(
            slug: "preview",
            eventTypeSlug: "preview",
            start: "preview",
            tz: "preview"
        ) { _ in })
    }
}
#endif
