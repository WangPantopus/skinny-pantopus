//
//  CrewDayCards.swift
//  Pantopus
//
//  The household's saved cards for a Crew Day booking: the existing saved
//  methods (`GET /api/payments/methods`) and the existing add-card flow
//  (`POST /api/payments/payment-sheet-add-card`, the Stripe PaymentSheet,
//  then `…/confirm`). A booking sends the card's Stripe id (`pm_…`), as
//  agreed with the server and the web in the notes folder.
//

import Foundation

/// One saved card, as a booking needs it.
struct CrewDaySavedCard: Decodable, Hashable, Identifiable {
    let id: String
    /// Stripe's `pm_…`, sent as the booking's `payment_method_id`.
    let stripeId: String?
    let brand: String?
    let last4: String?
    let isDefault: Bool
    let type: String?

    /// "Visa ending 4242".
    var label: String {
        let name = (brand ?? "Card").capitalized
        return last4.map { "\(name) ending \($0)" } ?? name
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        stripeId = try c.decodeIfPresent(String.self, forKey: .stripeId)
        brand = try c.decodeIfPresent(String.self, forKey: .brand)
        last4 = try c.decodeIfPresent(String.self, forKey: .last4)
        isDefault = try c.decodeIfPresent(Bool.self, forKey: .isDefault) ?? false
        type = try c.decodeIfPresent(String.self, forKey: .type)
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case stripeId = "stripe_payment_method_id"
        case brand = "card_brand"
        case last4 = "card_last4"
        case isDefault = "is_default"
        case type = "payment_method_type"
    }
}

private struct CrewDaySavedCardsResponse: Decodable {
    let paymentMethods: [CrewDaySavedCard]
}

@Observable
@MainActor
final class CrewDayCardWallet {
    private(set) var cards: [CrewDaySavedCard] = []
    private(set) var isAdding = false
    private(set) var loaded = false
    var error: String?
    private let presenter: any PaymentSheetPresenting

    init(presenter: any PaymentSheetPresenting = StripePaymentSheetPresenter()) {
        self.presenter = presenter
    }

    /// Cards only (a bank account can't be charged off-session here).
    func load() async {
        if let response: CrewDaySavedCardsResponse = try? await APIClient.shared.request(PaymentsEndpoints.methods()) {
            cards = response.paymentMethods.filter { ($0.type ?? "card") == "card" && $0.stripeId != nil }
        }
        loaded = true
    }

    var preferred: CrewDaySavedCard? {
        cards.first(where: \.isDefault) ?? cards.first
    }

    /// The existing add-card sheet; answers the new card once Stripe and the server confirm it.
    func addCard() async -> CrewDaySavedCard? {
        guard !isAdding else { return nil }
        isAdding = true
        error = nil
        defer { isAdding = false }
        do {
            let params: AddCardSheetParams = try await APIClient.shared.request(PaymentsEndpoints.addCardSheet())
            if params.setupStatus != "succeeded" {
                let outcome = await presenter.presentAddCard(
                    setupIntentClientSecret: params.setupIntent,
                    customer: params.customer,
                    ephemeralKey: params.ephemeralKey,
                    publishableKey: params.publishableKey
                )
                switch outcome {
                case .completed: break
                case .canceled: return nil
                case let .failed(message):
                    error = message
                    return nil
                }
            }
            let receipt: ConfirmAddCardResponse = try await APIClient.shared.request(
                PaymentsEndpoints.confirmAddCard(setupIntentId: params.setupIntentId)
            )
            guard receipt.confirmed else {
                error = "Your card couldn't be saved. Try another card."
                return nil
            }
            await load()
            return cards.first { $0.id == receipt.paymentMethod.id } ?? preferred
        } catch {
            self.error = "Your card couldn't be saved. Try another card."
            return nil
        }
    }
}
