@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.contentdetail

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Design sample frames for A09.4 Invoice — previews and Paparazzi baselines
 * only. The shipped screen never renders these: [InvoiceDetailViewModel]
 * projects the real invoice from `GET api/businesses/invoices/{id}`. Kept
 * alongside `GigDetailSampleData` / `ListingDetailSampleData` so the designed
 * states stay pixel-locked without fixture data leaking into production.
 */
object InvoiceDetailSampleData {
    /** Single source of truth for the sample total. */
    const val TOTAL_VALUE = "$642.85"

    // Declared before the frames below — object properties initialise in
    // declaration order, so the frames must come last.
    private val payerPayee =
        ContentDetailModule.FromTo(
            id = "fromto",
            from =
                ContentDetailParty(
                    label = "From",
                    name = "Brightside Outdoor",
                    sub = "Business · Verified",
                    accent = ContentDetailParty.Accent.Business,
                ),
            to =
                ContentDetailParty(
                    label = "To",
                    name = "Marcus Chen",
                    sub = "Personal",
                    accent = ContentDetailParty.Accent.Personal,
                ),
        )

    private val noteFromSender =
        ContentDetailModule.Description(
            id = "note",
            title = "Note from sender",
            icon = null,
            body =
                "“Takedown is on the schedule for the first Tuesday in January — no need " +
                    "to be home. Thanks again Marcus, happy holidays.”",
        )

    /** A09.4 · due state. */
    val due: ContentDetailContent = dueFrame("INV-00318")

    /** A09.4 · paid state (paid 4 days early via Pantopus Pay). */
    val paid: ContentDetailContent = paidFrame("INV-00318")

    fun dueFrame(invoiceId: String): ContentDetailContent =
        ContentDetailContent(
            kind = ContentDetailKind.Invoice,
            statusPill =
                ContentDetailPill(
                    id = "status",
                    label = "Due in 7 days",
                    icon = PantopusIcon.Clock,
                    tone = ContentDetailPill.Tone.Warning,
                ),
            hero =
                ContentDetailHero(
                    title = "Holiday lighting · install + takedown",
                    monoId = "${invoiceId.uppercase()} · issued Dec 4 · due Dec 18",
                    priceLine = TOTAL_VALUE,
                    priceCaption = "total · USD",
                ),
            modules =
                listOf(
                    payerPayee,
                    lineItems(
                        totalLabel = "Total",
                        totalTone = ContentDetailModule.LineItems.TotalTone.Primary,
                    ),
                    ContentDetailModule.CaptionedText(
                        id = "terms",
                        title = "Payment terms",
                        icon = PantopusIcon.File,
                        label =
                            "Net 14 from issue. Pantopus Pay (instant), card, or ACH. " +
                                "Late fee 1.5%/mo applies after due date.",
                    ),
                    noteFromSender,
                ),
            dock =
                ContentDetailDock(
                    secondary = null,
                    primary =
                        ContentDetailDockButton(
                            label = "Pay $TOTAL_VALUE",
                            icon = PantopusIcon.CreditCard,
                        ),
                ),
        )

    fun paidFrame(invoiceId: String): ContentDetailContent =
        ContentDetailContent(
            kind = ContentDetailKind.Invoice,
            statusPill =
                ContentDetailPill(
                    id = "status",
                    label = "Paid · Dec 14",
                    icon = PantopusIcon.CheckCircle,
                    tone = ContentDetailPill.Tone.Success,
                ),
            hero =
                ContentDetailHero(
                    title = "Holiday lighting · install + takedown",
                    monoId = "${invoiceId.uppercase()} · issued Dec 4 · paid Dec 14",
                    priceLine = TOTAL_VALUE,
                    priceTone = ContentDetailHero.PriceTone.Success,
                    priceTrailingLabel = "paid in full",
                    priceCheckDisc = true,
                ),
            modules =
                listOf(
                    payerPayee,
                    ContentDetailModule.Callout(
                        id = "pantopus-pay-receipt",
                        style = ContentDetailModule.Callout.Style.Banner,
                        tone = ContentDetailModule.Callout.Tone.Success,
                        icon = PantopusIcon.Zap,
                        iconTone = ContentDetailModule.Callout.IconTone.SuccessOutline,
                        title = "Paid via Pantopus Pay",
                        subtitle = "txn_3p4q9m · Dec 14",
                        subtitleMono = true,
                    ),
                    lineItems(
                        totalLabel = "Paid",
                        totalTone = ContentDetailModule.LineItems.TotalTone.Success,
                    ),
                    noteFromSender,
                ),
            dock =
                ContentDetailDock(
                    secondary = ContentDetailDockButton(label = "Share", icon = PantopusIcon.Share),
                    primary = ContentDetailDockButton(label = "Download receipt", icon = PantopusIcon.Receipt),
                ),
        )

    private fun lineItems(
        totalLabel: String,
        totalTone: ContentDetailModule.LineItems.TotalTone,
    ): ContentDetailModule.LineItems =
        ContentDetailModule.LineItems(
            id = "items",
            title = "Line items",
            icon = PantopusIcon.File,
            rows =
                listOf(
                    ContentDetailLineItem("l1", "Install labor · 3.5h", "3.5", "$65", "$227.50"),
                    ContentDetailLineItem("l2", "LED string lights", "8", "$28", "$224.00"),
                    ContentDetailLineItem("l3", "Clips, timer, splitters", "1", "$45", "$45.00"),
                    ContentDetailLineItem("l4", "Takedown · scheduled Jan 6", "1", "$95", "$95.00"),
                ),
            fees =
                listOf(
                    ContentDetailSummaryRow("sub", "Subtotal", "$591.50"),
                    ContentDetailSummaryRow("svc", "Service fee (3%)", "$17.75"),
                    ContentDetailSummaryRow("tax", "Tax (5.7%)", "$33.60"),
                ),
            totalLabel = totalLabel,
            totalValue = TOTAL_VALUE,
            totalTone = totalTone,
        )
}
