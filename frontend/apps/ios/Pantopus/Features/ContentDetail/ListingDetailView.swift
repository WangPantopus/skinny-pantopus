//
//  ListingDetailView.swift
//  Pantopus
//
//  T2.6 listing detail. Wraps `TransactionalDetailShell`. The primary dock
//  action opens an offer sheet; the secondary opens a placeholder
//  message thread to the seller.
//

import SwiftUI

public struct ListingDetailView: View {
    @State private var viewModel: ListingDetailViewModel
    @State private var offerSheetVisible = false
    @State private var offerAmount: String = ""
    @State private var offerMessage: String = ""
    private let onBack: @MainActor () -> Void
    private let onMessage: (@MainActor (ListingDTO) -> Void)?
    private let onViewOffers: (@MainActor (ListingDTO) -> Void)?
    private let onEditListing: (@MainActor (ListingDTO) -> Void)?

    public init(
        viewModel: ListingDetailViewModel,
        onBack: @escaping @MainActor () -> Void = {},
        onMessage: (@MainActor (ListingDTO) -> Void)? = nil,
        onViewOffers: (@MainActor (ListingDTO) -> Void)? = nil,
        onEditListing: (@MainActor (ListingDTO) -> Void)? = nil
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onMessage = onMessage
        self.onViewOffers = onViewOffers
        self.onEditListing = onEditListing
    }

    public var body: some View {
        TransactionalDetailShell(
            state: viewModel.state,
            overflowItems: overflowItems,
            onBack: onBack,
            onPrimaryAction: { handlePrimaryAction() },
            onSecondaryAction: { if let listing = viewModel.rawListing { onMessage?(listing) } },
            onRetry: { Task { await viewModel.load() } },
            onMessageCounterparty: { if let listing = viewModel.rawListing { onMessage?(listing) } }
        )
        .task { await viewModel.load() }
        .sheet(isPresented: $offerSheetVisible) {
            offerSheet
        }
    }

    /// Owner-only overflow: "Edit listing" surfaces here so the dock can
    /// stay clean ("Message" + "View offers"). Buyers see no overflow at
    /// all (avoids signaling actions they can't perform).
    private var overflowItems: [ContentDetailOverflowItem] {
        guard let onEditListing,
              let listing = viewModel.rawListing,
              viewModel.isOwnedByMe
        else { return [] }
        return [
            ContentDetailOverflowItem(
                label: "Edit listing",
                icon: .pencil,
                identifier: "listingDetailEditListing"
            ) {
                onEditListing(listing)
            }
        ]
    }

    /// Drive the dock's primary action. When the listing is owned by
    /// the current user — surfaced server-side via the listing payload
    /// — and the host wired an `onViewOffers` callback, we push to the
    /// seller's offers panel instead of the buyer's "Make offer" sheet.
    private func handlePrimaryAction() {
        if let listing = viewModel.rawListing,
           viewModel.isOwnedByMe,
           let onViewOffers {
            onViewOffers(listing)
        } else {
            offerSheetVisible = true
        }
    }

    private var offerSheet: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            Text("Make an offer")
                .font(.system(size: 18, weight: .bold))
            Text("Send the seller a message with your offer. Pickup details get worked out in chat.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
            TextField("Offer amount (optional)", text: $offerAmount)
                .keyboardType(.decimalPad)
                .textFieldStyle(.roundedBorder)
                .accessibilityLabel("Offer amount")
            TextField("Message", text: $offerMessage, axis: .vertical)
                .lineLimit(2...4)
                .textFieldStyle(.roundedBorder)
                .accessibilityLabel("Offer message")
            Button {
                let amount = Double(offerAmount)
                Task {
                    let ok = await viewModel.sendMessage(text: offerMessage, offerAmount: amount)
                    if ok {
                        offerSheetVisible = false
                        offerAmount = ""
                        offerMessage = ""
                    }
                }
            } label: {
                Text("Send")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(offerMessage.isEmpty)
            .accessibilityIdentifier("listingDetailSendOffer")
        }
        .padding(Spacing.s5)
        .presentationDetents([.medium])
    }
}
