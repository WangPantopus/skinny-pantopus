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
    @State private var offerSending = false
    @State private var offerError: String?
    /// The buyer's open offer ("Your offer $X"): shown with Withdraw, as on web.
    @State private var myOfferSheetVisible = false
    @State private var withdrawing = false
    @State private var accepting = false
    /// The open-offer sheet's refused action (accept or withdraw), with the server's reason.
    @State private var myOfferError: String?
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
            MakeOfferSheet(
                isFree: listingIsFree,
                askingPrice: viewModel.rawListing?.price,
                sending: $offerSending,
                errorText: $offerError
            ) { amount, message in
                Task { await sendOffer(amount: amount, message: message) }
            }
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
            myOfferError = nil
            myOfferSheetVisible = true
        } else {
            offerError = nil
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

    /// One request at a time; a refused offer keeps the sheet open with the server's reason.
    private func sendOffer(amount: Double?, message: String?) async {
        guard !offerSending else { return }
        offerSending = true
        offerError = nil
        defer { offerSending = false }
        let free = listingIsFree
        if let error = await viewModel.makeOffer(amount: free ? nil : amount, message: message) {
            offerError = error
            return
        }
        offerSheetVisible = false
        toast = ToastMessage(text: free ? "Interest sent." : "Offer sent.", kind: .success)
    }

    /// The buyer's open offer, as web shows it: waiting for the seller (their
    /// amount and note) or the seller's counter with Accept, and Withdraw.
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
            if let myOfferError {
                Text(myOfferError)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityIdentifier("listingDetailWithdrawError")
            }
            if countered { acceptCounterButton(amount: amount) }
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
            .disabled(withdrawing || accepting)
            .accessibilityIdentifier("listingDetailWithdrawOffer")
        }
        .padding(Spacing.s5)
        .presentationDetents([.medium])
    }

    /// One request at a time; a refused withdrawal keeps the sheet open with the server's reason.
    private func withdraw() async {
        guard !withdrawing, !accepting, viewModel.myOffer != nil else { return }
        withdrawing = true
        myOfferError = nil
        defer { withdrawing = false }
        let free = listingIsFree
        if let error = await viewModel.withdrawOffer() {
            myOfferError = error
            return
        }
        myOfferSheetVisible = false
        toast = ToastMessage(text: free ? "Interest withdrawn." : "Offer withdrawn.", kind: .success)
    }
}

// MARK: - Accepting the seller's counter

private extension ListingDetailView {
    /// Accept the seller's counter, as web's "Accept": the listing is then held for this buyer.
    func acceptCounterButton(amount: Double?) -> some View {
        Button {
            Task { await acceptCounter() }
        } label: {
            Text(accepting ? "Accepting…" : amount.map { "Accept \(ListingDetailViewModel.usd($0))" } ?? "Accept")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(accepting || withdrawing)
        .accessibilityIdentifier("listingDetailAcceptCounter")
    }

    /// One request at a time; a refused accept keeps the sheet open with the server's reason.
    func acceptCounter() async {
        guard !accepting, !withdrawing, viewModel.myOffer?.status == "countered" else { return }
        accepting = true
        myOfferError = nil
        defer { accepting = false }
        if let error = await viewModel.acceptCounter() {
            myOfferError = error
            return
        }
        myOfferSheetVisible = false
        toast = ToastMessage(text: "Counter-offer accepted.", kind: .success)
    }
}

/// "Make an offer", its own view like the seller's counter sheet: it owns the amount it shows,
/// so Send follows that amount from the first frame. Built in the parent's body, the sheet kept
/// Send disabled over the asking price it opened with until the amount was edited.
private struct MakeOfferSheet: View {
    let isFree: Bool
    @Binding var sending: Bool
    @Binding var errorText: String?
    let onSend: (Double?, String?) -> Void

    @State private var amountText: String
    @State private var messageText = ""

    init(
        isFree: Bool,
        askingPrice: Double?,
        sending: Binding<Bool>,
        errorText: Binding<String?>,
        onSend: @escaping (Double?, String?) -> Void
    ) {
        self.isFree = isFree
        _sending = sending
        _errorText = errorText
        self.onSend = onSend
        // Starts at the asking price, as on web.
        var start = ""
        if !isFree, let price = askingPrice, price > 0 {
            start = price.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(price))" : String(format: "%.2f", price)
        }
        _amountText = State(initialValue: start)
    }

    private var amount: Double? {
        ListingDetailViewModel.parseOfferAmount(amountText)
    }

    private var canSend: Bool {
        !sending && (isFree || (amount ?? 0) > 0)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            Text("Make an offer")
                .font(.system(size: 18, weight: .bold))
            Text("Send the seller your offer. Pickup details get worked out in chat.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
            if !isFree {
                TextField("Offer amount", text: $amountText)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)
                    .accessibilityLabel("Offer amount")
            }
            TextField("Message (optional)", text: $messageText, axis: .vertical)
                .lineLimit(2...4)
                .textFieldStyle(.roundedBorder)
                .accessibilityLabel("Offer message")
            if let errorText {
                Text(errorText)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityIdentifier("listingDetailOfferError")
            }
            Button {
                guard canSend else { return }
                let message = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
                onSend(isFree ? nil : amount, message.isEmpty ? nil : message)
            } label: {
                Text(sending ? "Sending…" : "Send")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
            .accessibilityIdentifier("listingDetailSendOffer")
        }
        .padding(Spacing.s5)
        .presentationDetents([.medium])
    }
}
