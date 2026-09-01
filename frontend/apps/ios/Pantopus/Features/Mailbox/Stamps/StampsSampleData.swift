//
//  StampsSampleData.swift
//  Pantopus
//
//  A17.11 — deterministic fixtures for the Stamps screen. Mirrors the
//  `populated` + `empty` frames in `docs/designs/A17/stamps.jsx` so
//  previews, snapshot tests, and the no-backend wiring render the same
//  numbers the designer specified ("8 of 12 left", the four wallet
//  designs, the four-send usage ledger, and the Elf usage read-out).
//
//  The web `api.mailboxV2P3.getStamps()` endpoint models an
//  achievement-style stamp *gallery*, not this postage *wallet*, and has
//  no native client equivalent — so the screen drives off these
//  projections, exactly as `VacationHold` / `MailDay` do.
//

import Foundation

public enum StampsSampleData {
    /// The populated wallet — the `state === 'populated'` JSX frame.
    public static var populated: StampsContent {
        StampsContent(
            trust: .verified,
            categoryLabel: "Stamps",
            timeLabel: "Today",
            book: StampBook(
                series: "Local · Forever Series",
                total: 12,
                used: 4,
                purchasedLabel: "Apr 2, 2026",
                validityLabel: "Never expires"
            ),
            elfHeadline: "Pantopus checked your stamps",
            elfSummary: "You've used 4 of 12 in this book — mostly neighbor mail. At about 2 sends a "
                + "week you'll run low in roughly 4 weeks. Heads up: Express is down to 3.",
            insights: [
                StampInsight(
                    id: "rate",
                    icon: .gauge,
                    label: "~2 stamps / week",
                    text: "over the last 30 days"
                ),
                StampInsight(
                    id: "runway",
                    icon: .hourglass,
                    label: "~4 weeks of postage",
                    text: "left at this pace"
                ),
                StampInsight(
                    id: "express-low",
                    icon: .alertTriangle,
                    label: "Express low — 3 left",
                    text: "used for priority sends"
                )
            ],
            wallet: [
                WalletStamp(
                    id: "express",
                    name: "Express",
                    tag: "Priority",
                    denom: "×3 speed",
                    quantity: 3,
                    ink: .express
                ),
                WalletStamp(id: "civic", name: "Civic", tag: "Certified", denom: "Official", quantity: 5, ink: .civic),
                WalletStamp(
                    id: "spring",
                    name: "Spring Bloom",
                    tag: "Collectible",
                    denom: "Limited",
                    quantity: 2,
                    ink: .spring
                ),
                WalletStamp(
                    id: "business",
                    name: "Business",
                    tag: "Biz drawer",
                    denom: "Receipts",
                    quantity: 6,
                    ink: .business
                )
            ],
            walletSummary: "16 stamps across 4 designs",
            usage: [
                StampUsage(
                    id: "hoa",
                    recipient: "Elm Park HOA",
                    kind: "Community RSVP",
                    dateLabel: "May 26",
                    stampName: "Local",
                    ink: .local
                ),
                StampUsage(
                    id: "planning",
                    recipient: "City of Oakland · Planning",
                    kind: "Certified reply",
                    dateLabel: "May 22",
                    stampName: "Civic",
                    ink: .civic
                ),
                StampUsage(
                    id: "marisol",
                    recipient: "Marisol Vega",
                    kind: "Thank-you note",
                    dateLabel: "May 19",
                    stampName: "Local",
                    ink: .local
                ),
                StampUsage(
                    id: "riverside",
                    recipient: "Riverside Linen Supply",
                    kind: "Invoice dispute",
                    dateLabel: "May 14",
                    stampName: "Express",
                    ink: .express
                )
            ],
            usageWindow: "Last 30 days",
            issuer: StampIssuer(
                initials: "PP",
                name: "Pantopus Post",
                dept: "Official postage · Pantopus Network",
                kindLabel: "Verified issuer",
                proofLabel: "Postage authority"
            )
        )
    }

    /// The "No stamps yet" frame — the `state === 'empty'` JSX frame.
    public static var empty: StampsEmptyContent {
        StampsEmptyContent(
            headline: "No stamps yet",
            body: "You'll need a stamp to send mail to a neighbor. Pick up a book and your postage lands here.",
            buyLabel: "Buy stamps",
            starterBook: StampStarterBook(
                title: "Starter book",
                detail: "12 Local Forever stamps · never expire",
                priceLabel: "$4.80"
            ),
            howItWorksTitle: "One stamp per send",
            howItWorksBody: "Replies to mail you receive are always free. Stamps are only spent when you "
                + "start a new thread with a neighbor or business."
        )
    }
}
