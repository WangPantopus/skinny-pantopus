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
    @State private var offerSending = false
    @State private var offerError: String?
    /// The buyer's open offer ("Your offer $X"): shown with Withdraw, as on web.
    @State private var myOfferSheetVisible = false
    @State private var withdrawing = false
    @State private var withdrawError: String?
    @State private var toast: ToastMessage?
    @State private var shareSheetVisible = false
    private let onBack: @MainActor () -> Void
    private let onMessage: (@MainActor (ListingDTO) -> Void)?
    /// The seller's own "Message": their Messages inbox (a chat with
    /// themselves isn't one).
    private let onOpenInbox: (@MainActor () -> Void)?
    private let onViewOffers: (@MainActor (ListingDTO) -> Void)?
    private let onEditListing: (@MainActor (ListingDTO) -> Void)?
    /// A sold listing's "Find similar": the host opens the marketplace.
    private let onFindSimilar: (@MainActor () -> Void)?

    public init(
        viewModel: ListingDetailViewModel,
        onBack: @escaping @MainActor () -> Void = {},
        onMessage: (@MainActor (ListingDTO) -> Void)? = nil,
        onOpenInbox: (@MainActor () -> Void)? = nil,
        onViewOffers: (@MainActor (ListingDTO) -> Void)? = nil,
        onEditListing: (@MainActor (ListingDTO) -> Void)? = nil,
        onFindSimilar: (@MainActor () -> Void)? = nil
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onMessage = onMessage
        self.onOpenInbox = onOpenInbox
        self.onViewOffers = onViewOffers
        self.onEditListing = onEditListing
        self.onFindSimilar = onFindSimilar
    }

    public var body: some View {
        TransactionalDetailShell(
            state: viewModel.state,
            overflowItems: overflowItems,
            onGlassAction: { icon in handleGlassAction(icon) },
            activeGlassActions: viewModel.isSaved ? [.bookmark] : [],
            onBack: onBack,
            onPrimaryAction: { handlePrimaryAction() },
            onSecondaryAction: { handleMessage() },
            onRetry: { Task { await viewModel.load() } },
            onMessageCounterparty: { handleMessage() }
        )
        .task { await viewModel.load() }
        .sheet(isPresented: $offerSheetVisible) {
            offerSheet
        }
        .sheet(isPresented: $myOfferSheetVisible) {
            if let offer = viewModel.myOffer {
                myOfferSheet(offer)
            }
        }
        .sheet(isPresented: $shareSheetVisible) {
            SystemShareSheet(items: [shareText])
        }
        .overlay(alignment: .bottom) { toastOverlay }
    }

    @ViewBuilder private var toastOverlay: some View {
        if let toast {
            ToastView(message: toast)
                .padding(.bottom, Spacing.s8)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    self.toast = nil
                }
                .accessibilityIdentifier("listing-detail-toast")
        }
    }

    private var listingIsFree: Bool {
        viewModel.rawListing?.isFree == true
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
        if viewModel.hasCheckoutAction {
            Task {
                switch await viewModel.continueCheckout() {
                case .awaitingConfirmation:
                    toast = ToastMessage(text: "Payment submitted. Confirmation is still pending. Check status again.", kind: .neutral)
                case let .error(message):
                    toast = ToastMessage(text: message, kind: .error)
                case nil: break
                }
            }
            return
        }
        // A sold listing's "Find similar" browses the marketplace; a sold listing takes no offers.
        if viewModel.isSold {
            onFindSimilar?()
            return
        }
        if let listing = viewModel.rawListing,
           viewModel.isOwnedByMe,
           let onViewOffers {
            onViewOffers(listing)
        } else if viewModel.myOffer != nil {
            withdrawError = nil
            myOfferSheetVisible = true
        } else {
            offerError = nil
            if offerAmount.isEmpty, !listingIsFree, let price = viewModel.rawListing?.price, price > 0 {
                // Starts at the asking price, as on web.
                offerAmount = price.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(price))" : String(format: "%.2f", price)
            }
            offerSheetVisible = true
        }
    }

    /// "Message": the chat with the seller; the seller's own opens their inbox.
    private func handleMessage() {
        if viewModel.isOwnedByMe {
            onOpenInbox?()
        } else if let listing = viewModel.rawListing {
            onMessage?(listing)
        }
    }

    /// The cover's chips: share sends the listing's web link (as the gig
    /// detail shares); the bookmark saves or unsaves it.
    private func handleGlassAction(_ icon: PantopusIcon) {
        switch icon {
        case .share:
            shareSheetVisible = true
        case .bookmark:
            let saving = !viewModel.isSaved
            Task {
                let ok = await viewModel.toggleSave()
                if !ok {
                    toast = ToastMessage(
                        text: saving ? "Couldn't save this listing." : "Couldn't remove the save.",
                        kind: .error
                    )
                }
            }
        default:
            break
        }
    }

    private var shareText: String {
        let url = viewModel.shareURL.absoluteString
        guard let title = viewModel.rawListing?.title, !title.isEmpty else { return url }
        return "\(title) — \(url)"
    }

    private var offerSheet: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            Text("Make an offer")
                .font(.system(size: 18, weight: .bold))
            Text("Send the seller your offer. Pickup details get worked out in chat.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
            if !listingIsFree {
                TextField("Offer amount", text: $offerAmount)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)
                    .accessibilityLabel("Offer amount")
            }
            TextField("Message (optional)", text: $offerMessage, axis: .vertical)
                .lineLimit(2...4)
                .textFieldStyle(.roundedBorder)
                .accessibilityLabel("Offer message")
            if let offerError {
                Text(offerError)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityIdentifier("listingDetailOfferError")
            }
            Button {
                Task { await sendOffer() }
            } label: {
                Text(offerSending ? "Sending…" : "Send")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(!canSendOffer)
            .accessibilityIdentifier("listingDetailSendOffer")
        }
        .padding(Spacing.s5)
        .presentationDetents([.medium])
    }

    private var canSendOffer: Bool {
        guard !offerSending else { return false }
        if listingIsFree { return true }
        return (ListingDetailViewModel.parseOfferAmount(offerAmount) ?? 0) > 0
    }

    /// One request at a time; a refused offer keeps the sheet open with the server's reason.
    private func sendOffer() async {
        guard canSendOffer else { return }
        offerSending = true
        offerError = nil
        defer { offerSending = false }
        let free = listingIsFree
        let message = offerMessage.trimmingCharacters(in: .whitespacesAndNewlines)
        let error = await viewModel.makeOffer(
            amount: free ? nil : ListingDetailViewModel.parseOfferAmount(offerAmount),
            message: message.isEmpty ? nil : message
        )
        if let error {
            offerError = error
            return
        }
        offerSheetVisible = false
        offerAmount = ""
        offerMessage = ""
        toast = ToastMessage(text: free ? "Interest sent." : "Offer sent.", kind: .success)
    }

    /// The buyer's open offer, as web shows it: waiting for the seller (their
    /// amount and note) or the seller's counter, and Withdraw.
    private func myOfferSheet(_ offer: ListingOfferDTO) -> some View {
        let countered = offer.status == "countered"
        let amount = (countered ? offer.counterAmount : offer.amount).flatMap { $0 > 0 ? $0 : nil }
        let note = (countered ? offer.counterMessage : offer.message)?.trimmingCharacters(in: .whitespacesAndNewlines)
        let status = !countered ? "Waiting for the seller"
            : amount != nil ? "The seller countered with" : "The seller countered"
        return VStack(alignment: .leading, spacing: Spacing.s4) {
            Text("Your offer")
                .font(.system(size: 18, weight: .bold))
            Text(status)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
            if let amount {
                Text(ListingDetailViewModel.usd(amount))
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
            }
            if let note, !note.isEmpty {
                Text("“\(note)”")
                    .font(.system(size: 13))
                    .italic()
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            if let withdrawError {
                Text(withdrawError)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityIdentifier("listingDetailWithdrawError")
            }
            Button {
                Task { await withdraw() }
            } label: {
                Text(withdrawing ? "Withdrawing…" : listingIsFree ? "Withdraw interest" : "Withdraw offer")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(withdrawing)
            .accessibilityIdentifier("listingDetailWithdrawOffer")
        }
        .padding(Spacing.s5)
        .presentationDetents([.medium])
    }

    /// One request at a time; a refused withdrawal keeps the sheet open with the server's reason.
    private func withdraw() async {
        guard !withdrawing, viewModel.myOffer != nil else { return }
        withdrawing = true
        withdrawError = nil
        defer { withdrawing = false }
        let free = listingIsFree
        if let error = await viewModel.withdrawOffer() {
            withdrawError = error
            return
        }
        myOfferSheetVisible = false
        toast = ToastMessage(text: free ? "Interest withdrawn." : "Offer withdrawn.", kind: .success)
    }
}
