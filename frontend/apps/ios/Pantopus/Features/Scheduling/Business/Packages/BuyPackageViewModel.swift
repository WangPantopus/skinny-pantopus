//
//  BuyPackageViewModel.swift
//  Pantopus
//
//  G10 Buy Package (customer) — Stream I15. Checkout for a session package:
//  `POST /packages/:id/buy` creates the credit and returns a Stripe
//  `clientSecret` when priced (>0) — we present the shared `PaymentSheet`
//  (card + SCA + declined) and never mark paid client-side. Behind
//  `SchedulingFeatureFlags.paidEnabled` + Stripe TEST mode. Matches
//  `buypackage-frames.jsx` (logged-in / declined / already-owns-credits upsell).
//
//  Data note: there is no public "get package by id" endpoint (GET /packages is
//  owner-gated), so the summary is best-effort via the owner-scoped list — it
//  resolves for an owner-context viewer; a true third-party buyer reaches this
//  screen from the public booking page (I5) carrying richer context.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class BuyPackageViewModel {
    enum Phase: Equatable { case loading, ready, error(String), comingSoon }
    enum PayState: Equatable { case idle, paying, paid, declined(String) }

    // MARK: Inputs

    let owner: SchedulingOwner
    let packageId: String
    let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient
    private let presenter: any PaymentSheetPresenting

    // MARK: State

    private(set) var phase: Phase = .loading
    private(set) var payState: PayState = .idle
    private(set) var package: SchedulingPackageDTO?
    /// An existing live credit on this package — drives the "use a credit
    /// instead" upsell (buypackage frame 4).
    private(set) var existingCredit: PackageCreditDTO?
    /// True when no signed-in user is resolved — drives the guest-email card
    /// (buypackage frame 2). View-only structure; the email field + "Sign in"
    /// link are not yet wired to an auth/receipt endpoint (deferred backend).
    private(set) var isGuest = false

    var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var accent: Color {
        theme.accent
    }

    var accentBg: Color {
        theme.accentBg
    }

    var totalLabel: String {
        SchedulingMoney.format(cents: package?.priceCents, currency: package?.currency)
    }

    var perSessionLabel: String {
        SchedulingMoney.perSession(totalCents: package?.priceCents, sessions: package?.sessionsCount, currency: package?.currency)
    }

    var payButtonLabel: String {
        if case .declined = payState { return "Try payment again" }
        return package?.priceCents.map { $0 > 0 } == true ? "Pay \(totalLabel)" : "Get package"
    }

    init(
        owner: SchedulingOwner,
        packageId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient,
        presenter: any PaymentSheetPresenting
    ) {
        self.owner = owner
        self.packageId = packageId
        self.push = push
        self.client = client
        self.presenter = presenter
    }

    // MARK: Lifecycle

    func load() async {
        guard SchedulingFeatureFlags.paidEnabled else { phase = .comingSoon
            return
        }
        phase = .loading
        // Signed-out viewers see the guest-email card (buypackage frame 2).
        if case .signedOut = AuthManager.shared.state { isGuest = true }
        // Best-effort package summary (owner-scoped list).
        if let result: PackagesResponse = try? await client.request(SchedulingEndpoints.getPackages(owner: owner)) {
            package = result.packages.first { $0.id == packageId }
        }
        // Detect an existing credit on this package for the upsell.
        if let mine: MyPackagesResponse = try? await client.request(SchedulingEndpoints.getMyPackages()) {
            existingCredit = mine.credits.first { $0.packageId == packageId && ($0.remainingSessions ?? 0) > 0 }
        }
        phase = .ready
    }

    // MARK: Purchase

    func pay() async {
        payState = .paying
        do {
            let result: BuyPackageResponse = try await client.request(SchedulingEndpoints.buyPackage(id: packageId))
            guard let secret = result.clientSecret, !secret.isEmpty else {
                // Free package — credit granted, no charge.
                payState = .paid
                return
            }
            let outcome = await presenter.presentPayment(
                clientSecret: secret,
                customer: "",
                ephemeralKey: "",
                isSetupIntent: false,
                publishableKey: nil
            )
            switch outcome {
            case .completed: payState = .paid
            case .canceled: payState = .idle
            case let .failed(message): payState = .declined(message)
            }
        } catch let error as SchedulingError {
            payState = .declined(error.userMessage ?? "That payment didn't go through. Try another card.")
        } catch {
            payState = .declined("That payment didn't go through. Try another card.")
        }
    }

    /// Upsell action — go back to manage existing credits instead of buying more.
    func useCreditInstead() {
        push(.myPackages)
    }
}
