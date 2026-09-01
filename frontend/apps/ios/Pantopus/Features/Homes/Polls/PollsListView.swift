//
//  PollsListView.swift
//  Pantopus
//
//  Concrete List-of-Rows screen backed by `PollsListViewModel`. Wired
//  to `GET /api/homes/:id/polls` (route `backend/routes/home.js:6984`).
//

import SwiftUI

struct PollsListView: View {
    @State private var viewModel: PollsListViewModel
    @State private var confirmTarget: ConfirmTarget?

    init(viewModel: PollsListViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("pollsList")
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .onAppear { Analytics.track(.screenPollsViewed) }
            .onChange(of: viewModel.pendingEvent) { _, event in
                handle(event)
            }
            .confirmationDialog(
                confirmTarget?.dialogTitle ?? "",
                isPresented: Binding(
                    get: { confirmTarget != nil },
                    set: { if !$0 { confirmTarget = nil } }
                ),
                titleVisibility: .visible,
                presenting: confirmTarget
            ) { target in
                if target.isDestructive {
                    Button("Delete", role: .destructive) {
                        Task { await viewModel.deletePoll(pollId: target.pollId) }
                        confirmTarget = nil
                    }
                    .accessibilityIdentifier("pollsList_deleteConfirm")
                } else {
                    Button("Close") {
                        Task { await viewModel.closePoll(pollId: target.pollId) }
                        confirmTarget = nil
                    }
                    .accessibilityIdentifier("pollsList_closeConfirm")
                }
                Button("Cancel", role: .cancel) { confirmTarget = nil }
            } message: { target in
                Text(target.message)
            }
            .alert(
                "Something went wrong",
                isPresented: Binding(
                    get: { viewModel.actionError != nil },
                    set: { if !$0 { viewModel.actionError = nil } }
                )
            ) {
                Button("OK", role: .cancel) { viewModel.actionError = nil }
            } message: {
                Text(viewModel.actionError ?? "")
            }
    }

    private func handle(_ event: PollsListEvent?) {
        guard let event else { return }
        switch event {
        case let .confirmClose(pollId, title):
            confirmTarget = ConfirmTarget(pollId: pollId, title: title, isDestructive: false)
        case let .confirmDelete(pollId, title):
            confirmTarget = ConfirmTarget(pollId: pollId, title: title, isDestructive: true)
        }
        viewModel.pendingEvent = nil
    }

    private struct ConfirmTarget: Identifiable, Equatable {
        let pollId: String
        let title: String
        let isDestructive: Bool
        var id: String {
            "\(pollId)-\(isDestructive)"
        }

        var dialogTitle: String {
            isDestructive ? "Delete poll" : "Close poll"
        }

        /// Mirrors RN's prompts (`src/app/homes/[id]/polls.tsx:76 / :86`)
        /// but names the poll the action applies to.
        var message: String {
            isDestructive
                ? "Delete “\(title)”? This removes it from the household."
                : "Close “\(title)” to new votes?"
        }
    }
}

#Preview {
    NavigationStack {
        PollsListView(viewModel: PollsListViewModel(homeId: "preview"))
    }
}
