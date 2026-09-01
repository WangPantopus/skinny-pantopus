//
//  PaymentsSetupViewModel.swift
//  Pantopus
//
//  G6 Payments Setup · Stripe Connect & Tax (Stream I14). Loads the owner's
//  Stripe Connect status from `GET /payments/status` and projects it into the
//  five designed frames (not-connected / incomplete / ready / restricted /
//  returned). Connect / resume / finish open the Stripe-hosted Account Link via
//  the existing Connect plumbing (`ConnectEndpoints` + `ConnectWebPresenter`),
//  exactly as the gig Wallet does; on return we re-read status.
//
//  Honest backend mapping:
//   • `/payments/status` exposes only { applicable, connected, charges_enabled,
//     payouts_enabled } — enough to drive the hero + three readiness pills.
//   • Account detail (statement descriptor, bank, currency, tax rate) lives in
//     Stripe; those rows open the Stripe Express dashboard rather than
//     fabricating values. Currency is the app-wide USD default.
//   • Homes are `applicable:false` (payments are per-user) → not-applicable view.
//   • Gated behind `SchedulingFeatureFlags.paidEnabled` (Stripe TEST mode).
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class PaymentsSetupViewModel {
    enum Phase: Equatable { case loading, loaded, error(String) }

    /// The five designed connection frames, derived from the status booleans.
    enum Setup: Equatable { case notConnected, incomplete, restricted, ready }

    // MARK: Inputs

    let owner: SchedulingOwner
    let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient
    /// Injected for tests; the real `ConnectWebPresenter` is built lazily on the
    /// MainActor inside the action methods so no `@MainActor` type is
    /// constructed in an initializer (avoids the Xcode 16.4 default-arg crash).
    private let injectedPresenter: (any ConnectWebPresenting)?

    // MARK: State

    private(set) var phase: Phase = .loading
    private(set) var status: PaymentsStatusDTO?
    private(set) var connecting = false
    /// Frame 5 — a brief success banner after returning from Stripe.
    private(set) var justReturned = false
    private(set) var actionMessage: String?

    // MARK: Derived

    var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var accent: Color {
        theme.accent
    }

    var accentBg: Color {
        theme.accentBg
    }

    /// Homes don't take payments directly; the endpoint echoes `applicable:false`.
    var isApplicable: Bool {
        guard owner.supportsPayments else { return false }
        return status?.applicable ?? true
    }

    var setup: Setup {
        guard let status, status.connected else { return .notConnected }
        let charges = status.chargesEnabled ?? false
        let payouts = status.payoutsEnabled ?? false
        if charges, payouts { return .ready }
        if charges { return .restricted }
        return .incomplete
    }

    var chargesPill: ReadinessPill.State {
        if status?.chargesEnabled == true { return .on }
        return status?.connected == true ? .warn : .off
    }

    var payoutsPill: ReadinessPill.State {
        if status?.payoutsEnabled == true { return .on }
        return status?.chargesEnabled == true ? .warn : .off
    }

    var detailsPill: ReadinessPill.State {
        if setup == .ready { return .on }
        return status?.connected == true ? .warn : .off
    }

    /// Whether the account rows show real (connected) values vs em-dashed gates.
    var isConnected: Bool {
        status?.connected == true
    }

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient,
        connectPresenter: (any ConnectWebPresenting)? = nil
    ) {
        self.owner = owner
        self.push = push
        self.client = client
        injectedPresenter = connectPresenter
    }

    // MARK: Lifecycle

    func load() async {
        // Skip the network for homes — payments are per-user, never per-home.
        guard owner.supportsPayments else {
            status = nil
            phase = .loaded
            return
        }
        phase = .loading
        await fetch()
    }

    func refresh() async {
        await load()
    }

    private func fetch(showLoading: Bool = true) async {
        if showLoading { phase = .loading }
        do {
            let result: PaymentsStatusDTO = try await client.request(SchedulingEndpoints.paymentsStatus(owner: owner))
            status = result
            phase = .loaded
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load your payment status.")
        } catch {
            phase = .error("Couldn't load your payment status.")
        }
    }

    // MARK: Connect / resume / finish

    /// Ensure a connected account exists, then open the Stripe-hosted Account
    /// Link. On return, re-read status so the frame advances. Mirrors the gig
    /// Wallet's `setupPayouts`.
    func beginConnect() async {
        guard !connecting else { return }
        connecting = true
        defer { connecting = false }
        let presenter = injectedPresenter ?? ConnectWebPresenter()
        // A 400 "already exists" is fine — proceed to the onboarding link.
        _ = try? await client.request(
            ConnectEndpoints.createAccount(),
            as: ConnectCreateAccountResponse.self
        )
        do {
            let link: ConnectOnboardingResponse = try await client.request(ConnectEndpoints.onboarding())
            guard let url = URL(string: link.onboardingUrl) else {
                actionMessage = "Couldn't open Stripe setup. Please try again."
                return
            }
            await presenter.present(url: url)
            await fetch(showLoading: false)
            justReturned = setup == .ready
        } catch let error as SchedulingError {
            actionMessage = error.userMessage ?? "Couldn't start Stripe setup."
        } catch {
            actionMessage = "Couldn't start Stripe setup."
        }
    }

    /// Open the Stripe Express dashboard (manage bank, descriptor, tax, payouts).
    func openDashboard() async {
        let presenter = injectedPresenter ?? ConnectWebPresenter()
        do {
            let link: ConnectDashboardResponse = try await client.request(ConnectEndpoints.dashboard())
            guard let url = URL(string: link.dashboardUrl) else { return }
            await presenter.present(url: url)
            await fetch(showLoading: false)
        } catch let error as SchedulingError {
            actionMessage = error.userMessage ?? "Couldn't open your Stripe dashboard."
        } catch {
            actionMessage = "Couldn't open your Stripe dashboard."
        }
    }

    func dismissReturnedBanner() {
        justReturned = false
    }

    func clearActionMessage() {
        actionMessage = nil
    }
}
