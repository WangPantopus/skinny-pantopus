//
//  PaymentSheetPresenter.swift
//  Pantopus
//
//  Phase 3 (3A) — the shared Stripe PaymentSheet presenter that 3B/3C/3D
//  reuse. Every place money changes hands presents Stripe's own
//  PaymentSheet (card collection + SCA/3-D Secure + Apple Pay + error
//  states) — we NEVER build a card form. The server creates the
//  intent/setup-intent; the client only presents the sheet with the
//  returned client secret + customer + ephemeral key, then refreshes the
//  affected screen from the backend (the source of truth; webhooks
//  reconcile server-side).
//

import StripePaymentSheet
import UIKit

/// Outcome of a presented PaymentSheet, decoupled from Stripe's result
/// type so view-models stay testable without importing the SDK.
public enum PaymentSheetOutcome: Sendable, Equatable {
    case completed
    case canceled
    case failed(message: String)
}

/// Presents Stripe PaymentSheet. Abstracted behind a protocol so
/// view-models can be unit-tested with a stub.
@MainActor
public protocol PaymentSheetPresenting: Sendable {
    /// SetupIntent flow — saving a card with no immediate charge
    /// (Settings → Payments "Add payment method").
    func presentAddCard(
        setupIntentClientSecret: String,
        customer: String,
        ephemeralKey: String,
        publishableKey: String?
    ) async -> PaymentSheetOutcome

    /// PaymentIntent (or SetupIntent) flow — collecting payment for a gig /
    /// listing / tip. Reused by 3B/3C/3D.
    func presentPayment(
        clientSecret: String,
        customer: String,
        ephemeralKey: String,
        isSetupIntent: Bool,
        publishableKey: String?
    ) async -> PaymentSheetOutcome
}

@MainActor
public final class StripePaymentSheetPresenter: PaymentSheetPresenting {
    private let merchantDisplayName: String

    public init(merchantDisplayName: String = "Pantopus") {
        self.merchantDisplayName = merchantDisplayName
    }

    public func presentAddCard(
        setupIntentClientSecret: String,
        customer: String,
        ephemeralKey: String,
        publishableKey: String?
    ) async -> PaymentSheetOutcome {
        StripeBootstrap.configure(publishableKey: publishableKey ?? "")
        let configuration = makeConfiguration(customer: customer, ephemeralKey: ephemeralKey)
        let sheet = PaymentSheet(
            setupIntentClientSecret: setupIntentClientSecret,
            configuration: configuration
        )
        return await present(sheet)
    }

    public func presentPayment(
        clientSecret: String,
        customer: String,
        ephemeralKey: String,
        isSetupIntent: Bool,
        publishableKey: String?
    ) async -> PaymentSheetOutcome {
        StripeBootstrap.configure(publishableKey: publishableKey ?? "")
        let configuration = makeConfiguration(customer: customer, ephemeralKey: ephemeralKey)
        let sheet = isSetupIntent
            ? PaymentSheet(setupIntentClientSecret: clientSecret, configuration: configuration)
            : PaymentSheet(paymentIntentClientSecret: clientSecret, configuration: configuration)
        return await present(sheet)
    }

    // MARK: - Configuration

    private func makeConfiguration(customer: String, ephemeralKey: String) -> PaymentSheet.Configuration {
        var configuration = PaymentSheet.Configuration()
        configuration.merchantDisplayName = merchantDisplayName
        // The customer + ephemeral key let PaymentSheet show saved cards and
        // save new ones. They're best-effort for one-off checkouts (3B): when
        // the backend couldn't mint a key we still collect a card against the
        // client secret rather than failing the whole flow.
        if !customer.isEmpty, !ephemeralKey.isEmpty {
            configuration.customer = .init(id: customer, ephemeralKeySecret: ephemeralKey)
        }
        // Apple Pay is intentionally left unconfigured until a merchant ID +
        // entitlement are provisioned; PaymentSheet still collects cards.
        // (Enabling it later is a one-liner here — see project.yml's
        // StripeApplePay product, already linked.)
        return configuration
    }

    // MARK: - Presentation

    private func present(_ sheet: PaymentSheet) async -> PaymentSheetOutcome {
        guard let presenter = Self.topViewController() else {
            return .failed(message: "Couldn't present the payment sheet. Please try again.")
        }
        return await withCheckedContinuation { continuation in
            // Capture `sheet` so it lives until the completion fires.
            sheet.present(from: presenter) { [sheet] result in
                _ = sheet
                switch result {
                case .completed:
                    continuation.resume(returning: .completed)
                case .canceled:
                    continuation.resume(returning: .canceled)
                case let .failed(error):
                    continuation.resume(returning: .failed(message: error.localizedDescription))
                }
            }
        }
    }

    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes
        let windowScene = (scenes.first { $0.activationState == .foregroundActive } as? UIWindowScene)
            ?? scenes.first as? UIWindowScene
        let window = windowScene?.windows.first { $0.isKeyWindow } ?? windowScene?.windows.first
        guard let root = window?.rootViewController else { return nil }
        return topMost(of: root)
    }

    private static func topMost(of controller: UIViewController) -> UIViewController {
        if let presented = controller.presentedViewController {
            return topMost(of: presented)
        }
        if let nav = controller as? UINavigationController, let visible = nav.visibleViewController {
            return topMost(of: visible)
        }
        if let tab = controller as? UITabBarController, let selected = tab.selectedViewController {
            return topMost(of: selected)
        }
        return controller
    }
}
