@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.stamps

import app.pantopus.android.ui.screens.shared.mail_item_detail.MailDetailTrust
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A17.11 — deterministic fixtures for the Stamps screen. Mirrors iOS
 * `StampsSampleData.swift` and the `populated` + `empty` frames in
 * `docs/designs/A17/stamps.jsx`.
 *
 * The web `api.mailboxV2P3.getStamps()` route models an achievement-style
 * stamp *gallery*, not this postage *wallet*, and has no native client
 * equivalent — so the screen drives off these projections, exactly as
 * `VacationHold` / `MailDay` do.
 */
object StampsSampleData {
    /** The populated wallet — the `state === 'populated'` JSX frame. */
    val populated: StampsContent =
        StampsContent(
            trust = MailDetailTrust.Verified,
            categoryLabel = "Stamps",
            timeLabel = "Today",
            book =
                StampBook(
                    series = "Local · Forever Series",
                    total = 12,
                    used = 4,
                    purchasedLabel = "Apr 2, 2026",
                    validityLabel = "Never expires",
                ),
            elfHeadline = "Pantopus checked your stamps",
            elfSummary =
                "You've used 4 of 12 in this book — mostly neighbor mail. At about 2 sends a " +
                    "week you'll run low in roughly 4 weeks. Heads up: Express is down to 3.",
            insights =
                listOf(
                    StampInsight(
                        id = "rate",
                        icon = PantopusIcon.Gauge,
                        label = "~2 stamps / week",
                        text = "over the last 30 days",
                    ),
                    StampInsight(
                        id = "runway",
                        icon = PantopusIcon.Hourglass,
                        label = "~4 weeks of postage",
                        text = "left at this pace",
                    ),
                    StampInsight(
                        id = "express-low",
                        icon = PantopusIcon.AlertTriangle,
                        label = "Express low — 3 left",
                        text = "used for priority sends",
                    ),
                ),
            wallet =
                listOf(
                    WalletStamp("express", "Express", "Priority", "×3 speed", 3, StampInk.Express),
                    WalletStamp("civic", "Civic", "Certified", "Official", 5, StampInk.Civic),
                    WalletStamp("spring", "Spring Bloom", "Collectible", "Limited", 2, StampInk.Spring),
                    WalletStamp("business", "Business", "Biz drawer", "Receipts", 6, StampInk.Business),
                ),
            walletSummary = "16 stamps across 4 designs",
            usage =
                listOf(
                    StampUsage("hoa", "Elm Park HOA", "Community RSVP", "May 26", "Local", StampInk.Local),
                    StampUsage(
                        "planning",
                        "City of Oakland · Planning",
                        "Certified reply",
                        "May 22",
                        "Civic",
                        StampInk.Civic,
                    ),
                    StampUsage("marisol", "Marisol Vega", "Thank-you note", "May 19", "Local", StampInk.Local),
                    StampUsage(
                        "riverside",
                        "Riverside Linen Supply",
                        "Invoice dispute",
                        "May 14",
                        "Express",
                        StampInk.Express,
                    ),
                ),
            usageWindow = "Last 30 days",
            issuer =
                StampIssuer(
                    initials = "PP",
                    name = "Pantopus Post",
                    dept = "Official postage · Pantopus Network",
                    kindLabel = "Verified issuer",
                    proofLabel = "Postage authority",
                ),
        )

    /** The "No stamps yet" frame — the `state === 'empty'` JSX frame. */
    val empty: StampsEmptyContent =
        StampsEmptyContent(
            headline = "No stamps yet",
            body = "You'll need a stamp to send mail to a neighbor. Pick up a book and your postage lands here.",
            buyLabel = "Buy stamps",
            starterBook =
                StampStarterBook(
                    title = "Starter book",
                    detail = "12 Local Forever stamps · never expire",
                    priceLabel = "$4.80",
                ),
            howItWorksTitle = "One stamp per send",
            howItWorksBody =
                "Replies to mail you receive are always free. Stamps are only spent when you " +
                    "start a new thread with a neighbor or business.",
        )
}
