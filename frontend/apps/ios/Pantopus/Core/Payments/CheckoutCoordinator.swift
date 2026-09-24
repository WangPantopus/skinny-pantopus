//
//  CheckoutCoordinator.swift
//  Pantopus
//
//  Phase 3 (3B) — the shared "pay for an order" step. A buyer committing to
//  a gig or a marketplace purchase calls the backend to create a
//  PaymentIntent (`POST /api/payments/intent`), then presents Stripe's
//  PaymentSheet (card collection + SCA/3-D Secure + saved cards) via the 3A
//  `PaymentSheetPresenting`. We NEVER mark the order paid client-side — on
//  success the caller refreshes the gig/order/invoice from the backend, which
//  Stripe webhooks reconcile (status → authorized / captured).
//
//  Reusable across the checkout surfaces (invoice / gig / listing): callers
//  either hand us a `CheckoutRequest` (we create the intent) or a
//  pre-fetched `PaymentIntentSheetParams` (e.g. the gig bid-accept response
//  already carries them) and we just present the sheet.
//

import Foundation

/// What the buyer is paying for. The server owns the real amount and payee; the
/// client passes only the order reference.
public struct CheckoutRequest: Sendable, Equatable {
    public let gigId: String?
    public let listingId: String?
    public let offerId: String?
    public let description: String?

    public init(
        gigId: String? = nil,
        listingId: String? = nil,
        offerId: String? = nil,
        description: String? = nil
    ) {
        self.gigId = gigId
        self.listingId = listingId
        self.offerId = offerId
        self.description = description
    }
}

/// Outcome of a checkout, decoupled from Stripe + transport details so
/// view-models can switch on it and drive UI / refresh.
public enum CheckoutOutcome: Sendable, Equatable {
    /// PaymentSheet completed — the caller should re-read server state.
    case paid
    /// The buyer dismissed the sheet without paying.
    case canceled
    /// Card declined / SCA failed — surfaced by PaymentSheet.
    case declined(message: String)
    /// Couldn't start checkout (creating the intent failed, no client secret).
    case failed(message: String)
}

@MainActor
public final class CheckoutCoordinator {
    /// A submitted sheet can precede its webhook. Retain IDs across screen re-entry,
    /// never an inferred paid state or any provider credentials.
    private struct ListingConfirmation: Hashable {
        let userId: String
        let listingId: String
        let offerId: String
    }

    private static var pendingListingConfirmations: Set<ListingConfirmation> = []
    private let api: APIClient
    private let presenter: any PaymentSheetPresenting

    public convenience init() {
        self.init(api: .shared, presenter: StripePaymentSheetPresenter())
    }

    init(api: APIClient, presenter: any PaymentSheetPresenting) {
        self.api = api
        self.presenter = presenter
    }

    public func markListingConfirmationPending(userId: String, listingId: String, offerId: String) {
        Self.pendingListingConfirmations.insert(.init(userId: userId, listingId: listingId, offerId: offerId))
    }

    public func isListingConfirmationPending(userId: String?, listingId: String) -> Bool {
        Self.pendingListingConfirmations.contains { $0.userId == userId && $0.listingId == listingId }
    }

    public func reconcileListingConfirmation(userId: String, listingId: String, offer: ListingOfferDTO) {
        guard let summary = offer.checkout else { return }
        let resolved = ["authorized", "processing", "paid", "refund_pending", "partially_refunded", "refunded", "disputed"]
        let retry = summary.state == "retry" && summary.canContinue && summary.paymentStatus == "authorization_failed"
        guard resolved.contains(summary.state) || retry else { return }
        Self.pendingListingConfirmations.remove(.init(userId: userId, listingId: listingId, offerId: offer.id))
    }

    /// Create a PaymentIntent for the order, then present PaymentSheet.
    public func pay(_ request: CheckoutRequest) async -> CheckoutOutcome {
        let params: PaymentIntentSheetParams
        do {
            params = try await api.request(
                PaymentsEndpoints.intent(
                    body: CreatePaymentIntentBody(
                        gigId: request.gigId,
                        listingId: request.listingId,
                        offerId: request.offerId,
                        description: request.description
                    )
                )
            )
        } catch {
            return .failed(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't start checkout. Please try again."
            )
        }
        return await present(params)
    }

    /// Present PaymentSheet against pre-fetched params (e.g. the gig
    /// bid-accept response). Returns `.failed` when there's no usable secret.
    public func present(_ params: PaymentIntentSheetParams) async -> CheckoutOutcome {
        guard let clientSecret = params.clientSecret, !clientSecret.isEmpty else {
            return .failed(message: "Couldn't start checkout. Please try again.")
        }
        let outcome = await presenter.presentPayment(
            clientSecret: clientSecret,
            customer: params.customer ?? "",
            ephemeralKey: params.ephemeralKey ?? "",
            isSetupIntent: params.isSetupIntent ?? false,
            publishableKey: params.publishableKey
        )
        switch outcome {
        case .completed:
            return .paid
        case .canceled:
            return .canceled
        case let .failed(message):
            return .declined(message: message)
        }
    }
}
