@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.mailbox_root

import app.pantopus.android.data.api.models.mailbox.MailItem
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.mailbox.item_detail.MailTrust
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * One sample row: a [MailItem] plus the sender-trust the V1 list DTO
 * can't carry on the wire (so the trust chip can vary per the design).
 */
data class MailboxSampleItem(
    val item: MailItem,
    val trust: MailTrust,
)

/** A titled group of sample rows (e.g. "Today", "Due this week"). */
data class MailboxSampleSection(
    val id: String,
    val header: String,
    val items: List<MailboxSampleItem>,
)

/**
 * B.1 — deterministic sample mail for the Mailbox root, keyed by
 * (drawer, tab). Backend has been removed, so the view-model projects
 * these into the render states; previews and Paparazzi baselines stay
 * stable. Me/Incoming mirrors the JSX `ME_INCOMING` set and Biz/Counter
 * mirrors `BIZ_COUNTER`; every Earn combo is intentionally empty.
 */
object MailboxRootSampleData {
    /** Sections for a (drawer, tab) window. Empty → per-combo empty state. */
    fun sections(
        drawer: MailboxDrawer,
        tab: MailboxTab,
    ): List<MailboxSampleSection> =
        when (drawer) {
            MailboxDrawer.Me ->
                when (tab) {
                    MailboxTab.Incoming -> meIncoming
                    MailboxTab.Counter -> meCounter
                    MailboxTab.Vault -> meVault
                }
            MailboxDrawer.Home ->
                when (tab) {
                    MailboxTab.Incoming -> homeIncoming
                    MailboxTab.Counter -> homeCounter
                    MailboxTab.Vault -> emptyList()
                }
            MailboxDrawer.Business ->
                when (tab) {
                    MailboxTab.Incoming -> businessIncoming
                    MailboxTab.Counter -> businessCounter
                    MailboxTab.Vault -> businessVault
                }
            MailboxDrawer.Earn -> emptyList()
        }

    // ─── Me ────────────────────────────────────────────────────────

    private val meIncoming =
        listOf(
            MailboxSampleSection(
                id = "today",
                header = "Today",
                items =
                    listOf(
                        mail(
                            "me-in-1",
                            MailItemCategory.Package,
                            "Echo Pop arriving today by 8pm",
                            "Tracking 9405 5123 8746 0291 0042 18. Driver will leave it at the front porch and capture a photo.",
                            "Amazon Logistics",
                            minutesAgo = 12,
                            viewed = false,
                            trust = MailTrust.Verified,
                        ),
                        mail(
                            "me-in-2",
                            MailItemCategory.Certified,
                            "Notice of public hearing — 412 Elm St",
                            "Re zoning variance ZA-2026-0188. Hearing scheduled June 3 at 6 PM. Written comment accepted through May 30.",
                            "City of Oakland · Planning",
                            minutesAgo = 60,
                            viewed = false,
                            trust = MailTrust.Verified,
                        ),
                    ),
            ),
            MailboxSampleSection(
                id = "yesterday",
                header = "Yesterday",
                items =
                    listOf(
                        mail(
                            "me-in-3",
                            MailItemCategory.Coupon,
                            "20% off your next dozen croissants",
                            "Show this at checkout. Valid through Sun May 17. Sender is address-verified but not identity-verified.",
                            "4th & Market Bakery",
                            minutesAgo = 60 * 24,
                            viewed = true,
                            trust = MailTrust.Partial,
                        ),
                        mail(
                            "me-in-4",
                            MailItemCategory.Community,
                            "Saturday playground cleanup — 9 to 11am",
                            "Coffee and donuts at the gazebo. Bring gloves if you have them. RSVP by Friday so we can order enough food.",
                            "Elm Park HOA",
                            minutesAgo = 60 * 26,
                            viewed = false,
                            trust = MailTrust.Verified,
                        ),
                        mail(
                            "me-in-5",
                            MailItemCategory.Booklet,
                            "June primary voter guide — 28 pages",
                            "Candidate questionnaires, ballot measure breakdowns, and a polling place lookup.",
                            "League of Women Voters",
                            minutesAgo = 60 * 48,
                            viewed = true,
                            trust = MailTrust.Verified,
                        ),
                    ),
            ),
        )

    private val meCounter =
        listOf(
            MailboxSampleSection(
                id = "awaiting",
                header = "Awaiting your response",
                items =
                    listOf(
                        mail(
                            "me-co-1",
                            MailItemCategory.Bill,
                            "Water bill — $58.20 due May 28",
                            "Autopay is off for this account. Pay before the due date to avoid a late fee.",
                            "EBMUD",
                            minutesAgo = 120,
                            viewed = false,
                            trust = MailTrust.Verified,
                        ),
                        mail(
                            "me-co-2",
                            MailItemCategory.Membership,
                            "Renew your library card",
                            "Your card expires May 31. Renew online in two minutes to keep your holds active.",
                            "Oakland Public Library",
                            minutesAgo = 60 * 30,
                            viewed = false,
                            trust = MailTrust.Verified,
                        ),
                    ),
            ),
        )

    private val meVault =
        listOf(
            MailboxSampleSection(
                id = "saved",
                header = "Saved",
                items =
                    listOf(
                        mail(
                            "me-va-1",
                            MailItemCategory.Certified,
                            "Lease — 412 Elm St (signed)",
                            "Fully executed copy of your 12-month residential lease. Stored for your records.",
                            "Cornerstone Realty",
                            minutesAgo = 60 * 24 * 9,
                            viewed = true,
                            trust = MailTrust.Verified,
                        ),
                        mail(
                            "me-va-2",
                            MailItemCategory.Statement,
                            "2025 tax summary",
                            "Year-end summary of the income documents connected to your account.",
                            "Pantopus",
                            minutesAgo = 60 * 24 * 14,
                            viewed = true,
                            trust = MailTrust.Chain,
                        ),
                    ),
            ),
        )

    // ─── Home ──────────────────────────────────────────────────────

    private val homeIncoming =
        listOf(
            MailboxSampleSection(
                id = "today",
                header = "Today",
                items =
                    listOf(
                        mail(
                            "home-in-1",
                            MailItemCategory.Community,
                            "Building water shutoff Thursday 9am–12pm",
                            "Maintenance will flush the risers. Store water ahead of time.",
                            "Maple Court HOA",
                            minutesAgo = 90,
                            viewed = false,
                            trust = MailTrust.Verified,
                        ),
                        mail(
                            "home-in-2",
                            MailItemCategory.Package,
                            "Dishwasher part out for delivery",
                            "Replacement rack arriving today. Signature not required.",
                            "PartSelect",
                            minutesAgo = 150,
                            viewed = false,
                            trust = MailTrust.Verified,
                        ),
                    ),
            ),
            MailboxSampleSection(
                id = "earlier",
                header = "Earlier",
                items =
                    listOf(
                        mail(
                            "home-in-3",
                            MailItemCategory.Notice,
                            "Annual fire inspection scheduled",
                            "The inspector will need access to all units June 10. Reply to confirm.",
                            "City Fire Marshal",
                            minutesAgo = 60 * 40,
                            viewed = true,
                            trust = MailTrust.Verified,
                        ),
                    ),
            ),
        )

    private val homeCounter =
        listOf(
            MailboxSampleSection(
                id = "due",
                header = "Due soon",
                items =
                    listOf(
                        mail(
                            "home-co-1",
                            MailItemCategory.Bill,
                            "HOA dues — $310 due June 1",
                            "Quarterly dues for Maple Court. Pay online or by check.",
                            "Maple Court HOA",
                            minutesAgo = 200,
                            viewed = false,
                            trust = MailTrust.Verified,
                        ),
                    ),
            ),
        )

    // ─── Business ──────────────────────────────────────────────────

    private val businessIncoming =
        listOf(
            MailboxSampleSection(
                id = "today",
                header = "Today",
                items =
                    listOf(
                        mail(
                            "biz-in-1",
                            MailItemCategory.Delivery,
                            "Linen order delivered to back entrance",
                            "24 tablecloths and 96 napkins signed for by staff.",
                            "Riverside Linen Supply",
                            minutesAgo = 100,
                            viewed = false,
                            trust = MailTrust.Verified,
                        ),
                        mail(
                            "biz-in-2",
                            MailItemCategory.Subscription,
                            "POS software renews June 15",
                            "Your annual plan renews automatically. Review your seat count before then.",
                            "SquareUp",
                            minutesAgo = 60 * 33,
                            viewed = true,
                            trust = MailTrust.Partial,
                        ),
                    ),
            ),
        )

    private val businessCounter =
        listOf(
            MailboxSampleSection(
                id = "due",
                header = "Due this week",
                items =
                    listOf(
                        mail(
                            "biz-co-1",
                            MailItemCategory.Tax,
                            "Q1 2026 sales tax filing due May 17",
                            "Estimated liability $1,840.12 based on connected POS. File on time to avoid the 10% penalty.",
                            "CA Dept of Tax & Fee Admin",
                            minutesAgo = 60 * 48,
                            viewed = false,
                            trust = MailTrust.Verified,
                        ),
                        mail(
                            "biz-co-2",
                            MailItemCategory.Statement,
                            "Statement of Information (SI-100) renewal",
                            "Annual filing to keep Pantopus Bakery Co LLC in good standing. $25 filing fee.",
                            "CA Secretary of State",
                            minutesAgo = 60 * 120,
                            viewed = false,
                            trust = MailTrust.Verified,
                        ),
                    ),
            ),
            MailboxSampleSection(
                id = "awaiting",
                header = "Awaiting your response",
                items =
                    listOf(
                        mail(
                            "biz-co-3",
                            MailItemCategory.Legal,
                            "Lease addendum — 1248 Oak Ave, suite 2",
                            "Mariah Chen requests your signature on Rider 3. Two signature fields and one initial.",
                            "Cornerstone Realty · via DocuSign",
                            minutesAgo = 180,
                            viewed = false,
                            trust = MailTrust.Verified,
                        ),
                        mail(
                            "biz-co-4",
                            MailItemCategory.Bill,
                            "Invoice 4821 — $642.50 net 30",
                            "Auto-pay is disabled for this vendor. Confirm before May 28 to keep your 2% on-time discount.",
                            "Riverside Linen Supply",
                            minutesAgo = 300,
                            viewed = false,
                            trust = MailTrust.Verified,
                        ),
                        mail(
                            "biz-co-5",
                            MailItemCategory.Subscription,
                            "Service migration — install window required",
                            "Your line transitions from copper to fiber on June 4. Pick a 2-hour install window.",
                            "Verizon Business",
                            minutesAgo = 60 * 24,
                            viewed = true,
                            trust = MailTrust.Partial,
                        ),
                    ),
            ),
        )

    private val businessVault =
        listOf(
            MailboxSampleSection(
                id = "saved",
                header = "Saved",
                items =
                    listOf(
                        mail(
                            "biz-va-1",
                            MailItemCategory.Statement,
                            "2025 profit & loss",
                            "Year-end P&L exported from your connected accounts.",
                            "Pantopus",
                            minutesAgo = 60 * 24 * 15,
                            viewed = true,
                            trust = MailTrust.Chain,
                        ),
                    ),
            ),
        )

    // ─── Builder ───────────────────────────────────────────────────

    @Suppress("LongParameterList")
    private fun mail(
        id: String,
        category: MailItemCategory,
        title: String,
        preview: String,
        sender: String,
        minutesAgo: Int,
        viewed: Boolean,
        trust: MailTrust,
    ): MailboxSampleItem {
        val item =
            MailItem(
                id = id,
                recipientUserId = null,
                recipientHomeId = null,
                deliveryTargetType = null,
                deliveryTargetId = null,
                addressHomeId = null,
                attnUserId = null,
                attnLabel = null,
                deliveryVisibility = null,
                mailType = category.raw,
                displayTitle = title,
                previewText = preview,
                primaryAction = null,
                actionRequired = null,
                ackRequired = null,
                ackStatus = null,
                type = category.raw,
                subject = null,
                content = null,
                senderUserId = null,
                senderBusinessName = sender,
                senderAddress = null,
                viewed = viewed,
                viewedAt = null,
                archived = false,
                starred = false,
                payoutAmount = null,
                payoutStatus = null,
                category = null,
                tags = emptyList(),
                priority = "normal",
                attachments = null,
                expiresAt = null,
                createdAt = Instant.now().minus(minutesAgo.toLong(), ChronoUnit.MINUTES).toString(),
            )
        return MailboxSampleItem(item = item, trust = trust)
    }
}
