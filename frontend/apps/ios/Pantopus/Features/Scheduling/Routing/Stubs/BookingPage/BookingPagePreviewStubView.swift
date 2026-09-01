//
//  BookingPagePreviewStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — C2 Page Preview · Stream I4.
//  Placeholder for the I4 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for C2 (Page Preview). Stream I4 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class BookingPagePreviewStubViewModel {
    let owner: SchedulingOwner
    let slug: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        owner: SchedulingOwner,
        slug: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.owner = owner
        self.slug = slug
        self.push = push
    }
}

struct BookingPagePreviewStubView: View {
    @State private var viewModel: BookingPagePreviewStubViewModel

    init(viewModel: BookingPagePreviewStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        BookingPagePreviewView(owner: viewModel.owner, slug: viewModel.slug)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        BookingPagePreviewStubView(viewModel: BookingPagePreviewStubViewModel(owner: .personal, slug: "preview") { _ in })
    }
}
#endif
