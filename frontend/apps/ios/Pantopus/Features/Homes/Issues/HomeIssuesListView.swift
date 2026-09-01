//
//  HomeIssuesListView.swift
//  Pantopus
//
//  Per-home issue tracker. Thin wrapper around the shared
//  `ListOfRowsView` — behaviour lives in `HomeIssuesListViewModel`.
//  Wired to `GET/POST /api/homes/:id/issues` and
//  `PUT /api/homes/:id/issues/:issueId`.
//
//  Deliberately separate from `MaintenanceListView` (which lists the
//  maintenance-task log at `/api/homes/:id/maintenance`) — the two are
//  different backend collections and both ship.
//

import SwiftUI

public struct HomeIssuesListView: View {
    @State private var viewModel: HomeIssuesListViewModel
    @State private var reportingIssue = false
    @State private var dismissTarget: DismissTarget?

    private let homeId: String

    public init(homeId: String) {
        self.homeId = homeId
        _viewModel = State(initialValue: HomeIssuesListViewModel(homeId: homeId))
    }

    public var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("homeIssuesList")
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .onChange(of: viewModel.pendingEvent) { _, event in
                handle(event)
            }
            .sheet(isPresented: $reportingIssue) {
                ReportIssueFormView(
                    viewModel: ReportIssueFormViewModel { title, description in
                        await viewModel.createIssue(title: title, description: description)
                    }
                ) { reportingIssue = false }
            }
            .alert(
                "Dismiss issue?",
                isPresented: Binding(
                    get: { dismissTarget != nil },
                    set: { if !$0 { dismissTarget = nil } }
                ),
                presenting: dismissTarget
            ) { target in
                Button("Dismiss", role: .destructive) {
                    let issueId = target.id
                    Task { await viewModel.dismissIssue(issueId: issueId) }
                    dismissTarget = nil
                }
                .accessibilityIdentifier("homeIssues_dismissConfirm")
                Button("Cancel", role: .cancel) { dismissTarget = nil }
            } message: { target in
                Text("“\(target.title)” will be moved to History. You can still see it there.")
            }
            .overlay(alignment: .bottom) {
                if let toast = viewModel.toast {
                    ToastView(message: toast)
                        .padding(.bottom, Spacing.s10)
                        .task {
                            try? await Task.sleep(nanoseconds: 2_000_000_000)
                            viewModel.toast = nil
                        }
                        .transition(.opacity)
                        .accessibilityIdentifier("homeIssues_toast")
                }
            }
    }

    private func handle(_ event: HomeIssuesEvent?) {
        guard let event else { return }
        switch event {
        case .openReport:
            reportingIssue = true
        case let .confirmDismiss(issueId, title):
            dismissTarget = DismissTarget(id: issueId, title: title)
        }
        viewModel.pendingEvent = nil
    }

    private struct DismissTarget: Identifiable, Equatable {
        let id: String
        let title: String
    }
}

#Preview {
    NavigationStack {
        HomeIssuesListView(homeId: "preview-home-id")
    }
}
