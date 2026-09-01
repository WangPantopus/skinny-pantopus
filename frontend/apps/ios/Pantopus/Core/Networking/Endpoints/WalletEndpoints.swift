//
//  WalletEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/wallet.js`. P1-F wired the READ
//  surface (balance, transaction history, pending-release). Block 3C adds the
//  WITHDRAW action (`POST /api/wallet/withdraw`) so a seller can move earned
//  funds to their bank — gated server-side on a verified Stripe Connect
//  account with payouts enabled.
//

import Foundation

public enum WalletEndpoints {
    /// `GET /api/wallet` — route `backend/routes/wallet.js:55`. Current
    /// balance + lifetime summary. Server creates the wallet on first
    /// access. Balance + frozen flag drive the available-balance hero.
    public static func balance() -> Endpoint {
        Endpoint(method: .get, path: "/api/wallet")
    }

    /// `GET /api/wallet/transactions` — route `backend/routes/wallet.js:124`.
    /// Paginated history; the Wallet screen reads the first page for the
    /// Recent-activity feed.
    public static func transactions(limit: Int = 50, offset: Int = 0) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/wallet/transactions",
            query: ["limit": String(limit), "offset": String(offset)]
        )
    }

    /// `GET /api/wallet/pending-release` — route `backend/routes/wallet.js:160`.
    /// In-review + releasing-soon escrow breakdown that explains why the
    /// available balance trails total earnings.
    public static func pendingRelease() -> Endpoint {
        Endpoint(method: .get, path: "/api/wallet/pending-release")
    }

    /// `POST /api/wallet/withdraw` — route `backend/routes/wallet.js:84`.
    /// Withdraw earned funds to the seller's bank via a Stripe Transfer to
    /// their connected account. The server debits the wallet atomically; the
    /// client refreshes balance + activity on success (never marks the row
    /// locally). Min $1.00 (100 cents). Requires payouts-enabled Connect.
    public static func withdraw(body: WalletWithdrawRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/wallet/withdraw", body: body)
    }
}
