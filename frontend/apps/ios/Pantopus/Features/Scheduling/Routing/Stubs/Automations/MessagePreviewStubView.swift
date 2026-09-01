//
//  MessagePreviewStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — H7 Message Preview · Stream I16.
//  Placeholder for the I16 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for H7 (Message Preview). Stream I16 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class MessagePreviewStubViewModel {
    let owner: SchedulingOwner
    let templateId: String
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        owner: SchedulingOwner,
        templateId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.owner = owner
        self.templateId = templateId
        self.push = push
    }
}

struct MessagePreviewStubView: View {
    @State private var viewModel: MessagePreviewStubViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: MessagePreviewStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        MessagePreviewView(owner: viewModel.owner, templateId: viewModel.templateId) { dismiss() }
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        MessagePreviewStubView(viewModel: MessagePreviewStubViewModel(owner: .personal, templateId: "preview") { _ in })
    }
}
#endif
