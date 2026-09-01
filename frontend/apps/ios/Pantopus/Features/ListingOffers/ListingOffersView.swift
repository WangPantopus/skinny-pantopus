//
//  ListingOffersView.swift
//  Pantopus
//
//  T5.3.4 — Listing offers. Thin wrapper around the shared
//  `ListOfRowsView`. No tabs, no FAB, listing-context header card pinned
//  above the flat offer list, share icon in the top-bar trailing slot.
//  Row actions (accept / counter / decline) hit the listing-offers
//  routes; the counter flow goes through a half-sheet so the seller can
//  pick an amount before posting.
//

import SwiftUI

public struct ListingOffersView: View {
    @State private var viewModel: ListingOffersViewModel

    public init(viewModel: ListingOffersViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        @Bindable var bindable = viewModel
        return ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("listing-offers")
            .sheet(item: $bindable.counterTarget) { target in
                CounterOfferSheet(
                    target: target,
                    onCancel: { viewModel.cancelCounter() },
                    onConfirm: { amount, message in
                        Task { await viewModel.confirmCounter(amount: amount, message: message) }
                    }
                )
                .presentationDetents([.medium])
            }
            .sheet(item: $bindable.leaveReviewTarget) { target in
                TransactionReviewSheetView(
                    target: target,
                    onSubmit: { draft in
                        await viewModel.submitLeaveReview(draft)
                    },
                    onClose: { viewModel.cancelLeaveReview() }
                )
                .presentationDetents([.medium, .large])
            }
    }
}

// MARK: - Counter sheet

private struct CounterOfferSheet: View {
    let target: CounterSheetTarget
    let onCancel: () -> Void
    let onConfirm: (Double, String?) -> Void

    @State private var amountText: String = ""
    @State private var messageText: String = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Counter \(target.buyerName)'s offer")
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                if let original = target.originalAmount {
                    Text("Original offer: \(ListingOffersViewModel.formatPrice(original))")
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }

            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Your counter amount")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                HStack(spacing: Spacing.s1) {
                    Text("$")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    TextField("Amount", text: $amountText)
                        .keyboardType(.decimalPad)
                        .font(Theme.Font.body)
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityIdentifier("counter-amount")
                }
                .padding(Spacing.s3)
                .background(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
            }

            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Optional message")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                TextField("Add a note (optional)", text: $messageText, axis: .vertical)
                    .lineLimit(1...3)
                    .font(Theme.Font.small)
                    .foregroundStyle(Theme.Color.appText)
                    .padding(Spacing.s3)
                    .background(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .accessibilityIdentifier("counter-message")
            }

            Spacer(minLength: Spacing.s0)

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
                .accessibilityIdentifier("counter-cancel")

                Button {
                    guard let amount = parsedAmount else { return }
                    onConfirm(amount, messageText.isEmpty ? nil : messageText)
                    dismiss()
                } label: {
                    Text("Send counter")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.vertical, Spacing.s3)
                        .frame(maxWidth: .infinity)
                        .background(
                            RoundedRectangle(cornerRadius: Radii.md)
                                .fill(canSend ? Theme.Color.primary600 : Theme.Color.appTextMuted)
                        )
                }
                .buttonStyle(.plain)
                .disabled(!canSend)
                .accessibilityIdentifier("counter-confirm")
            }
        }
        .padding(Spacing.s4)
        .onAppear {
            if amountText.isEmpty, let suggested = target.suggestedAmount {
                amountText = String(Int(suggested.rounded()))
            }
        }
    }

    private var parsedAmount: Double? {
        Double(amountText.trimmingCharacters(in: .whitespaces))
    }

    private var canSend: Bool {
        guard let amount = parsedAmount else { return false }
        return amount > 0
    }
}

#Preview {
    NavigationStack {
        ListingOffersView(
            viewModel: ListingOffersViewModel(
                listingId: "preview-listing",
                listingTitleHint: "Mid-century walnut credenza"
            )
        )
    }
}
