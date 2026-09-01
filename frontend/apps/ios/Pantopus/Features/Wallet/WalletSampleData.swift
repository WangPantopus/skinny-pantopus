//
//  WalletSampleData.swift
//  Pantopus
//
//  A10.10 — deterministic stub fixtures for the Wallet screen. Mirrors
//  the two designed frames (populated + payout on hold) from
//  `docs/designs/A10/wallet-frames.jsx`. Snapshot tests + previews
//  read from here so both states render identically across runs.
//

import Foundation

public enum WalletSampleData {
    /// Numbers + activity feed pulled verbatim from the populated
    /// frame. The hold variant reuses the same balance + payout meta
    /// so the only visual deltas are the amber banner + locked
    /// withdraw + warn payout-method.
    public static let populated = WalletContent(
        available: "847.50",
        pending: "$186.00",
        pendingMeta: "3 tasks · clears by Dec 4",
        monthValue: "$1,284.50",
        monthMeta: "8 tasks · ▲22% vs Oct",
        activity: activitySample,
        payoutMethod: payoutMethodSample,
        taxDocs: taxDocsSample
    )

    /// Fixture payout method for the populated frame (previews / snapshots).
    public static let payoutMethodSample = WalletPayoutMethod(
        bankLabel: "Chase checking",
        last4: "7421",
        bodyText: "Instant payout · 1–3 minutes",
        warn: false
    )

    /// Fixture tax-docs row for the populated frame (previews / snapshots).
    public static let taxDocsSample = WalletTaxDocs(
        ready: false,
        bodyText: "YTD earnings $3,184 · docs available mid-Jan"
    )

    /// Fixture payout method for the hold frame (previews / snapshots).
    public static let payoutMethodHoldSample = WalletPayoutMethod(
        bankLabel: "Chase checking",
        last4: "7421",
        bodyText: "Verification expired Nov 30",
        warn: true
    )

    /// Fixture tax-docs row for the hold frame (previews / snapshots).
    public static let taxDocsHoldSample = WalletTaxDocs(
        ready: true,
        bodyText: "1099-NEC for 2025 ready · $9,847 reported"
    )

    /// Payout-on-hold variant. Same balance, amber banner over the
    /// hero, warn payout-method, 1099-ready row with a "New" chip
    /// (since the hold-state pack lands in January when the prior
    /// year's 1099 has dropped).
    public static let onHold = WalletContent(
        available: "847.50",
        pending: "$186.00",
        pendingMeta: "3 tasks · clears by Dec 4",
        monthValue: "$1,284.50",
        monthMeta: "8 tasks · ▲22% vs Oct",
        activity: Array(activitySample.prefix(4)),
        payoutMethod: payoutMethodHoldSample,
        taxDocs: taxDocsHoldSample,
        holdState: WalletHoldState(
            bannerHeadline: "Bank verification expired",
            bannerBody:
            "Chase asks us to re-confirm your account every 12 months. "
                + "A 2-minute micro-deposit check unlocks payouts again. "
                + "Earnings keep landing in your wallet — they're safe.",
            heroBannerHeadline: "Withdrawals paused",
            heroBannerBody: "Re-verify your bank to release funds.",
            withdrawFootnote: "Re-verify your bank above to unlock payouts."
        )
    )

    private static let activitySample: [WalletActivityItem] = [
        WalletActivityItem(
            id: "tx-1",
            day: "Today",
            dateLabel: "2:14 pm",
            description: "Patio cleanup · 3 hr",
            counterparty: "Marcus P.",
            category: .cleaning,
            direction: .in,
            status: .available,
            amount: "140.00"
        ),
        WalletActivityItem(
            id: "tx-2",
            day: "Today",
            dateLabel: "10:02 am",
            description: "Lawn cleanup",
            counterparty: "Diane K.",
            category: .cleaning,
            direction: .in,
            status: .pending(clearsLabel: "Dec 4"),
            amount: "85.00"
        ),
        WalletActivityItem(
            id: "tx-3",
            day: "Yesterday",
            dateLabel: "8:31 pm",
            description: "Babysitting · 3 hr",
            counterparty: "The Hahns",
            category: .childCare,
            direction: .in,
            status: .pending(clearsLabel: "Dec 3"),
            amount: "60.00"
        ),
        WalletActivityItem(
            id: "tx-4",
            day: "Nov 28",
            dateLabel: "11:14 am",
            description: "Withdrawal",
            counterparty: "Chase ••••7421",
            category: .bank,
            direction: .out,
            status: .complete,
            amount: "500.00"
        ),
        WalletActivityItem(
            id: "tx-5",
            day: "Nov 26",
            dateLabel: "5:48 pm",
            description: "IKEA assembly",
            counterparty: "Reyes household",
            category: .handyman,
            direction: .in,
            status: .available,
            amount: "120.00"
        ),
        WalletActivityItem(
            id: "tx-6",
            day: "Nov 24",
            dateLabel: "3:01 pm",
            description: "Dog walk · 4 visits",
            counterparty: "Tom B.",
            category: .petCare,
            direction: .in,
            status: .available,
            amount: "41.00"
        ),
        WalletActivityItem(
            id: "tx-7",
            day: "Nov 22",
            dateLabel: "6:14 pm",
            description: "Service fee",
            counterparty: "Pantopus",
            category: .fee,
            direction: .out,
            status: .complete,
            amount: "2.40",
            isFee: true
        )
    ]
}
