//
//  MessageTemplateEditorStubView.swift
//  Pantopus
//
//  Foundation (I0b) routed stub — H5 Template Editor · Stream I16.
//  Placeholder for the I16 feature stream to replace. The init is
//  wired with the route payload + `push`; the route/router are frozen.
//
//

import SwiftUI

/// Routed-screen view-model stub for H5 (Template Editor). Stream I16 replaces
/// the body; `push` navigates deeper scheduling routes.
@Observable
@MainActor
final class MessageTemplateEditorStubViewModel {
    let owner: SchedulingOwner
    let templateId: String?
    /// Pushes a deeper scheduling route onto the host navigation stack.
    let push: @MainActor (SchedulingRoute) -> Void

    init(
        owner: SchedulingOwner,
        templateId: String?,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        self.owner = owner
        self.templateId = templateId
        self.push = push
    }
}

struct MessageTemplateEditorStubView: View {
    @State private var viewModel: MessageTemplateEditorStubViewModel

    init(viewModel: MessageTemplateEditorStubViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        MessageTemplateEditorView(owner: viewModel.owner, templateId: viewModel.templateId)
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        MessageTemplateEditorStubView(viewModel: MessageTemplateEditorStubViewModel(owner: .personal, templateId: nil) { _ in })
    }
}
#endif
