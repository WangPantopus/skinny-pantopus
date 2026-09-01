//
//  DocumentsView.swift
//  Pantopus
//
//  T6.4b / P17 — Concrete List-of-Rows screen backed by
//  `DocumentsViewModel`. Wired to
//  `GET /api/homes/:id/documents` (route `backend/routes/home.js:4944`).
//

import SwiftUI

struct DocumentsView: View {
    @State private var viewModel: DocumentsViewModel

    init(viewModel: DocumentsViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("documentsList")
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .onAppear { Analytics.track(.screenDocumentsViewed) }
    }
}

#Preview {
    NavigationStack {
        DocumentsView(viewModel: DocumentsViewModel(homeId: "preview"))
    }
}
