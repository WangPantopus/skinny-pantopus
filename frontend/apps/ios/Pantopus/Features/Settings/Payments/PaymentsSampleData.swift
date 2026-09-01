//
//  PaymentsSampleData.swift
//  Pantopus
//
//  Fixed-seed fixtures for the A14.6 Payments screen — populated +
//  empty frames. Mirrors the JSX archetype in
//  `docs/designs/A14/payments-frames.jsx` line-for-line so the iOS
//  baseline reads identically to the design source. Stripe Connect
//  isn't wired yet (out of scope per P5.2), so these projections
//  drive both the populated preview and the snapshot tests.
//

import Foundation

public enum PaymentsSampleData {
    /// Three methods, Stripe connected, weekly payouts to Chase.
    public static let populated = PaymentsLoaded(
        balance: PaymentsBalance(
            overline: "Available to pay out",
            amount: "124.50",
            nextPayoutLabel: "Next payout · Mon, May 27",
            frequencyPill: "Weekly"
        ),
        methods: [
            PaymentMethod(
                id: "card_visa_4421",
                brand: .visa,
                label: "Visa •• 4421",
                subtext: "Expires 09/27",
                chip: PaymentMethodChip(label: "Default", tone: .primary)
            ),
            PaymentMethod(
                id: "card_mc_8830",
                brand: .mastercard,
                label: "Mastercard •• 8830",
                subtext: "Expires 03/26"
            ),
            PaymentMethod(
                id: "wallet_apple",
                brand: .applePay,
                label: "Apple Pay",
                subtext: "iPhone 15 Pro"
            )
        ],
        payouts: PaymentsPayouts(
            stripe: PaymentsPayoutRow(
                id: "payouts.stripe",
                leadingBrand: .stripe,
                label: "Stripe Connect",
                subtext: "Connected Mar 12, 2024",
                trailing: .chipChevron(label: "Connected", tone: .success)
            ),
            payoutMethod: PaymentsPayoutRow(
                id: "payouts.method",
                leadingBrand: .bank,
                label: "Payout to Chase •• 7421",
                subtext: "Personal checking",
                trailing: .chevron
            ),
            payoutSchedule: PaymentsPayoutRow(
                id: "payouts.schedule",
                label: "Payout schedule",
                subtext: "Weekly · Mondays",
                trailing: .chevron
            ),
            taxInfo: PaymentsPayoutRow(
                id: "payouts.tax",
                label: "Tax info",
                subtext: "W-9 on file",
                trailing: .chipChevron(label: "On file", tone: .success)
            ),
            helper: "Stripe handles payouts. Funds clear to your bank in 1–2 business days."
        ),
        activity: .stats([
            PaymentsActivityStat(
                id: "activity.transactions",
                label: "Transactions",
                subtext: "$2,340 earned · 47 in 2024"
            ),
            PaymentsActivityStat(
                id: "activity.statements",
                label: "Statements",
                subtext: "Monthly PDFs"
            ),
            PaymentsActivityStat(
                id: "activity.disputes",
                label: "Disputes",
                subtext: "None"
            )
        ]),
        canCloseAccount: true,
        footerCaption: "Stripe acct_1OqK… · Maria Lewin · ID 8174"
    )

    /// Fresh account — no balance hero, inline-empty methods card,
    /// Stripe primary "Connect" chip, payout-method + tax-info gated.
    public static let empty = PaymentsLoaded(
        balance: nil,
        methods: [],
        payouts: PaymentsPayouts(
            stripe: PaymentsPayoutRow(
                id: "payouts.stripe",
                leadingBrand: .stripe,
                label: "Stripe Connect",
                subtext: "Receive payments from neighbors",
                trailing: .ctaChip(label: "Connect", tone: .primary)
            ),
            payoutMethod: PaymentsPayoutRow(
                id: "payouts.method",
                label: "Payout method",
                subtext: "Add after connecting Stripe",
                trailing: .gatedDash
            ),
            payoutSchedule: nil,
            taxInfo: PaymentsPayoutRow(
                id: "payouts.tax",
                label: "Tax info",
                subtext: "W-9 collected during setup",
                trailing: .gatedDash
            ),
            helper: "Required before you can post paid tasks or sell on Marketplace."
        ),
        activity: .empty(
            title: "No transactions yet",
            body: "Hires and sales will appear here."
        ),
        canCloseAccount: false,
        footerCaption: "elena.park@gmail.com · Joined 3 days ago"
    )
}
