//
//  OffersView.swift
//  Pantopus
//
//  T5.2.4 — Cross-listing Offers. Thin wrapper around the shared
//  `ListOfRowsView`. Two tabs (Received / Sent), no FAB, filter icon in
//  the top-bar trailing slot. Row taps surface a `BidDTO` to the parent
//  navigation stack so we can push the gig (offer) detail.
//
//  RN parity: pending Received rows carry Accept (with Stripe
//  PaymentSheet authorization) + Reject; pending / countered Sent rows
//  carry Withdraw. Each is confirmed before it fires and toasts either
//  way (`pantopus/frontend/apps/mobile/src/app/offers.tsx`).
//

import SwiftUI

public struct OffersView: View {
    @State private var viewModel: OffersViewModel

    public init(viewModel: OffersViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        @Bindable var bindable = viewModel
        return ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("offers")
            .sheet(isPresented: $bindable.isFilterPresented) {
                ActivityFilterSheet(
                    statusTitle: viewModel.statusFilterTitle,
                    statusOptions: viewModel.statusFilterOptions,
                    sortOptions: viewModel.sortFilterOptions,
                    filter: viewModel.activityFilter,
                    onApply: { viewModel.applyFilter($0) },
                    onClose: { viewModel.isFilterPresented = false }
                )
            }
            .confirmationDialog(
                acceptTitle,
                isPresented: Binding(
                    get: { viewModel.acceptCandidate != nil },
                    set: { if !$0 { viewModel.acceptCandidate = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button(acceptCTA) { Task { await viewModel.confirmAccept() } }
                    .accessibilityIdentifier("offers.acceptConfirm")
                Button(acceptCancel, role: .cancel) { viewModel.acceptCandidate = nil }
            } message: {
                Text(acceptMessage)
            }
            .confirmationDialog(
                "Reject offer",
                isPresented: Binding(
                    get: { viewModel.rejectCandidate != nil },
                    set: { if !$0 { viewModel.rejectCandidate = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button("Reject", role: .destructive) { Task { await viewModel.confirmReject() } }
                    .accessibilityIdentifier("offers.rejectConfirm")
                Button("Keep offer", role: .cancel) { viewModel.rejectCandidate = nil }
            } message: {
                Text(rejectMessage)
            }
            .confirmationDialog(
                "Withdraw offer",
                isPresented: Binding(
                    get: { viewModel.withdrawCandidate != nil },
                    set: { if !$0 { viewModel.withdrawCandidate = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button("Withdraw", role: .destructive) { Task { await viewModel.confirmWithdraw() } }
                    .accessibilityIdentifier("offers.withdrawConfirm")
                Button("Keep offer", role: .cancel) { viewModel.withdrawCandidate = nil }
            } message: {
                Text(withdrawMessage)
            }
            .overlay(alignment: .bottom) { toastOverlay }
    }

    // MARK: - Confirm copy

    private var acceptTitle: String {
        viewModel.acceptCandidate.map(OffersViewModel.acceptConfirmTitle(for:)) ?? "Accept offer"
    }

    private var acceptMessage: String {
        viewModel.acceptCandidate.map(OffersViewModel.acceptConfirmMessage(for:)) ?? "Accept this offer?"
    }

    private var acceptCTA: String {
        viewModel.acceptCandidate.map(OffersViewModel.acceptConfirmCTA(for:)) ?? "Accept"
    }

    private var acceptCancel: String {
        (viewModel.acceptCandidate?.bidAmount ?? 0) > 0 ? "Not now" : "Cancel"
    }

    private var rejectMessage: String {
        let title = viewModel.rejectCandidate?.gig?.title ?? "this task"
        return "The bidder on \u{201C}\(title)\u{201D} is notified and can't be selected afterwards."
    }

    private var withdrawMessage: String {
        let title = viewModel.withdrawCandidate?.gig?.title ?? "this task"
        return "Your offer on \u{201C}\(title)\u{201D} will be removed. You can bid again while it stays open."
    }

    // MARK: - Toast

    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toast {
            ToastView(message: toast)
                .padding(.bottom, Spacing.s8)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    viewModel.toast = nil
                }
                .accessibilityIdentifier("offers-toast")
        }
    }
}

#Preview {
    NavigationStack {
        OffersView(viewModel: OffersViewModel())
    }
}
