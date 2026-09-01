//
//  BusinessPaymentsViewModel.swift
//  Pantopus
//
//  Owner-side Stripe Connect for a *business* — the twin of the personal
//  payout flow in `WalletViewModel`. Same four moves, different subject:
//  read the connected account, create it, mint an Account Link to finish
//  onboarding, and open the Express dashboard once payouts are live.
//
//  Stripe hosts every KYC / bank / identity screen. We only open URLs, and
//  we reuse `ConnectWebPresenter` (SFSafariViewController) so the business
//  path behaves exactly like the personal one.
//
//  Mirrors RN `src/components/business/tabs/PaymentsTab.tsx`.
//

import Foundation

/// What the Payments screen is rendering.
public enum BusinessPaymentsState: Sendable, Equatable {
    case loading
    case loaded(BusinessPaymentsContent)
    case error(message: String)
}

/// The three connect stages RN derives from the account row, plus "none".
public enum BusinessPayoutStage: Sendable, Equatable {
    /// No `StripeAccount` row at all — "Connect with Stripe".
    case notConnected
    /// Account exists but `details_submitted == false` — "Continue setup".
    case setupIncomplete
    /// Details submitted, Stripe still verifying — waiting, no CTA.
    case verifying
    /// `charges_enabled && payouts_enabled` — dashboard reachable.
    case onboarded
}

/// Projected payload for the loaded frame.
public struct BusinessPaymentsContent: Sendable, Equatable {
    public let stage: BusinessPayoutStage
    public let chargesEnabled: Bool
    public let payoutsEnabled: Bool

    public init(stage: BusinessPayoutStage, chargesEnabled: Bool, payoutsEnabled: Bool) {
        self.stage = stage
        self.chargesEnabled = chargesEnabled
        self.payoutsEnabled = payoutsEnabled
    }

    public var headline: String {
        switch stage {
        case .notConnected: "No payout account connected"
        case .setupIncomplete: "Account setup incomplete"
        case .verifying: "Account verification in progress"
        case .onboarded: "Stripe account connected"
        }
    }

    public var subcopy: String {
        switch stage {
        case .notConnected: "Connect Stripe to accept payments and receive payouts."
        case .setupIncomplete: "Your account needs additional information."
        case .verifying: "Stripe is verifying your identity. Usually 1–2 business days."
        case .onboarded: "Payouts are enabled."
        }
    }
}

/// Toast/inline result of a Connect action.
public enum BusinessPaymentsAction: Sendable, Equatable {
    case idle
    /// Opening a Stripe-hosted page (create → link, or the dashboard).
    case connecting
    case failed(message: String)
}

@Observable
@MainActor
public final class BusinessPaymentsViewModel {
    public private(set) var state: BusinessPaymentsState = .loading
    public private(set) var action: BusinessPaymentsAction = .idle

    private let businessId: String
    private let api: APIClient
    private let connectPresenter: any ConnectWebPresenting
    /// Preview/test seam — when set, `load()` resolves locally.
    private let seededContent: BusinessPaymentsContent?

    /// Production initialiser. `APIClient` is module-internal, so the public
    /// initialiser must not name it (see `MembersListViewModel.swift:204`).
    public convenience init(businessId: String) {
        self.init(businessId: businessId, api: .shared)
    }

    init(
        businessId: String,
        api: APIClient,
        connectPresenter: any ConnectWebPresenting = ConnectWebPresenter(),
        seededContent: BusinessPaymentsContent? = nil
    ) {
        self.businessId = businessId
        self.api = api
        self.connectPresenter = connectPresenter
        self.seededContent = seededContent
        if let seededContent {
            state = .loaded(seededContent)
        }
    }

    /// Preview seam — render a fixed stage without touching the network.
    public init(businessId: String, content: BusinessPaymentsContent) {
        self.businessId = businessId
        api = .shared
        connectPresenter = ConnectWebPresenter()
        seededContent = content
        state = .loaded(content)
    }

    public func load() async {
        guard seededContent == nil else { return }
        state = .loading
        await fetch()
    }

    public func refresh() async {
        guard seededContent == nil else { return }
        await fetch()
    }

    /// `GET /stripe/account`. A 404 (or any client error) means "no account
    /// yet" — that is the not-connected stage, not a screen-level failure.
    /// Only a transport/server failure raises the error frame.
    private func fetch() async {
        do {
            let response: BusinessStripeAccountResponse = try await api.request(
                BusinessFinanceEndpoints.stripeAccount(businessId: businessId)
            )
            state = .loaded(Self.content(from: response.account))
        } catch let error as APIError {
            switch error {
            case .clientError, .notFound:
                state = .loaded(Self.content(from: nil))
            default:
                state = .error(message: error.errorDescription ?? "Couldn't load your payout account.")
            }
        } catch {
            state = .error(message: "Couldn't load your payout account.")
        }
    }

    // MARK: - Actions

    /// "Connect with Stripe" — create the connected account, then open the
    /// Stripe-hosted Account Link. The connect route answers no link of its
    /// own (`businesses.js:4447`), so we mint one via `refresh-link`, exactly
    /// as `WalletViewModel.setupPayouts()` does for the personal account.
    public func connect() async {
        guard seededContent == nil else { return }
        action = .connecting
        do {
            _ = try await api.request(
                BusinessFinanceEndpoints.connectStripe(businessId: businessId),
                as: BusinessStripeConnectResponse.self
            )
        } catch let error as APIError {
            // A 400 "account already exists" is fine — fall through to the
            // Account Link. Anything else (403 not the owner, 503 Connect
            // disabled, transport) is terminal.
            switch error {
            case .clientError(400, _):
                break
            default:
                action = .failed(message: error.errorDescription ?? "Couldn't connect Stripe.")
                return
            }
        } catch {
            action = .failed(message: "Couldn't connect Stripe.")
            return
        }
        await openOnboardingLink()
    }

    /// "Continue setup" — mint a fresh Account Link for an existing account.
    public func continueSetup() async {
        guard seededContent == nil else { return }
        action = .connecting
        await openOnboardingLink()
    }

    private func openOnboardingLink() async {
        do {
            let link: BusinessStripeAccountLinkResponse = try await api.request(
                BusinessFinanceEndpoints.stripeRefreshLink(businessId: businessId)
            )
            guard let url = URL(string: link.accountLink) else {
                action = .failed(message: "Couldn't open Stripe setup. Please try again.")
                return
            }
            await connectPresenter.present(url: url)
            action = .idle
            // The seller may have finished onboarding — re-read the account.
            await refresh()
        } catch {
            action = .failed(
                message: (error as? APIError)?.errorDescription ?? "Couldn't start Stripe setup."
            )
        }
    }

    /// "Open Stripe Dashboard" — Express login link. Nothing to refresh on
    /// return.
    public func openDashboard() async {
        guard seededContent == nil else { return }
        do {
            let link: BusinessStripeDashboardLinkResponse = try await api.request(
                BusinessFinanceEndpoints.stripeDashboardLink(businessId: businessId)
            )
            guard let url = URL(string: link.dashboardUrl) else {
                action = .failed(message: "Couldn't open your Stripe dashboard.")
                return
            }
            await connectPresenter.present(url: url)
        } catch {
            action = .failed(
                message: (error as? APIError)?.errorDescription ?? "Couldn't open your Stripe dashboard."
            )
        }
    }

    public func clearAction() {
        action = .idle
    }

    // MARK: - Mapping (pure — unit-test surface)

    /// Mirrors RN `PaymentsTab`: onboarded = `charges_enabled &&
    /// payouts_enabled`; an account without `details_submitted` is still in
    /// setup; anything else with an account row is verifying.
    public static func content(from account: ConnectAccountDTO?) -> BusinessPaymentsContent {
        guard let account else {
            return BusinessPaymentsContent(stage: .notConnected, chargesEnabled: false, payoutsEnabled: false)
        }
        let stage: BusinessPayoutStage = if account.chargesEnabled, account.payoutsEnabled {
            .onboarded
        } else if !account.detailsSubmitted {
            .setupIncomplete
        } else {
            .verifying
        }
        return BusinessPaymentsContent(
            stage: stage,
            chargesEnabled: account.chargesEnabled,
            payoutsEnabled: account.payoutsEnabled
        )
    }
}
