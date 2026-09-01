//
//  MyBidsView.swift
//  Pantopus
//
//  T5.3.1 — My bids. Thin wrapper around the shared `ListOfRowsView`.
//  The shell renders the back chevron, centered title, trailing
//  "filter" action, four tabs, banner, row cards (with footers), and
//  the extended-pill "Browse tasks" FAB. The screen-bespoke pieces
//  attached at the bottom — the withdraw confirmation sheet, the
//  P3.4 Edit Bid sheet, and the P3.4 Leave Review sheet — are driven
//  by the VM's `…Target` bindings.
//

import SwiftUI

public struct MyBidsView: View {
    @State private var viewModel: MyBidsViewModel

    public init(viewModel: MyBidsViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        // Local @Bindable wrapper so we can hand `Binding<…Target?>`
        // values to `.sheet(item:)`. `@State` + `@Observable` doesn't
        // expose a `$`-binding for nested properties directly — this
        // is the canonical SwiftUI 5 pattern.
        @Bindable var bindable = viewModel
        return ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("my-bids")
            .sheet(item: $bindable.withdrawTarget) { target in
                WithdrawBidSheet(
                    target: target,
                    onCancel: { viewModel.cancelWithdraw() },
                    onConfirm: { reason in
                        Task { await viewModel.confirmWithdraw(reason: reason) }
                    }
                )
                .presentationDetents([.medium])
            }
            .sheet(item: $bindable.editBidTarget) { target in
                EditBidSheetView(
                    target: target,
                    onSubmit: { draft in
                        await viewModel.submitEditBid(draft)
                    },
                    onCancel: { viewModel.cancelEditBid() }
                )
                .presentationDetents([.large])
            }
            .sheet(item: $bindable.leaveReviewTarget) { target in
                LeaveReviewSheetView(
                    target: target,
                    onSubmit: { draft in
                        await viewModel.submitLeaveReview(draft)
                    },
                    onCancel: { viewModel.cancelLeaveReview() }
                )
                .presentationDetents([.medium, .large])
            }
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
            .overlay(alignment: .bottom) { toastOverlay }
    }

    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toast {
            ToastView(message: toast)
                .padding(.bottom, Spacing.s8)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    viewModel.toast = nil
                }
                .accessibilityIdentifier("my-bids-toast")
        }
    }
}

// MARK: - Withdraw sheet

/// Lightweight confirmation sheet rendered when the user taps
/// "Withdraw" in a row footer. Lets them pick a reason from the four
/// values the backend whitelists and then triggers the DELETE call.
private struct WithdrawBidSheet: View {
    let target: WithdrawSheetTarget
    let onCancel: () -> Void
    let onConfirm: (WithdrawBidReason?) -> Void

    @State private var selected: WithdrawBidReason?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Withdraw bid")
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                Text("Why are you withdrawing your bid on \(target.gigTitle)?")
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }

            VStack(spacing: Spacing.s2) {
                ForEach(WithdrawBidReason.allCases, id: \.rawValue) { reason in
                    Button {
                        selected = reason
                    } label: {
                        HStack(spacing: Spacing.s2) {
                            Text(reason.label)
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Theme.Color.appText)
                            Spacer()
                            if selected == reason {
                                Icon(.check, size: 18, color: Theme.Color.primary600)
                            }
                        }
                        .padding(Spacing.s3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: Radii.md)
                                .fill(
                                    selected == reason
                                        ? Theme.Color.primary50
                                        : Theme.Color.appSurfaceSunken
                                )
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.md)
                                .stroke(
                                    selected == reason
                                        ? Theme.Color.primary600
                                        : Theme.Color.appBorder,
                                    lineWidth: 1
                                )
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("withdraw-reason-\(reason.rawValue)")
                }
            }

            HStack(spacing: Spacing.s2) {
                Button {
                    onCancel()
                    dismiss()
                } label: {
                    Text("Cancel")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .padding(.vertical, Spacing.s3)
                        .frame(maxWidth: .infinity)
                        .background(
                            RoundedRectangle(cornerRadius: Radii.md)
                                .stroke(Theme.Color.appBorder, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("withdraw-cancel")

                Button {
                    onConfirm(selected)
                    dismiss()
                } label: {
                    Text("Withdraw bid")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.vertical, Spacing.s3)
                        .frame(maxWidth: .infinity)
                        .background(
                            RoundedRectangle(cornerRadius: Radii.md)
                                .fill(Theme.Color.error)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("withdraw-confirm")
            }
        }
        .padding(Spacing.s4)
    }
}

#Preview {
    NavigationStack {
        MyBidsView(viewModel: MyBidsViewModel())
    }
}
