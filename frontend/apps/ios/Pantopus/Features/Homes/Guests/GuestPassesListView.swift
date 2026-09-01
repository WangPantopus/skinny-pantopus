//
//  GuestPassesListView.swift
//  Pantopus
//
//  A13.6 — Guest-pass management. Thin wrapper around `ListOfRowsView`
//  that adds the revoke confirm alert and the revoke toast.
//
//  RN parity target: `src/app/homes/[id]/share.tsx:84-90,152-190`.
//

import SwiftUI

public struct GuestPassesListView: View {
    @State private var viewModel: GuestPassesListViewModel
    @State private var revokeConfirm: RevokeTarget?

    private let onAddGuest: () -> Void

    public init(homeId: String, onAddGuest: @escaping () -> Void = {}) {
        self.onAddGuest = onAddGuest
        _viewModel = State(initialValue: GuestPassesListViewModel(homeId: homeId))
    }

    public var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("guestPassesList")
            .task { await viewModel.load() }
            .refreshable { await viewModel.refresh() }
            .onAppear { Task { await viewModel.refreshIfLoaded() } }
            .onChange(of: viewModel.pendingEvent) { _, event in
                handle(event)
            }
            .overlay(alignment: .bottom) {
                if let toast = viewModel.toast {
                    ToastView(message: toast)
                        .padding(.bottom, Spacing.s12)
                        .task {
                            try? await Task.sleep(nanoseconds: 2_000_000_000)
                            viewModel.toast = nil
                        }
                        .transition(.opacity)
                        .accessibilityIdentifier("guestPassesToast")
                }
            }
            .pantopusAnimation(.componentState, value: viewModel.toast)
            .alert(
                "Revoke access?",
                isPresented: Binding(
                    get: { revokeConfirm != nil },
                    set: { if !$0 { revokeConfirm = nil } }
                ),
                presenting: revokeConfirm
            ) { target in
                Button("Revoke \(target.label)", role: .destructive) {
                    Task { await viewModel.revoke(passId: target.passId) }
                    revokeConfirm = nil
                }
                .accessibilityIdentifier("guestPassesList_revokeConfirm")
                Button("Cancel", role: .cancel) { revokeConfirm = nil }
            } message: { target in
                Text("\(target.label) will immediately lose access to this home.")
            }
    }

    private func handle(_ event: GuestPassesEvent?) {
        guard let event else { return }
        switch event {
        case .openAddGuest:
            onAddGuest()
        case let .confirmRevoke(passId, label):
            revokeConfirm = RevokeTarget(passId: passId, label: label)
        }
        viewModel.pendingEvent = nil
    }

    private struct RevokeTarget: Identifiable, Equatable {
        let passId: String
        let label: String
        var id: String {
            passId
        }
    }
}

#Preview {
    NavigationStack {
        GuestPassesListView(homeId: "preview-home-id")
    }
}
