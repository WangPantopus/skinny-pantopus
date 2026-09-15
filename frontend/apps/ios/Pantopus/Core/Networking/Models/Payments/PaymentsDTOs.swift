//
//  PaymentsDTOs.swift
//  Pantopus
//
//  Decodable models for the Stripe payment-methods surface
//  (`backend/routes/pays.js`, mounted at `/api/payments`). Phase 3 (3A)
//  wires the Settings → Payments methods card: list saved methods, and
//  fetch PaymentSheet (SetupIntent) params for adding a card. Monetary /
//  Connect / payout DTOs land with 3C.
//

import Foundation

/// `GET /api/payments/methods` — route `backend/routes/pays.js:701`.
/// Wraps the saved-method rows from the `PaymentMethod` table.
public struct PaymentMethodsResponse: Decodable, Sendable, Hashable {
    public let paymentMethods: [PaymentMethodDTO]
}

/// One row from the `PaymentMethod` table. Columns are snake_case; a card
/// row carries `card_*`, a bank row carries `bank_*`.
public struct PaymentMethodDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let paymentMethodType: String?
    public let cardBrand: String?
    public let cardLast4: String?
    public let cardExpMonth: Int?
    public let cardExpYear: Int?
    public let bankName: String?
    public let bankLast4: String?
    public let bankAccountType: String?
    public let isDefault: Bool

    private enum CodingKeys: String, CodingKey {
        case id
        case paymentMethodType = "payment_method_type"
        case cardBrand = "card_brand"
        case cardLast4 = "card_last4"
        case cardExpMonth = "card_exp_month"
        case cardExpYear = "card_exp_year"
        case bankName = "bank_name"
        case bankLast4 = "bank_last4"
        case bankAccountType = "bank_account_type"
        case isDefault = "is_default"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        paymentMethodType = try container.decodeIfPresent(String.self, forKey: .paymentMethodType)
        cardBrand = try container.decodeIfPresent(String.self, forKey: .cardBrand)
        cardLast4 = try container.decodeIfPresent(String.self, forKey: .cardLast4)
        cardExpMonth = try container.decodeIfPresent(Int.self, forKey: .cardExpMonth)
        cardExpYear = try container.decodeIfPresent(Int.self, forKey: .cardExpYear)
        bankName = try container.decodeIfPresent(String.self, forKey: .bankName)
        bankLast4 = try container.decodeIfPresent(String.self, forKey: .bankLast4)
        bankAccountType = try container.decodeIfPresent(String.self, forKey: .bankAccountType)
        isDefault = (try? container.decodeIfPresent(Bool.self, forKey: .isDefault)) ?? false
    }
}

/// `POST /api/payments/payment-sheet-add-card` — route
/// `backend/routes/pays.js:1412`. SetupIntent params for the mobile
/// PaymentSheet "add a card" flow. Keys are already camelCase server-side.
public struct AddCardSheetParams: Decodable, Sendable, Hashable {
    public let setupIntent: String
    public let setupIntentId: String
    public let setupStatus: String
    public let ephemeralKey: String
    public let customer: String
    public let publishableKey: String?
}

/// An existing identifier resumes the same setup without creating another one.
public struct AddCardSheetBody: Encodable, Sendable, Hashable {
    public let setupIntentId: String
}

/// `POST /api/payments/payment-sheet-add-card/confirm`; keys are camelCase.
public struct ConfirmAddCardBody: Encodable, Sendable, Hashable {
    public let setupIntentId: String
}

/// Durable server receipt, returned only after the owned card is saved.
public struct ConfirmAddCardResponse: Decodable, Sendable, Hashable {
    public let confirmed: Bool
    public let paymentMethod: PaymentMethodDTO
}

/// Body for `POST /api/payments/intent` (Block 3B checkout). The server
/// computes the payee and amount from the referenced order.
public struct CreatePaymentIntentBody: Encodable, Sendable, Hashable {
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

/// Response from `POST /api/payments/intent` — the params the mobile
/// PaymentSheet needs to present a charge. `customer` + `ephemeralKey` are
/// best-effort (the sheet still works card-only without them); `clientSecret`
/// is the PaymentIntent secret PaymentSheet confirms. Keys are camelCase
/// server-side. The shape is a superset of the gig bid-accept payment payload
/// so the same `CheckoutCoordinator` can present either.
public struct PaymentIntentSheetParams: Decodable, Sendable, Hashable {
    public let clientSecret: String?
    public let paymentIntentId: String?
    public let customer: String?
    public let ephemeralKey: String?
    public let publishableKey: String?
    public let isSetupIntent: Bool?

    public init(
        clientSecret: String?,
        paymentIntentId: String? = nil,
        customer: String? = nil,
        ephemeralKey: String? = nil,
        publishableKey: String? = nil,
        isSetupIntent: Bool? = nil
    ) {
        self.clientSecret = clientSecret
        self.paymentIntentId = paymentIntentId
        self.customer = customer
        self.ephemeralKey = ephemeralKey
        self.publishableKey = publishableKey
        self.isSetupIntent = isSetupIntent
    }
}

/// Original tip terms, shared by eligibility, recovery and commands.
public struct TipTerms: Codable, Sendable, Hashable {
    public let gigId: String
    public let payerId: String
    public let payeeId: String?
    public let ownerConfirmedAt: String?

    func matches(gig: String, actor: String, ready: Bool) -> Bool {
        gigId == gig && payerId == actor && TipOriginal.identifier(gig) && TipOriginal.identifier(actor)
            && (payeeId.map(TipOriginal.identifier) ?? !ready)
            && (ownerConfirmedAt.map { GigAssignedAuthorizationProgress.date($0) != nil } ?? !ready)
    }
}

/// Only this nonsecret original is retained. Checkout credentials remain transient.
public struct TipOriginal: Codable, Sendable, Hashable {
    public let requestId: String
    public let paymentId: String
    public let gigId: String
    public let payerId: String
    public let payeeId: String
    public let amountCents: Int
    public let currency: String
    public let terms: TipTerms
    public let paymentMethodId: String?
    public var source: String?

    var isLegacy: Bool {
        source == "legacy"
    }

    static func identifier(_ value: String) -> Bool {
        value.range(
            of: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
            options: .regularExpression
        ) != nil
    }

    static func provider(_ value: String?, prefix: String) -> Bool {
        value?.range(of: "^\(prefix)_[A-Za-z0-9]+$", options: .regularExpression) != nil
    }

    func matches(gig: String, actor: String) -> Bool {
        Self.identifier(requestId) && requestId == paymentId && gigId == gig && payerId == actor
            && Self.identifier(payeeId) && payeeId != actor && (50...99_999_999).contains(amountCents)
            && (source == nil || isLegacy)
            && currency == "usd" && terms.matches(gig: gig, actor: actor, ready: !isLegacy) && terms.payeeId == payeeId
            && (!isLegacy || (terms.ownerConfirmedAt == nil && paymentMethodId == nil))
            && (paymentMethodId == nil || Self.provider(paymentMethodId, prefix: "pm"))
    }
}

public struct TipPreview: Decodable, Sendable {
    public let actorId: String
    public let sessionScope: String
    public let terms: TipTerms
    public let eligible: Bool
    public let unavailableReason: String?
    public let activeRequestId: String?
    public let legacyPaymentId: String?
    public let minimumAmountCents: Int
    public let maximumAmountCents: Int
    public let remainingTipSlots: Int

    func matches(gig: String, actor: String, session: String?) -> Bool {
        TipResponse.scope(actorId, sessionScope, actor: actor, session: session)
            && terms.matches(gig: gig, actor: actor, ready: eligible)
            && (activeRequestId.map(TipOriginal.identifier) ?? true)
            && (legacyPaymentId.map(TipOriginal.identifier) ?? true)
            && (activeRequestId == nil || legacyPaymentId == nil)
            && minimumAmountCents == 50 && maximumAmountCents == 99_999_999 && (0...3).contains(remainingTipSlots)
            && (!eligible || (activeRequestId == nil && legacyPaymentId == nil && unavailableReason == nil && remainingTipSlots > 0))
    }
}

/// Exact command: check/cancel retain the original UUID, amount and terms.
public struct TipRequest: Encodable, Sendable {
    public let requestId: String
    public let gigId: String
    public let amount: Int
    public let paymentMethodId: String?
    public let expectedActorId: String
    public let expectedSessionScope: String
    public let expectedTerms: TipTerms
    public let mode: String

    init(original: TipOriginal, session: String, mode: String) {
        requestId = original.requestId
        gigId = original.gigId
        amount = original.amountCents
        paymentMethodId = original.paymentMethodId
        expectedActorId = original.payerId
        expectedSessionScope = session
        expectedTerms = original.terms
        self.mode = mode
    }
}

public struct TipReceipt: Decodable, Sendable {
    public let requestId: String
    public let paymentId: String
    public let gigId: String
    public let payerId: String
    public let payeeId: String
    public let amountCents: Int
    public let currency: String
    public let status: String
    public let paymentIntentId: String?
    public let chargeId: String?
    public let amountChargedCents: Int
}

public struct TipCheckout: Decodable, Sendable {
    public let paymentIntentId: String
    public let clientSecret: String
    public let customer: String
    public let ephemeralKey: String?
    public let publishableKey: String?

    var sheetParams: PaymentIntentSheetParams {
        PaymentIntentSheetParams(
            clientSecret: clientSecret,
            paymentIntentId: paymentIntentId,
            customer: customer,
            ephemeralKey: ephemeralKey,
            publishableKey: publishableKey
        )
    }

    func sameIntent(as other: TipCheckout) -> Bool {
        paymentIntentId == other.paymentIntentId && customer == other.customer && clientSecret == other.clientSecret
    }
}

public struct TipResponse: Decodable, Sendable {
    public let actorId: String
    public let sessionScope: String
    public let request: TipOriginal
    public let status: String
    public let paymentStatus: String
    public let providerStatus: String?
    public let paymentIntentId: String?
    public let canRetry: Bool
    public let canCancel: Bool
    public let receipt: TipReceipt?
    public let checkout: TipCheckout?

    var terminal: Bool {
        status == "succeeded" || status == "canceled"
    }

    var changedAfterCapture: Bool {
        ["refund_pending", "refunded_partial", "refunded_full", "disputed"].contains(paymentStatus)
    }

    static func scope(_ actorId: String, _ sessionScope: String, actor: String, session: String?) -> Bool {
        actorId == actor && sessionScope.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil
            && (session == nil || sessionScope == session)
    }

    func matches(gig: String, actor: String, requestId: String, session: String?, original: TipOriginal? = nil) -> Bool {
        guard Self.scope(actorId, sessionScope, actor: actor, session: session), request.matches(gig: gig, actor: actor),
              request.requestId == requestId, original == nil || original == request,
              ["pending", "requires_action", "needs_review", "succeeded", "canceled"].contains(status),
              !request.isLegacy || (!canRetry && checkout == nil),
              paymentIntentId == nil || TipOriginal.provider(paymentIntentId, prefix: "pi") else { return false }
        if terminal {
            guard let receipt, !canRetry, !canCancel, checkout == nil,
                  receipt.requestId == requestId, receipt.paymentId == request.paymentId, receipt.gigId == gig,
                  receipt.payerId == actor, receipt.payeeId == request.payeeId, receipt.amountCents == request.amountCents,
                  receipt.currency == "usd", receipt.status == status, receipt.paymentIntentId == paymentIntentId,
                  receipt.chargeId == nil || TipOriginal.provider(receipt.chargeId, prefix: "ch"),
                  receipt.amountChargedCents == (status == "succeeded" ? request.amountCents : 0) else { return false }
            if status == "succeeded" {
                guard TipOriginal.provider(paymentIntentId, prefix: "pi"), TipOriginal.provider(receipt.chargeId, prefix: "ch"),
                      [
                          "captured_hold",
                          "transfer_scheduled",
                          "transfer_pending",
                          "transferred",
                          "refund_pending",
                          "refunded_partial",
                          "refunded_full",
                          "disputed"
                      ].contains(paymentStatus) else { return false }
            } else if paymentStatus != "canceled" { return false }
        } else if receipt != nil { return false }
        if let checkout {
            guard ["pending", "requires_action"].contains(status),
                  ["requires_payment_method", "requires_confirmation", "requires_action"].contains(providerStatus ?? ""),
                  checkout.paymentIntentId == paymentIntentId, TipOriginal.provider(checkout.paymentIntentId, prefix: "pi"),
                  checkout.clientSecret.hasPrefix("\(checkout.paymentIntentId)_secret_"),
                  TipOriginal.provider(checkout.customer, prefix: "cus") else { return false }
        }
        return true
    }
}

/// `POST /api/payments/tip/{paymentId}/refresh-status` response.
public struct TipRefreshStatusResponse: Decodable, Sendable, Hashable {
    public let paymentStatus: String?
    public let previousPaymentStatus: String?
    public let changed: Bool?
    public let stripeStatus: String?
}
