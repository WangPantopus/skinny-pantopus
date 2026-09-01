//
//  EarnSampleData.swift
//  Pantopus
//
//  A10.11 — deterministic stub fixtures for the Earn dashboard. Mirrors
//  the two designed frames (populated active-earner + empty new-earner)
//  from `docs/designs/A10/earn-frames.jsx`. Snapshot tests + previews
//  read from here so both states render identically across runs and
//  match the Android `EarnSampleData` object line-for-line.
//
//  There is no payout / Stripe Connect backend wired yet (this batch
//  ships the visual surface; the live swap lands with Connect), so the
//  view-model is seeded with this data and `content == nil` selects the
//  empty new-earner frame.
//

import Foundation

public enum EarnSampleData {
    /// Shared across both frames — the `Ways to earn` engine is identical
    /// for active and new earners. Featured first row lands on the tinted
    /// `primary50` surface.
    public static let waysToEarn: [EarnWayToEarn] = [
        EarnWayToEarn(
            kind: .browse,
            title: "Browse open tasks",
            meta: "28 near you · up to $140 today",
            accent: .primary,
            featured: true
        ),
        EarnWayToEarn(
            kind: .refer,
            title: "Refer a neighbor",
            meta: "+$10 when they finish a task",
            accent: .home
        ),
        EarnWayToEarn(
            kind: .offer,
            title: "Offer a service",
            meta: "Get matched to repeat clients",
            accent: .business
        )
    ]

    /// Active-earner frame — $312.40 available, 74% to the weekly goal,
    /// four recent earnings (one still pending), linked Chase payout with
    /// auto-cash-out on, and the YTD / 1099 tax line.
    public static let populated = EarnContent(
        available: "312.40",
        thisWeek: "$148.00",
        thisWeekMeta: "6 tasks this week",
        pending: "$60.00",
        pendingMeta: "1 task · clears Dec 3",
        weeklyGoal: EarnWeeklyGoal(
            progress: 0.74,
            ringLabel: "74%",
            ringSublabel: "to goal",
            headline: "$52 to go",
            subcopy: "$148 of your $200 goal this week"
        ),
        waysToEarn: waysToEarn,
        earnings: earningsSample,
        payoutMethod: EarnPayoutMethod(
            bankLabel: "Chase checking",
            last4: "7421",
            bodyText: "Instant payout · 1–3 minutes"
        ),
        autoCashOut: EarnAutoCashOut(
            title: "Auto cash out",
            detail: "Every Friday · cleared balance",
            isOn: true
        ),
        taxDocs: EarnTaxDocs(
            bodyText: "YTD earnings $4,920 · 1099 available mid-Jan"
        )
    )

    private static let earningsSample: [EarnEarning] = [
        EarnEarning(
            id: "earn-1",
            day: "Today",
            dateLabel: "2:14 pm",
            description: "Patio cleanup · 3 hr",
            counterparty: "Marcus P.",
            category: .cleaning,
            status: .paid,
            amount: "140.00"
        ),
        EarnEarning(
            id: "earn-2",
            day: "Yesterday",
            dateLabel: "6:40 pm",
            description: "Dog walk · 4 visits",
            counterparty: "Tom B.",
            category: .petCare,
            status: .paid,
            amount: "41.00"
        ),
        EarnEarning(
            id: "earn-3",
            day: "Dec 1",
            dateLabel: "11:14 am",
            description: "IKEA assembly",
            counterparty: "Reyes household",
            category: .handyman,
            status: .paid,
            amount: "120.00"
        ),
        EarnEarning(
            id: "earn-4",
            day: "Nov 29",
            dateLabel: "8:31 pm",
            description: "Babysitting · 3 hr",
            counterparty: "The Hahns",
            category: .childCare,
            status: .pending(clearsLabel: "Dec 3"),
            amount: "60.00"
        )
    ]
}
